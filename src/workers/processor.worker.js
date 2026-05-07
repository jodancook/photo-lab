import { processImageData } from '../filters/engine.js'

self.onmessage = ({ data: { pixels, width, height, params } }) => {
  const imageData = new ImageData(new Uint8ClampedArray(pixels), width, height)
  const result = processImageData(imageData, params)
  // Transfer the buffer (zero-copy back to main thread)
  self.postMessage({ pixels: result.data.buffer, width, height }, [result.data.buffer])
}
