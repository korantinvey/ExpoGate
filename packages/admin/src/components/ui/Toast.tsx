import { useEffect, useState } from 'react'

interface ToastMsg { message: string; type: 'success' | 'error' }

export function Toast({ message, type = 'error', onDismiss }: ToastMsg & { onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000)
    return () => clearTimeout(t)
  }, [message])

  const bg = type === 'success' ? 'var(--success)' : 'var(--danger)'
  return (
    <div onClick={onDismiss} style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: bg, color: '#fff',
      padding: '12px 20px', borderRadius: 8,
      boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
      fontSize: 14, fontWeight: 500, cursor: 'pointer',
      maxWidth: 360,
    }}>
      {message}
    </div>
  )
}

export function useToast() {
  const [toast, setToast] = useState<ToastMsg | null>(null)
  function notify(message: string, type: 'success' | 'error' = 'error') {
    setToast({ message, type })
  }
  const toastEl = toast ? <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} /> : null
  return { notify, toastEl }
}
