import { useState } from 'react'

const TABS = [
  {
    id: 'light',
    label: 'Light',
    controls: [
      { key: 'exposure',   label: 'Exposure',   min: -3,   max: 3,   step: 0.05 },
      { key: 'contrast',   label: 'Contrast',   min: -100, max: 100, step: 1 },
      { key: 'highlights', label: 'Highlights', min: -100, max: 100, step: 1 },
      { key: 'shadows',    label: 'Shadows',    min: -100, max: 100, step: 1 },
    ],
  },
  {
    id: 'color',
    label: 'Color',
    controls: [
      { key: 'warmth',     label: 'Warmth',     min: -100, max: 100, step: 1 },
      { key: 'tint',       label: 'Tint',       min: -100, max: 100, step: 1 },
      { key: 'saturation', label: 'Saturation', min: -100, max: 100, step: 1 },
      { key: 'vibrance',   label: 'Vibrance',   min: -100, max: 100, step: 1 },
    ],
  },
  {
    id: 'hsl',
    label: 'HSL',
    controls: [
      { key: 'redsHue',    label: 'Reds Hue',      min: -30,  max: 30,  step: 1 },
      { key: 'redsSat',    label: 'Reds Sat',       min: -100, max: 100, step: 1 },
      { key: 'orangesSat', label: 'Oranges Sat',    min: -100, max: 100, step: 1 },
      { key: 'yellowsSat', label: 'Yellows Sat',    min: -100, max: 100, step: 1 },
      { key: 'greensHue',  label: 'Greens Hue',     min: -30,  max: 30,  step: 1 },
      { key: 'greensSat',  label: 'Greens Sat',     min: -100, max: 100, step: 1 },
      { key: 'cyansSat',   label: 'Cyans Sat',      min: -100, max: 100, step: 1 },
      { key: 'bluesHue',   label: 'Blues Hue',      min: -30,  max: 30,  step: 1 },
      { key: 'bluesSat',   label: 'Blues Sat',      min: -100, max: 100, step: 1 },
      { key: 'bluesLum',   label: 'Blues Lum',      min: -100, max: 100, step: 1 },
    ],
  },
  {
    id: 'split',
    label: 'Split',
    controls: [
      { key: 'highlightHue',      label: 'Hi Hue',    min: 0,   max: 360, step: 1 },
      { key: 'highlightStrength', label: 'Hi Amount', min: 0,   max: 100, step: 1 },
      { key: 'shadowHue',         label: 'Sh Hue',    min: 0,   max: 360, step: 1 },
      { key: 'shadowStrength',    label: 'Sh Amount', min: 0,   max: 100, step: 1 },
    ],
  },
  {
    id: 'fx',
    label: 'FX',
    controls: [
      { key: 'grain',      label: 'Grain',      min: 0, max: 100, step: 1 },
      { key: 'vignette',   label: 'Vignette',   min: 0, max: 100, step: 1 },
      { key: 'sharpening', label: 'Sharpening', min: 0, max: 100, step: 1 },
    ],
  },
]

function Slider({ control, value, onUpdate }) {
  const { key, label, min, max, step } = control
  const val = value ?? 0
  // Percentage for the track fill
  const pct = ((val - min) / (max - min)) * 100

  return (
    <div className="control-row">
      <span className="control-label">{label}</span>
      <div className="slider-track-wrap">
        <div className="slider-fill" style={{ width: `${pct}%` }} />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={val}
          onChange={e => onUpdate(key, parseFloat(e.target.value))}
          className="control-slider"
        />
      </div>
      <span className="control-value">
        {step < 1 ? val.toFixed(2) : val}
      </span>
    </div>
  )
}

export function AdjustmentPanel({ params, onUpdate }) {
  const [activeTab, setActiveTab] = useState('light')
  const tab = TABS.find(t => t.id === activeTab)

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
      <div className="tab-content">
        {tab.controls.map(control => (
          <Slider
            key={control.key}
            control={control}
            value={params[control.key]}
            onUpdate={onUpdate}
          />
        ))}
      </div>
    </div>
  )
}
