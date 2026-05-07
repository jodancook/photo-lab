const CONTROLS = [
  { key: 'exposure',          label: 'Exposure',          min: -3,   max: 3,   step: 0.05 },
  { key: 'contrast',          label: 'Contrast',          min: -100, max: 100, step: 1 },
  { key: 'highlights',        label: 'Highlights',        min: -100, max: 100, step: 1 },
  { key: 'shadows',           label: 'Shadows',           min: -100, max: 100, step: 1 },
  { key: 'warmth',            label: 'Warmth',            min: -100, max: 100, step: 1 },
  { key: 'tint',              label: 'Tint',              min: -100, max: 100, step: 1 },
  { key: 'saturation',        label: 'Saturation',        min: -100, max: 100, step: 1 },
  { key: 'vibrance',          label: 'Vibrance',          min: -100, max: 100, step: 1 },
  { key: 'sharpening',        label: 'Sharpening',        min: 0,    max: 100, step: 1 },
  { key: 'vignette',          label: 'Vignette',          min: 0,    max: 100, step: 1 },
  { key: 'highlightHue',      label: 'Highlight Hue',     min: 0,    max: 360, step: 1 },
  { key: 'highlightStrength', label: 'Highlight Toning',  min: 0,    max: 100, step: 1 },
  { key: 'shadowHue',         label: 'Shadow Hue',        min: 0,    max: 360, step: 1 },
  { key: 'shadowStrength',    label: 'Shadow Toning',     min: 0,    max: 100, step: 1 },
]

export function AdjustmentPanel({ params, onUpdate }) {
  return (
    <div className="adjustment-panel">
      {CONTROLS.map(({ key, label, min, max, step }) => (
        <div key={key} className="control-row">
          <label className="control-label">{label}</label>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={params[key] ?? 0}
            onChange={e => onUpdate(key, parseFloat(e.target.value))}
            className="control-slider"
          />
          <span className="control-value">{
            Number.isInteger(params[key]) ? params[key] : (params[key] ?? 0).toFixed(2)
          }</span>
        </div>
      ))}
    </div>
  )
}
