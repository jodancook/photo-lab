// Core pixel processing engine.
// All adjustments operate per-pixel using pre-built LUTs for channel ops,
// falling back to per-pixel math for luminance-dependent ops.

function clamp(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v
}

function linearize(v) {
  return v / 255
}

function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return [h / 6, s, l]
}

function hsl2rgb(h, s, l) {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v] }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const hue2 = (t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }
  return [
    Math.round(hue2(h + 1/3) * 255),
    Math.round(hue2(h) * 255),
    Math.round(hue2(h - 1/3) * 255),
  ]
}

// Applies an S-curve contrast to a 0-255 value
function contrastLUT(contrast) {
  const lut = new Uint8Array(256)
  const k = contrast / 100
  for (let i = 0; i < 256; i++) {
    const n = i / 255 - 0.5
    const s = n < 0
      ? -0.5 * Math.pow(-2 * n, 1 + k)
      : 0.5 * Math.pow(2 * n, 1 + k)
    lut[i] = clamp(Math.round((s + 0.5) * 255))
  }
  return lut
}

// Exposure: EV shift, -3 to +3
function exposureLUT(ev) {
  const lut = new Uint8Array(256)
  const mult = Math.pow(2, ev)
  for (let i = 0; i < 256; i++) {
    lut[i] = clamp(Math.round(i * mult))
  }
  return lut
}

// Highlights/shadows: lifted from a simple luminance-based blend
function applyToneCurve(r, g, b, highlights, shadows) {
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  const lumN = lum / 255

  // Highlight weight: pixels near white
  const hw = Math.pow(lumN, 2)
  // Shadow weight: pixels near black
  const sw = Math.pow(1 - lumN, 2)

  const hAdj = (highlights / 100) * hw * 40
  const sAdj = (shadows / 100) * sw * 40

  return [
    clamp(r + hAdj + sAdj),
    clamp(g + hAdj + sAdj),
    clamp(b + hAdj + sAdj),
  ]
}

// Warmth: positive = warmer (more red, less blue)
function applyWarmth(r, g, b, warmth) {
  const w = (warmth / 100) * 30
  return [clamp(r + w), g, clamp(b - w)]
}

// Tint: positive = green, negative = magenta
function applyTint(r, g, b, tint) {
  const t = (tint / 100) * 20
  return [r, clamp(g + t), b]
}

// Saturation: -100 = grayscale, +100 = double saturation
function applySaturation(r, g, b, saturation) {
  const [h, s, l] = rgb2hsl(r, g, b)
  const newS = Math.max(0, Math.min(1, s * (1 + saturation / 100)))
  return hsl2rgb(h, newS, l)
}

// Vibrance: boosts saturation of less-saturated colors more than already saturated ones
function applyVibrance(r, g, b, vibrance) {
  const [h, s, l] = rgb2hsl(r, g, b)
  const boost = (vibrance / 100) * (1 - s)
  const newS = Math.max(0, Math.min(1, s + boost * 0.6))
  return hsl2rgb(h, newS, l)
}

// Split toning: tint highlights and shadows with separate colors
// highlightHue/shadowHue: 0-360, strength: 0-100
function applySplitTone(r, g, b, highlightHue, highlightStrength, shadowHue, shadowStrength) {
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  const hw = Math.pow(lum, 2) * (highlightStrength / 100) * 0.3
  const sw = Math.pow(1 - lum, 2) * (shadowStrength / 100) * 0.3

  const [hR, hG, hB] = hsl2rgb(highlightHue / 360, 1, 0.5)
  const [sR, sG, sB] = hsl2rgb(shadowHue / 360, 1, 0.5)

  return [
    clamp(r + (hR - 128) * hw + (sR - 128) * sw),
    clamp(g + (hG - 128) * hw + (sG - 128) * sw),
    clamp(b + (hB - 128) * hw + (sB - 128) * sw),
  ]
}

// Per-hue HSL adjustments (6 hue zones, smooth blending between them)
const HUE_ZONES = [
  { key: 'reds',    center: 0,     width: 0.10 },
  { key: 'oranges', center: 0.083, width: 0.067 },
  { key: 'yellows', center: 0.167, width: 0.067 },
  { key: 'greens',  center: 0.333, width: 0.133 },
  { key: 'cyans',   center: 0.5,   width: 0.10 },
  { key: 'blues',   center: 0.667, width: 0.133 },
]

function hueWeight(h, center, width) {
  let d = Math.abs(h - center)
  if (d > 0.5) d = 1 - d
  return Math.max(0, 1 - Math.pow(d / width, 2))
}

function applyHSL(r, g, b, params) {
  let [h, s, l] = rgb2hsl(r, g, b)
  if (s < 0.02) return [r, g, b]  // skip near-neutral pixels

  let dH = 0, dSMult = 0, dL = 0, totalW = 0

  for (const zone of HUE_ZONES) {
    const w = hueWeight(h, zone.center, zone.width)
    if (w < 0.01) continue
    dH     += w * (params[`${zone.key}Hue`] ?? 0) / 360
    dSMult += w * (params[`${zone.key}Sat`] ?? 0) / 100
    dL     += w * (params[`${zone.key}Lum`] ?? 0) / 100
    totalW += w
  }

  if (totalW < 0.01) return [r, g, b]

  h = ((h + dH) % 1 + 1) % 1
  s = Math.max(0, Math.min(1, s + dSMult * s))
  l = Math.max(0, Math.min(1, l + dL * 0.3))

  return hsl2rgb(h, s, l)
}

// Film grain: luminosity-weighted noise, heavier in midtones (matches real film)
function applyGrain(data, amount) {
  if (amount === 0) return
  const strength = amount / 100
  for (let i = 0; i < data.length; i += 4) {
    const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255
    const visibility = Math.max(0, 1 - Math.abs(lum - 0.45) * 1.6)
    const noise = (Math.random() - 0.5) * strength * visibility * 70
    data[i]     = clamp(data[i]     + noise)
    data[i + 1] = clamp(data[i + 1] + noise)
    data[i + 2] = clamp(data[i + 2] + noise)
  }
}

// Sharpening: simple unsharp mask on luminance channel
// (applied as a post-pass, requires full ImageData)
function applySharpening(data, width, height, amount) {
  if (amount === 0) return
  const factor = amount / 100
  const copy = new Uint8ClampedArray(data)

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4
      for (let c = 0; c < 3; c++) {
        const neighbors =
          copy[((y - 1) * width + x) * 4 + c] +
          copy[((y + 1) * width + x) * 4 + c] +
          copy[(y * width + x - 1) * 4 + c] +
          copy[(y * width + x + 1) * 4 + c]
        const laplacian = copy[i + c] * 4 - neighbors
        data[i + c] = clamp(data[i + c] + laplacian * factor * 0.5)
      }
    }
  }
}

// Vignette: darkens corners
function applyVignette(data, width, height, amount) {
  if (amount === 0) return
  const cx = width / 2, cy = height / 2
  const maxDist = Math.sqrt(cx * cx + cy * cy)
  const strength = amount / 100

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const dx = x - cx, dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy) / maxDist
      const factor = 1 - strength * Math.pow(dist, 2) * 1.5
      data[i] = clamp(data[i] * factor)
      data[i + 1] = clamp(data[i + 1] * factor)
      data[i + 2] = clamp(data[i + 2] * factor)
    }
  }
}

// Core processing on raw ImageData — safe to call from a Web Worker.
export function processImageData(imageData, params) {
  const { data, width, height } = imageData
  const out = new Uint8ClampedArray(data)

  const expLUT = exposureLUT(params.exposure ?? 0)
  const conLUT = contrastLUT(params.contrast ?? 0)

  for (let i = 0; i < out.length; i += 4) {
    let r = data[i], g = data[i + 1], b = data[i + 2]

    r = expLUT[r]; g = expLUT[g]; b = expLUT[b]
    r = conLUT[r]; g = conLUT[g]; b = conLUT[b]
    ;[r, g, b] = applyToneCurve(r, g, b, params.highlights ?? 0, params.shadows ?? 0)
    ;[r, g, b] = applyWarmth(r, g, b, params.warmth ?? 0)
    ;[r, g, b] = applyTint(r, g, b, params.tint ?? 0)
    ;[r, g, b] = applySaturation(r, g, b, params.saturation ?? 0)
    ;[r, g, b] = applyVibrance(r, g, b, params.vibrance ?? 0)
    ;[r, g, b] = applyHSL(r, g, b, params)
    ;[r, g, b] = applySplitTone(
      r, g, b,
      params.highlightHue ?? 45, params.highlightStrength ?? 0,
      params.shadowHue ?? 220, params.shadowStrength ?? 0
    )

    out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = data[i + 3]
  }

  applySharpening(out, width, height, params.sharpening ?? 0)
  applyVignette(out, width, height, params.vignette ?? 0)
  applyGrain(out, params.grain ?? 0)

  return new ImageData(out, width, height)
}

// Canvas convenience wrapper (main thread only).
export function processImage(sourceCanvas, params) {
  const { width, height } = sourceCanvas
  const ctx = sourceCanvas.getContext('2d')
  const imageData = ctx.getImageData(0, 0, width, height)
  const result = processImageData(imageData, params)
  const offscreen = document.createElement('canvas')
  offscreen.width = width
  offscreen.height = height
  offscreen.getContext('2d').putImageData(result, 0, 0)
  return offscreen
}
