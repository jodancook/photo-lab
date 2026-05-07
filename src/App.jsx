import { useState, useCallback } from 'react'
import { usePhotoProcessor } from './hooks/usePhotoProcessor'
import { UploadZone } from './components/UploadZone'
import { PresetRail } from './components/PresetRail'
import { AdjustmentPanel } from './components/AdjustmentPanel'
import './App.css'

export default function App() {
  const {
    originalImage,
    params,
    processing,
    outputCanvasRef,
    loadImage,
    updateParam,
    applyPreset,
    exportImage,
  } = usePhotoProcessor()

  const [activePresetId, setActivePresetId] = useState('none')
  const [panelOpen, setPanelOpen] = useState(false)

  const handlePreset = useCallback((preset) => {
    setActivePresetId(preset.id)
    applyPreset(preset)
  }, [applyPreset])

  const handleUpdate = useCallback((key, value) => {
    setActivePresetId('custom')
    updateParam(key, value)
  }, [updateParam])

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">Photo Lab</span>
        {originalImage && (
          <div className="header-actions">
            <button className="btn-ghost" onClick={() => setPanelOpen(p => !p)}>
              {panelOpen ? 'Hide' : 'Adjust'}
            </button>
            <button className="btn-primary" onClick={() => exportImage()}>
              Export
            </button>
          </div>
        )}
      </header>

      <main className="app-main">
        {!originalImage ? (
          <UploadZone onFile={loadImage} />
        ) : (
          <div className="canvas-wrapper">
            {processing && <div className="processing-overlay">Processing...</div>}
            <canvas
              ref={outputCanvasRef}
              className="output-canvas"
            />
          </div>
        )}
      </main>

      {originalImage && (
        <footer className="app-footer">
          <PresetRail activeId={activePresetId} onSelect={handlePreset} />
          {panelOpen && (
            <AdjustmentPanel params={params} onUpdate={handleUpdate} />
          )}
        </footer>
      )}
    </div>
  )
}
