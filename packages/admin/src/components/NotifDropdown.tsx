import { useEffect, useRef, useState } from 'react'
import type { Message } from '../hooks/useMessages'

interface Props {
  unread: number
  messages: Message[]
  markAllRead: () => void
  userName: string
}

export function NotifDropdown({ unread, messages, markAllRead }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const bc = new BroadcastChannel('notif')
    bc.onmessage = (e) => {
      if (e.data === 'OPEN_NOTIFICATIONS') {
        setOpen(true)
        markAllRead()
      }
    }
    return () => bc.close()
  }, [markAllRead])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function toggle() {
    if (!open && unread > 0) markAllRead()
    setOpen(o => !o)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={toggle} style={{ position: 'relative', background: 'none', border: '1px solid var(--border)', borderRadius: 20, cursor: 'pointer', padding: '4px 10px', fontSize: 18, color: 'var(--text)', display: 'flex', alignItems: 'center', lineHeight: 1 }}>
        🔔
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            background: '#e53e3e', color: 'white', borderRadius: '50%',
            width: 14, height: 14, fontSize: 9,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>🔔 Notifications</span>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-muted)', lineHeight: 1 }}>×</button>
            </div>
            {messages.length === 0 ? (
              <div style={{ padding: '24px 18px', color: 'var(--text-muted)', fontSize: 14, textAlign: 'center' }}>Aucune notification</div>
            ) : (
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {messages.map(m => (
                  <div key={m.id} style={{
                    padding: '12px 18px', borderBottom: '1px solid var(--border)',
                    background: m.lu ? 'transparent' : 'var(--accent-light, #f0fdf4)',
                  }}>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{m.title}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>{m.body}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {new Date(m.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {m.push_vu_at ? (
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#16a34a', background: '#dcfce7', borderRadius: 4, padding: '1px 6px' }} title={`Notification push vue le ${new Date(m.push_vu_at).toLocaleString('fr-FR')}`}>
                          Push vue
                        </span>
                      ) : (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--border)', borderRadius: 4, padding: '1px 6px' }}>
                          Push non vue
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
