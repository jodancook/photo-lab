import { useState, useRef, useCallback, useEffect } from 'react'
import { WebGLRenderer } from '../filters/webgl-renderer'
import { DEFAULT_PARAMS } from '../filters/presets'

const DISPLAY_MAX = 1200  // canvas display size (GPU renders this in <10ms)

export function usePhotoProcessor() {
  const [originalImage, setOriginalImage] = useState(null)
  const [params, setParams]               = useState({ ...DEFAULT_PARAMS })
  const [exporting, setExporting]         = useState(false)

  const outputCanvasRef = useRef(null)
  const rendererRef     = useRef(null)
  const rafRef          = useRef(null)

  // Tear down renderer on unmount
  useEffect(() => () => rendererRef.current?.destroy(), [])

  const loadImage = useCallback((file) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      setOriginalImage(img)
    }
    img.src = url
  }, [])

  // Once the image is set, size the canvas and initialise/reload the renderer.
  // The canvas is only in the DOM after originalImage is truthy, so this
  // effect runs after React has mounted it.
  useEffect(() => {
    if (!originalImage) return
    const canvas = outputCanvasRef.current
    if (!canvas) return

    // Size canvas to preview dimensions
    const scale   = Math.min(1, DISPLAY_MAX / Math.max(originalImage.naturalWidth, originalImage.naturalHeight))
    canvas.width  = Math.round(originalImage.naturalWidth  * scale)
    canvas.height = Math.round(originalImage.naturalHeight * scale)

    // Init renderer once, reload image on subsequent loads
    if (!rendererRef.current) {
      rendererRef.current = new WebGLRenderer(canvas)
    }
    rendererRef.current.loadImage(originalImage)
  }, [originalImage])

  // Render on every params change (RAF-batched so multiple updates in one tick
  // produce only one draw call — no queue, no backlog)
  useEffect(() => {
    if (!originalImage || !rendererRef.current) return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      rendererRef.current?.render(params)
    })
  }, [params, originalImage])

  const clearImage = useCallback(() => {
    rendererRef.current?.destroy()
    rendererRef.current = null
    setOriginalImage(null)
    setParams({ ...DEFAULT_PARAMS })
  }, [])

  const updateParam = useCallback((key, value) => {
    setParams(prev => ({ ...prev, [key]: value }))
  }, [])

  const applyPreset = useCallback((preset) => {
    setParams({ ...preset.params })
  }, [])

  const exportImage = useCallback(async (filename = 'photo-lab-export.jpg', quality = 0.92) => {
    if (!originalImage || !rendererRef.current) return
    setExporting(true)
    try {
      const blob = await rendererRef.current.exportBlob(params, originalImage, quality)
      const file = new File([blob], filename, { type: 'image/jpeg' })

      // On iOS Safari: use Web Share API so the system sheet appears and
      // the user can save directly to Photos, AirDrop, etc.
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Photo Lab export' })
      } else {
        // Desktop / unsupported: fall back to regular download
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = filename
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 1000)
      }
    } finally {
      setExporting(false)
    }
  }, [params, originalImage])

  return {
    originalImage,
    params,
    exporting,
    outputCanvasRef,
    loadImage,
    clearImage,
    updateParam,
    applyPreset,
    exportImage,
  }
}
