import { useState, useRef, useEffect } from 'react'
import { sb } from '../lib/supabase'
import type { Message } from '../hooks/useMessages'

interface Props {
  userName: string
  unread: number
  messages: Message[]
  markAllRead: () => void
  onSettings: () => void
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export function UserMenu({ userName, unread, messages, markAllRead, onSettings }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function toggle() {
    if (!open && unread > 0) markAllRead()
    setOpen(o => !o)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={toggle}
        style={{ position: 'relative', background: 'none', border: '1px solid var(--border)', borderRadius: 20, cursor: 'pointer', padding: '4px 10px', fontSize: 13, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
          {initials(userName)}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>▾</span>
        {unread > 0 && (
          <span style={{ position: 'absolute', top: 2, right: 2, background: '#e53e3e', color: '#fff', borderRadius: '50%', width: 14, height: 14, fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', minWidth: 220, zIndex: 100, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{userName}</div>

          {/* Section notifications */}
          {messages.length > 0 && (
            <div style={{ borderBottom: '1px solid var(--border)' }}>
              <div style={{ padding: '6px 14px 4px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notifications</div>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {messages.map(m => (
                  <div key={m.id} style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', background: m.lu ? 'transparent' : 'var(--accent-light)' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{m.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.body}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {new Date(m.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
