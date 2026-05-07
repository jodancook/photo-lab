import { useState, useRef, useCallback, useEffect } from 'react'
import { processImage } from '../filters/engine'
import { DEFAULT_PARAMS } from '../filters/presets'

export function usePhotoProcessor() {
  const [originalImage, setOriginalImage] = useState(null)  // HTMLImageElement
  const [params, setParams] = useState({ ...DEFAULT_PARAMS })
  const [processing, setProcessing] = useState(false)
  const sourceCanvasRef = useRef(null)  // holds original pixels, never modified
  const outputCanvasRef = useRef(null)  // displayed to user
  const pendingRef = useRef(null)

  const loadImage = useCallback((file) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      // Store original into source canvas
      const src = document.createElement('canvas')
      src.width = img.naturalWidth
      src.height = img.naturalHeight
      src.getContext('2d').drawImage(img, 0, 0)
      sourceCanvasRef.current = src
      setOriginalImage(img)
      URL.revokeObjectURL(url)
    }
    img.src = url
  }, [])

  const applyParams = useCallback((newParams) => {
    if (!sourceCanvasRef.current || !outputCanvasRef.current) return

    // Debounce: cancel any pending render
    if (pendingRef.current) cancelAnimationFrame(pendingRef.current)

    pendingRef.current = requestAnimationFrame(() => {
      setProcessing(true)
      // Yield to browser paint before heavy work
      setTimeout(() => {
        const result = processImage(sourceCanvasRef.current, newParams)
        const out = outputCanvasRef.current
        if (!out) return
        out.width = result.width
        out.height = result.height
        out.getContext('2d').drawImage(result, 0, 0)
        setProcessing(false)
      }, 0)
    })
  }, [])

  // Re-render whenever params change and an image is loaded
  useEffect(() => {
    if (originalImage) applyParams(params)
  }, [params, originalImage, applyParams])

  const updateParam = useCallback((key, value) => {
    setParams(prev => ({ ...prev, [key]: value }))
  }, [])

  const applyPreset = useCallback((preset) => {
    setParams({ ...preset.params })
  }, [])

  const exportImage = useCallback((filename = 'photo-lab-export.jpg', quality = 0.92) => {
    if (!outputCanvasRef.current) return
    outputCanvasRef.current.toBlob(
      (blob) => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = filename
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 1000)
      },
      'image/jpeg',
      quality
    )
  }, [])

  return {
    originalImage,
    params,
    processing,
    outputCanvasRef,
    loadImage,
    updateParam,
    applyPreset,
    exportImage,
  }
}
