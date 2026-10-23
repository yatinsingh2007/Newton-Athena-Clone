import { useEffect, useRef } from 'react'

export function ConfirmDialog({ open, title, body, confirmLabel, busy, error, onConfirm, onCancel }) {
  const ref = useRef(null)

  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="dialog"
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) onCancel()
      }}
    >
      <h2>{title}</h2>
      <p>{body}</p>
      {error && <p className="error-text" role="alert">{error}</p>}
      <div className="dialog-actions">
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="btn btn-success" onClick={onConfirm} disabled={busy}>
          {busy ? 'Submitting…' : confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
