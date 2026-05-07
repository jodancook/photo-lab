import { useState } from 'react'

const TABS = [
  { id: 'light', label: 'Light' },
  { id: 'color', label: 'Color' },
  { id: 'hsl',   label: 'HSL'   },
  { id: 'split', label: 'Split' },
  { id: 'fx',    label: 'FX'    },
]

const TAB_CONTROLS = {
  light: [
    { key: 'exposure',   label: 'Exposure',   min: -3,   max: 3,   step: 0.05 },
    { key: 'contrast',   label: 'Contrast',   min: -100, max: 100, step: 1 },
    { key: 'highlights', label: 'Highlights', min: -100, max: 100, step: 1 },
    { key: 'shadows',    label: 'Shadows',    min: -100, max: 100, step: 1 },
  ],
  color: [
    { key: 'warmth',     label: 'Warmth',     min: -100, max: 100, step: 1 },
    { key: 'tint',       label: 'Tint',       min: -100, max: 100, step: 1 },
    { key: 'saturation', label: 'Saturation', min: -100, max: 100, step: 1 },
    { key: 'vibrance',   label: 'Vibrance',   min: -100, max: 100, step: 1 },
  ],
  split: [
    { key: 'highlightHue',      label: 'Hi Hue',    min: 0,   max: 360, step: 1 },
    { key: 'highlightStrength', label: 'Hi Amount', min: 0,   max: 100, step: 1 },
    { key: 'shadowHue',         label: 'Sh Hue',    min: 0,   max: 360, step: 1 },
    { key: 'shadowStrength',    label: 'Sh Amount', min: 0,   max: 100, step: 1 },
  ],
  fx: [
    { key: 'grain',      label: 'Grain',      min: 0, max: 100, step: 1 },
    { key: 'vignette',   label: 'Vignette',   min: 0, max: 100, step: 1 },
    { key: 'sharpening', label: 'Sharpening', min: 0, max: 100, step: 1 },
  ],
}

// HSL tab: grouped by hue zone with colour coding
const HSL_GROUPS = [
  { key: 'reds',    label: 'Reds',    color: '#f87171' },
  { key: 'oranges', label: 'Oranges', color: '#fb923c' },
  { key: 'yellows', label: 'Yellows', color: '#fbbf24' },
  { key: 'greens',  label: 'Greens',  color: '#4ade80' },
  { key: 'cyans',   label: 'Cyans',   color: '#22d3ee' },
  { key: 'blues',   label: 'Blues',   color: '#60a5fa' },
]

const HSL_SLIDERS = [
  { suffix: 'Hue', label: 'Hue', min: -30,  max: 30,  step: 1 },
  { suffix: 'Sat', label: 'Sat', min: -100, max: 100, step: 1 },
  { suffix: 'Lum', label: 'Lum', min: -100, max: 100, step: 1 },
]

function Slider({ paramKey, label, min, max, step, value, color, onUpdate }) {
  const val = value ?? 0
  const pct = ((val - min) / (max - min)) * 100

  return (
    <div className="control-row">
      <span className="control-label">{label}</span>
      <div className="slider-track-wrap">
        <div className="slider-fill" style={{ width: `${pct}%`, background: color || 'var(--accent)' }} />
        <input
          type="range"
          min={min} max={max} step={step}
          value={val}
          onChange={e => onUpdate(paramKey, parseFloat(e.target.value))}
          className="control-slider"
          style={color ? { '--thumb-color': color } : undefined}
        />
      </div>
      <span className="control-value">
        {step < 1 ? val.toFixed(2) : val}
      </span>
    </div>
  )
}

function HslTab({ params, onUpdate }) {
  return (
    <div className="tab-content">
      {HSL_GROUPS.map(group => (
        <div key={group.key} className="hsl-group">
          <div className="hsl-group-header">
            <span className="hsl-swatch" style={{ background: group.color }} />
            <span className="hsl-group-label" style={{ color: group.color }}>{group.label}</span>
          </div>
          {HSL_SLIDERS.map(sl => (
            <Slider
              key={sl.suffix}
              paramKey={`${group.key}${sl.suffix}`}
              label={sl.label}
              min={sl.min} max={sl.max} step={sl.step}
              value={params[`${group.key}${sl.suffix}`]}
              color={group.color}
              onUpdate={onUpdate}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function AdjustmentPanel({ params, onUpdate }) {
  const [activeTab, setActiveTab] = useState('light')

  return (
    <div className="adjustment-panel">
      <div className="tab-bar">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'hsl' ? (
        <HslTab params={params} onUpdate={onUpdate} />
      ) : (
        <div className="tab-content">
          {(TAB_CONTROLS[activeTab] ?? []).map(ctrl => (
            <Slider
              key={ctrl.key}
              paramKey={ctrl.key}
              label={ctrl.label}
              min={ctrl.min} max={ctrl.max} step={ctrl.step}
              value={params[ctrl.key]}
              onUpdate={onUpdate}
            />
          ))}
        </div>
      )}
    </div>
  )
}
