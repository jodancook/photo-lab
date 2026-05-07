import { useRef } from 'react'

export function CompareSlider({ pos, onChange }) {
  const dragging = useRef(false)

  const getX = (e, el) => {
    const rect = el.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    return Math.max(0.01, Math.min(0.99, (clientX - rect.left) / rect.width))
  }

  const onPointerDown = (e) => {
    e.preventDefault()
    dragging.current = true
    const parent = e.currentTarget.closest('.canvas-inner')

    const onMove = (me) => {
      if (!dragging.current) return
      onChange(getX(me, parent))
    }
    const onUp = () => {
      dragging.current = false
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div className="compare-overlay" style={{ left: `${pos * 100}%` }}>
      <div className="compare-line" />
      <div className="compare-handle" onPointerDown={onPointerDown}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M6 10H14M6 10L9 7M6 10L9 13M14 10L11 7M14 10L11 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <span className="compare-label compare-label-before">Before</span>
      <span className="compare-label compare-label-after">After</span>
    </div>
  )
}
