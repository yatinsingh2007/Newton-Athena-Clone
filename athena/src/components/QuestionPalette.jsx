import { useEffect, useRef } from 'react'

const LEGEND = [
  ['answered', 'Answered'],
  ['not-answered', 'Not answered'],
  ['marked', 'Marked for review'],
  ['answered-marked', 'Answered & marked'],
  ['not-visited', 'Not visited'],
]

export function QuestionPalette({ questions, current, statusOf, onJump, onClose, anchorRef }) {
  const panelRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    const onPointer = (e) => {
      if (panelRef.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return
      onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [onClose, anchorRef])

  return (
    <div className="palette" ref={panelRef} role="dialog" aria-label="All questions">
      <div className="palette-grid">
        {questions.map((q, i) => (
          <button
            key={q.id}
            type="button"
            className="palette-item"
            data-status={statusOf(q.id)}
            aria-current={i === current ? 'true' : undefined}
            aria-label={`Question ${i + 1}`}
            onClick={() => onJump(i)}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <ul className="palette-legend">
        {LEGEND.map(([status, label]) => (
          <li key={status}>
            <span className="palette-swatch" data-status={status} aria-hidden="true" />
            {label}
          </li>
        ))}
      </ul>
    </div>
  )
}
