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
    exporting,
    outputCanvasRef,
    loadImage,
    clearImage,
    updateParam,
    applyPreset,
    exportImage,
  } = usePhotoProcessor()

  const [activePresetId, setActivePresetId] = useState('none')

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
        <div className="header-actions">
          {originalImage && (
            <button className="btn-new" onClick={clearImage}>New</button>
          )}
          {originalImage && (
            <button
              className={`btn-export ${exporting ? 'loading' : ''}`}
              onClick={() => exportImage()}
              disabled={exporting}
            >
              {exporting ? 'Saving…' : 'Export'}
            </button>
          )}
        </div>
      </header>

      <main className="app-main">
        {!originalImage ? (
          <UploadZone onFile={loadImage} />
        ) : (
          <div className="canvas-wrapper">
            <canvas ref={outputCanvasRef} className="output-canvas" />
          </div>
        )}
      </main>

      {originalImage && (
        <footer className="app-footer">
          <PresetRail activeId={activePresetId} onSelect={handlePreset} />
          <AdjustmentPanel params={params} onUpdate={handleUpdate} />
        </footer>
      )}
    </div>
  )
}
