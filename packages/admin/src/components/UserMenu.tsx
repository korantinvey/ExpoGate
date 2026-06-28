import { useState, useRef, useEffect } from 'react'
import { sb } from '../lib/supabase'

interface Props {
  userName: string
  onSettings: () => void
}

export function UserMenu({ userName, onSettings }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 20, cursor: 'pointer', padding: '4px 10px', fontSize: 13, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <span style={{ fontSize: 16 }}>👤</span>
        <span className="hide-on-mobile">{userName}</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: 160, zIndex: 100 }}>
          <div style={{ padding: '8px 14px', fontSize: 13, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{userName}</div>
          <button onClick={() => { onSettings(); setOpen(false) }} style={{ width: '100%', padding: '10px 14px', fontSize: 13, color: 'var(--text)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
            Paramètres
          </button>
          <button onClick={() => sb.auth.signOut()} style={{ width: '100%', padding: '10px 14px', fontSize: 13, color: 'var(--text)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderTop: '1px solid var(--border)' }}>
            Déconnexion
          </button>
        </div>
      )}
    </div>
  )
}
