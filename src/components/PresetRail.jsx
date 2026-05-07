import { PRESETS } from '../filters/presets'

export function PresetRail({ activeId, onSelect }) {
  return (
    <div className="preset-rail">
      {PRESETS.map(preset => (
        <button
          key={preset.id}
          className={`preset-btn ${activeId === preset.id ? 'active' : ''}`}
          onClick={() => onSelect(preset)}
        >
          {preset.name}
        </button>
      ))}
    </div>
  )
}
