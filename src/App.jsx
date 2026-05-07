import { useState, useCallback } from 'react'
import { usePhotoProcessor } from './hooks/usePhotoProcessor'
import { UploadZone } from './components/UploadZone'
import { PresetRail } from './components/PresetRail'
import { AdjustmentPanel } from './components/AdjustmentPanel'
import { CompareSlider } from './components/CompareSlider'
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
    setSplitPos,
  } = usePhotoProcessor()

  const [activePresetId, setActivePresetId] = useState('none')
  const [comparing, setComparing]           = useState(false)
  const [splitPos, setSplitPosState]        = useState(0.5)

  const handlePreset = useCallback((preset) => {
    setActivePresetId(preset.id)
    applyPreset(preset)
  }, [applyPreset])

  const handleUpdate = useCallback((key, value) => {
    setActivePresetId('custom')
    updateParam(key, value)
  }, [updateParam])

  const toggleCompare = useCallback(() => {
    setComparing(prev => {
      const next = !prev
      setSplitPos(next ? 0.5 : -1)
      return next
    })
  }, [setSplitPos])

  const handleSplitChange = useCallback((pos) => {
    setSplitPosState(pos)
    setSplitPos(pos)
  }, [setSplitPos])

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
              className={`btn-compare ${comparing ? 'active' : ''}`}
              onClick={toggleCompare}
            >
              Compare
            </button>
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
            <div className="canvas-inner">
              <canvas ref={outputCanvasRef} className="output-canvas" />
              {comparing && (
                <CompareSlider pos={splitPos} onChange={handleSplitChange} />
              )}
            </div>
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
