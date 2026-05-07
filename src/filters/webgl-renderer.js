// WebGL2 renderer for photo processing.
// All filter ops run as GLSL fragment shaders on the GPU.
// Slider changes re-run the shader — no pixel loops, no worker, no queue.

const VERT = /* glsl */`#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = (a_position + 1.0) * 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`

const FRAG = /* glsl */`#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform vec2 u_texSize;   // actual texture dimensions (for sharpening texel size)

uniform float u_exposure;
uniform float u_contrast;
uniform float u_highlights;
uniform float u_shadows;
uniform float u_warmth;
uniform float u_tint;
uniform float u_saturation;
uniform float u_vibrance;
uniform float u_hiHue;
uniform float u_hiStrength;
uniform float u_shHue;
uniform float u_shStrength;
uniform float u_hslHue[6];
uniform float u_hslSat[6];
uniform float u_hslLum[6];
uniform float u_sharpening;
uniform float u_vignette;
uniform float u_grain;
uniform float u_splitPos;  // -1 = off, 0-1 = before/after split position

in vec2 v_uv;
out vec4 fragColor;

// ── HSL helpers ──────────────────────────────────────────────────────────────

vec3 rgb2hsl(vec3 c) {
  float mx = max(c.r, max(c.g, c.b));
  float mn = min(c.r, min(c.g, c.b));
  float l  = (mx + mn) * 0.5;
  if (mx == mn) return vec3(0.0, 0.0, l);
  float d = mx - mn;
  float s = l > 0.5 ? d / (2.0 - mx - mn) : d / (mx + mn);
  float h;
  if      (mx == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
  else if (mx == c.g) h = (c.b - c.r) / d + 2.0;
  else                h = (c.r - c.g) / d + 4.0;
  return vec3(h / 6.0, s, l);
}

float h2rgb(float p, float q, float t) {
  t = fract(t);
  if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
  if (t < 0.5)     return q;
  if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
  return p;
}

vec3 hsl2rgb(vec3 hsl) {
  float h = hsl.x, s = hsl.y, l = hsl.z;
  if (s == 0.0) return vec3(l);
  float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
  float p = 2.0 * l - q;
  return vec3(h2rgb(p, q, h + 1.0/3.0), h2rgb(p, q, h), h2rgb(p, q, h - 1.0/3.0));
}

// ── Filter ops ───────────────────────────────────────────────────────────────

vec3 doExposure(vec3 c, float ev) {
  return clamp(c * pow(2.0, ev), 0.0, 1.0);
}

float contrastCurve(float v, float k) {
  float n = v - 0.5;
  float base = max(abs(2.0 * n), 0.0001);
  float s    = 0.5 * pow(base, 1.0 + k);
  return clamp((n < 0.0 ? -s : s) + 0.5, 0.0, 1.0);
}

vec3 doContrast(vec3 c, float contrast) {
  float k = contrast / 100.0;
  return vec3(contrastCurve(c.r, k), contrastCurve(c.g, k), contrastCurve(c.b, k));
}

vec3 doToneCurve(vec3 c, float highlights, float shadows) {
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  float hw  = lum * lum;
  float sw  = (1.0 - lum) * (1.0 - lum);
  float adj = (highlights / 100.0) * hw  * (40.0 / 255.0)
            + (shadows    / 100.0) * sw  * (40.0 / 255.0);
  return clamp(c + adj, 0.0, 1.0);
}

vec3 doWarmthTint(vec3 c, float warmth, float tint) {
  float w = warmth / 100.0 * (30.0 / 255.0);
  float t = tint   / 100.0 * (20.0 / 255.0);
  return clamp(c + vec3(w, t, -w), 0.0, 1.0);
}

// Saturation, vibrance, per-hue HSL — all in one HSL round-trip
vec3 doColorPass(vec3 c, float saturation, float vibrance) {
  vec3  hsl = rgb2hsl(c);
  float h = hsl.x, s = hsl.y, l = hsl.z;

  // Saturation
  s = clamp(s * (1.0 + saturation / 100.0), 0.0, 1.0);

  // Vibrance (selective saturation — boosts less-saturated pixels more)
  float boost = (vibrance / 100.0) * (1.0 - s);
  s = clamp(s + boost * 0.6, 0.0, 1.0);

  // Per-hue HSL (6 zones)
  if (s > 0.02) {
    float centers[6];
    centers[0] = 0.0;   centers[1] = 0.083; centers[2] = 0.167;
    centers[3] = 0.333; centers[4] = 0.5;   centers[5] = 0.667;

    float widths[6];
    widths[0] = 0.10; widths[1] = 0.067; widths[2] = 0.067;
    widths[3] = 0.133; widths[4] = 0.10; widths[5] = 0.133;

    float dH = 0.0, dS = 0.0, dL = 0.0;

    for (int z = 0; z < 6; z++) {
      float d  = abs(h - centers[z]);
      if (d > 0.5) d = 1.0 - d;
      float wt = max(0.0, 1.0 - pow(d / widths[z], 2.0));
      if (wt < 0.01) continue;
      dH += wt * u_hslHue[z];           // already in 0-1 units (divided by 360 on CPU)
      dS += wt * u_hslSat[z] / 100.0;
      dL += wt * u_hslLum[z] / 100.0;
    }

    h = fract(h + dH + 1.0);
    s = clamp(s + dS * s, 0.0, 1.0);
    l = clamp(l + dL * 0.3, 0.0, 1.0);
  }

  return clamp(hsl2rgb(vec3(h, s, l)), 0.0, 1.0);
}

vec3 doSplitTone(vec3 c, float hiHue, float hiStr, float shHue, float shStr) {
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  float hw  = pow(lum, 2.0)        * (hiStr / 100.0) * 0.3;
  float sw  = pow(1.0 - lum, 2.0) * (shStr / 100.0) * 0.3;
  vec3 hiCol = hsl2rgb(vec3(hiHue / 360.0, 1.0, 0.5));
  vec3 shCol = hsl2rgb(vec3(shHue / 360.0, 1.0, 0.5));
  return clamp(c + (hiCol - 0.5) * hw + (shCol - 0.5) * sw, 0.0, 1.0);
}

vec3 doVignette(vec3 c, vec2 uv, float amount) {
  vec2  d    = uv - 0.5;
  float dist = length(d) / 0.7071;
  float f    = 1.0 - (amount / 100.0) * pow(dist, 2.0) * 1.5;
  return clamp(c * f, 0.0, 1.0);
}

vec3 doGrain(vec3 c, vec2 uv, float amount) {
  // Stable, position-based hash noise — matches film grain character
  vec2  p    = fract(uv * vec2(234.34, 435.345));
  p         += dot(p, p + 34.23);
  float n    = fract(p.x * p.y) - 0.5;
  float lum  = dot(c, vec3(0.299, 0.587, 0.114));
  float vis  = max(0.0, 1.0 - abs(lum - 0.45) * 1.6);
  float g    = n * (amount / 100.0) * vis * (70.0 / 255.0);
  return clamp(c + g, 0.0, 1.0);
}

// ── Main ─────────────────────────────────────────────────────────────────────

void main() {
  vec2 uv = v_uv;

  // Sample with optional sharpening (unsharp mask on source)
  vec3 col = texture(u_image, uv).rgb;

  if (u_sharpening > 0.0) {
    vec2 tx = 1.0 / u_texSize;
    vec3 n  = texture(u_image, uv + vec2(0.0,  tx.y)).rgb;
    vec3 s  = texture(u_image, uv + vec2(0.0, -tx.y)).rgb;
    vec3 e  = texture(u_image, uv + vec2( tx.x, 0.0)).rgb;
    vec3 w  = texture(u_image, uv + vec2(-tx.x, 0.0)).rgb;
    col = clamp(col + (col * 4.0 - n - s - e - w) * u_sharpening * 0.005, 0.0, 1.0);
  }

  col = doExposure(col, u_exposure);
  col = doContrast(col, u_contrast);
  col = doToneCurve(col, u_highlights, u_shadows);
  col = doWarmthTint(col, u_warmth, u_tint);
  col = doColorPass(col, u_saturation, u_vibrance);
  col = doSplitTone(col, u_hiHue, u_hiStrength, u_shHue, u_shStrength);
  col = doVignette(col, uv, u_vignette);
  col = doGrain(col, uv, u_grain);

  // Before/after split: left of splitPos shows original
  if (u_splitPos >= 0.0 && v_uv.x < u_splitPos) {
    col = texture(u_image, uv).rgb;
  }

  fragColor = vec4(col, 1.0);
}`

// ── Renderer ─────────────────────────────────────────────────────────────────

const HSL_KEYS = ['reds', 'oranges', 'yellows', 'greens', 'cyans', 'blues']

export class WebGLRenderer {
  constructor(canvas) {
    // preserveDrawingBuffer so canvas.toBlob() works after compositing
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true })
    if (!gl) throw new Error('WebGL2 not supported')
    this.gl = gl
    this.canvas = canvas
    this.texture = null
    this.srcWidth = 1
    this.srcHeight = 1
    this._init()
  }

  _init() {
    const gl = this.gl
    this.program = this._buildProgram(VERT, FRAG)

    // Full-screen triangle strip quad
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW)

    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)
    const posLoc = gl.getAttribLocation(this.program, 'a_position')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)
    this.vao = vao

    // Cache all uniform locations up front
    const names = [
      'u_image', 'u_texSize',
      'u_exposure', 'u_contrast', 'u_highlights', 'u_shadows',
      'u_warmth', 'u_tint', 'u_saturation', 'u_vibrance',
      'u_hiHue', 'u_hiStrength', 'u_shHue', 'u_shStrength',
      'u_hslHue', 'u_hslSat', 'u_hslLum',
      'u_sharpening', 'u_vignette', 'u_grain', 'u_splitPos',
    ]
    this.locs = {}
    for (const n of names) this.locs[n] = gl.getUniformLocation(this.program, n)
  }

  loadImage(source) {
    const gl = this.gl
    if (this.texture) gl.deleteTexture(this.texture)

    this.srcWidth  = source.naturalWidth  || source.width
    this.srcHeight = source.naturalHeight || source.height

    this.texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  }

  render(params, splitPos = -1) {
    const { gl, canvas, locs } = this
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.useProgram(this.program)
    gl.bindVertexArray(this.vao)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.uniform1i(locs.u_image, 0)
    gl.uniform2f(locs.u_texSize, this.srcWidth, this.srcHeight)

    gl.uniform1f(locs.u_exposure,     params.exposure         ?? 0)
    gl.uniform1f(locs.u_contrast,     params.contrast         ?? 0)
    gl.uniform1f(locs.u_highlights,   params.highlights       ?? 0)
    gl.uniform1f(locs.u_shadows,      params.shadows          ?? 0)
    gl.uniform1f(locs.u_warmth,       params.warmth           ?? 0)
    gl.uniform1f(locs.u_tint,         params.tint             ?? 0)
    gl.uniform1f(locs.u_saturation,   params.saturation       ?? 0)
    gl.uniform1f(locs.u_vibrance,     params.vibrance         ?? 0)
    gl.uniform1f(locs.u_hiHue,        params.highlightHue     ?? 45)
    gl.uniform1f(locs.u_hiStrength,   params.highlightStrength?? 0)
    gl.uniform1f(locs.u_shHue,        params.shadowHue        ?? 220)
    gl.uniform1f(locs.u_shStrength,   params.shadowStrength   ?? 0)
    gl.uniform1f(locs.u_sharpening,   params.sharpening       ?? 0)
    gl.uniform1f(locs.u_vignette,     params.vignette         ?? 0)
    gl.uniform1f(locs.u_grain,        params.grain            ?? 0)
    gl.uniform1f(locs.u_splitPos,     splitPos)

    // Per-hue HSL — hue values divided by 360 so shader works in 0-1 units
    gl.uniform1fv(locs.u_hslHue, HSL_KEYS.map(k => (params[`${k}Hue`] ?? 0) / 360))
    gl.uniform1fv(locs.u_hslSat, HSL_KEYS.map(k => params[`${k}Sat`] ?? 0))
    gl.uniform1fv(locs.u_hslLum, HSL_KEYS.map(k => params[`${k}Lum`] ?? 0))

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  // Export at full resolution. Creates a temporary canvas/context so the
  // display canvas isn't disturbed.
  exportBlob(params, originalImage, quality = 0.92) {
    return new Promise((resolve, reject) => {
      const exportCanvas = document.createElement('canvas')
      exportCanvas.width  = originalImage.naturalWidth
      exportCanvas.height = originalImage.naturalHeight
      let exportRenderer
      try {
        exportRenderer = new WebGLRenderer(exportCanvas)
        exportRenderer.loadImage(originalImage)
        exportRenderer.render(params)
        exportCanvas.toBlob(
          (blob) => { exportRenderer.destroy(); resolve(blob) },
          'image/jpeg',
          quality
        )
      } catch (e) {
        exportRenderer?.destroy()
        reject(e)
      }
    })
  }

  destroy() {
    const gl = this.gl
    if (this.texture) gl.deleteTexture(this.texture)
    if (this.program) gl.deleteProgram(this.program)
  }

  _buildProgram(vertSrc, fragSrc) {
    const gl = this.gl
    const vs = this._compile(gl.VERTEX_SHADER,   vertSrc)
    const fs = this._compile(gl.FRAGMENT_SHADER, fragSrc)
    const p  = gl.createProgram()
    gl.attachShader(p, vs); gl.attachShader(p, fs)
    gl.linkProgram(p)
    gl.deleteShader(vs); gl.deleteShader(fs)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw new Error('GL link error: ' + gl.getProgramInfoLog(p))
    return p
  }

  _compile(type, src) {
    const gl = this.gl
    const sh = gl.createShader(type)
    gl.shaderSource(sh, src)
    gl.compileShader(sh)
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
      throw new Error('GL compile error: ' + gl.getShaderInfoLog(sh))
    return sh
  }
}
