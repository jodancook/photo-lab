import { useState, useRef, useCallback, useEffect } from 'react'
import { processImage } from '../filters/engine'
import { DEFAULT_PARAMS } from '../filters/presets'

// Preview is capped at this size — keeps real-time edits fast.
// Full-res source is only used for export.
const PREVIEW_MAX = 900

function makeScaledCanvas(img, maxPx) {
  const scale = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.round(img.naturalWidth * scale)
  const h = Math.round(img.naturalHeight * scale)
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  c.getContext('2d').drawImage(img, 0, 0, w, h)
  return c
}

export function usePhotoProcessor() {
  const [originalImage, setOriginalImage] = useState(null)
  const [params, setParams] = useState({ ...DEFAULT_PARAMS })
  const [processing, setProcessing] = useState(false)
  const [exporting, setExporting] = useState(false)

  const sourceCanvasRef  = useRef(null)   // full-res, export only
  const previewCanvasRef = useRef(null)   // scaled-down, real-time edits
  const outputCanvasRef  = useRef(null)   // displayed canvas element
  const workerRef        = useRef(null)
  const pendingIdRef     = useRef(0)      // monotonic counter to discard stale results

  // Spin up the worker once
  useEffect(() => {
    const w = new Worker(
      new URL('../workers/processor.worker.js', import.meta.url),
      { type: 'module' }
    )
    workerRef.current = w
    return () => w.terminate()
  }, [])

  const loadImage = useCallback((file) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      sourceCanvasRef.current  = makeScaledCanvas(img, Infinity)
      previewCanvasRef.current = makeScaledCanvas(img, PREVIEW_MAX)
      setOriginalImage(img)
      URL.revokeObjectURL(url)
    }
    img.src = url
  }, [])

  const renderWithParams = useCallback((newParams, sourceCanvas) => {
    const worker = workerRef.current
    const out    = outputCanvasRef.current
    if (!worker || !sourceCanvas || !out) return

    const id = ++pendingIdRef.current
    setProcessing(true)

    const ctx = sourceCanvas.getContext('2d')
    const imageData = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height)

    // Transfer the underlying buffer to the worker (zero-copy)
    worker.postMessage(
      { pixels: imageData.data.buffer, width: sourceCanvas.width, height: sourceCanvas.height, params: newParams },
      [imageData.data.buffer]
    )

    worker.onmessage = ({ data: { pixels, width, height } }) => {
      // Drop stale results if newer render was queued
      if (id !== pendingIdRef.current) return
      const result = new ImageData(new Uint8ClampedArray(pixels), width, height)
      out.width  = width
      out.height = height
      out.getContext('2d').putImageData(result, 0, 0)
      setProcessing(false)
    }
  }, [])

  useEffect(() => {
    if (originalImage) renderWithParams(params, previewCanvasRef.current)
  }, [params, originalImage, renderWithParams])

  const updateParam = useCallback((key, value) => {
    setParams(prev => ({ ...prev, [key]: value }))
  }, [])

  const applyPreset = useCallback((preset) => {
    setParams({ ...preset.params })
  }, [])

  const exportImage = useCallback((filename = 'photo-lab-export.jpg', quality = 0.92) => {
    if (!sourceCanvasRef.current) return
    setExporting(true)
    // Process full-res on main thread (one-shot, acceptable wait for export)
    setTimeout(() => {
      const result = processImage(sourceCanvasRef.current, params)
      result.toBlob(
        (blob) => {
          const a = document.createElement('a')
          a.href = URL.createObjectURL(blob)
          a.download = filename
          a.click()
          setTimeout(() => URL.revokeObjectURL(a.href), 1000)
          setExporting(false)
        },
        'image/jpeg',
        quality
      )
    }, 50)
  }, [params])

  return {
    originalImage,
    params,
    processing,
    exporting,
    outputCanvasRef,
    loadImage,
    updateParam,
    applyPreset,
    exportImage,
  }
}
