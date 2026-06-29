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

function NotifModal({ messages, onClose }: { messages: Message[]; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Notifications</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-muted)', lineHeight: 1 }}>×</button>
        </div>
        {messages.length === 0 ? (
          <div style={{ padding: '24px 18px', color: 'var(--text-muted)', fontSize: 14, textAlign: 'center' }}>Aucune notification</div>
        ) : (
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {messages.map(m => (
              <div key={m.id} style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', background: m.lu ? 'transparent' : 'var(--accent-light)' }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{m.title}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>{m.body}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {new Date(m.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function UserMenu({ userName, unread, messages, markAllRead, onSettings }: Props) {
  const [open, setOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // BroadcastChannel from service worker notificationclick
    const bc = new BroadcastChannel('notif')
    bc.onmessage = (e) => {
      if (e.data === 'OPEN_NOTIFICATIONS') { setNotifOpen(true); markAllRead() }
    }
    return () => bc.close()
  }, [markAllRead])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function openNotif() {
    setOpen(false)
    setNotifOpen(true)
    if (unread > 0) markAllRead()
  }

  return (
    <>
      <div ref={ref} style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{ position: 'relative', background: 'none', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <span style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
            {initials(userName)}
          </span>
          {unread > 0 && (
            <span style={{ position: 'absolute', top: -3, right: -3, background: '#e53e3e', color: '#fff', borderRadius: '50%', minWidth: 16, height: 16, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, padding: '0 3px', boxSizing: 'border-box' }}>
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>

        {open && (
          <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', minWidth: 200, zIndex: 100, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{userName}</div>
            <button onClick={openNotif} style={{ width: '100%', padding: '10px 14px', fontSize: 13, color: 'var(--text)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Notifications
              {unread > 0 && <span style={{ background: '#e53e3e', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 11, fontWeight: 700 }}>{unread}</span>}
            </button>
            <button onClick={() => { onSettings(); setOpen(false) }} style={{ width: '100%', padding: '10px 14px', fontSize: 13, color: 'var(--text)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderTop: '1px solid var(--border)' }}>
              Paramètres
            </button>
            <button onClick={() => sb.auth.signOut()} style={{ width: '100%', padding: '10px 14px', fontSize: 13, color: 'var(--text)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderTop: '1px solid var(--border)' }}>
              Déconnexion
            </button>
          </div>
        )}
      </div>

      {notifOpen && <NotifModal messages={messages} onClose={() => setNotifOpen(false)} />}
    </>
  )
}
