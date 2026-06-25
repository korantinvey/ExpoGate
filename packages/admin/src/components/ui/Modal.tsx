import { useState } from 'react'
import { Spinner } from './Spinner'

interface Props {
  title: string
  confirmLabel?: string
  onClose: () => void
  onConfirm: () => Promise<boolean>
  children: React.ReactNode
  footer?: React.ReactNode
}

export function Modal({ title, confirmLabel = 'Confirmer', onClose, onConfirm, children, footer }: Props) {
  const [loading, setLoading] = useState(false)

  async function handle() {
    setLoading(true)
    const ok = await onConfirm()
    setLoading(false)
    if (ok) onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">
          {footer}
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" disabled={loading} onClick={handle}>
            {loading ? <Spinner /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
