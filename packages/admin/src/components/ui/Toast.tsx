import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

interface ToastMsg { message: string; type: 'success' | 'error' }
interface ToastContextValue { notify: (message: string, type?: 'success' | 'error') => void }

const ToastContext = createContext<ToastContextValue>({ notify: () => {} })

function ToastBanner({ message, type, onDismiss }: ToastMsg & { onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000)
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

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastMsg | null>(null)
  function notify(message: string, type: 'success' | 'error' = 'error') {
    setToast({ message, type })
  }
  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      {toast && <ToastBanner message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
