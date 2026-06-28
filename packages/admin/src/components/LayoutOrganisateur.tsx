import { useState, useRef, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useMessages } from '../hooks/useMessages'
import { useTheme } from '../hooks/useTheme'
import { NotifDropdown } from './NotifDropdown'
import { SettingsModal } from './SettingsModal'
import { LogoExpogate } from './LogoExpogate'
import { sb } from '../lib/supabase'

function UserMenu({ userName }: { userName: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 20, cursor: 'pointer', padding: '4px 10px', fontSize: 13, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 16 }}>👤</span>
        <span className="hide-on-mobile">{userName}</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: 160, zIndex: 100 }}>
          <div style={{ padding: '8px 14px', fontSize: 13, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{userName}</div>
          <button onClick={() => sb.auth.signOut()} style={{ width: '100%', padding: '10px 14px', fontSize: 13, color: 'var(--text)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
            Déconnexion
          </button>
        </div>
      )}
    </div>
  )
}

export function LayoutOrganisateur() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { user } = useAuth()
  const { unread, messages, markAllRead } = useMessages(user?.id ?? null)
  const { theme, setTheme } = useTheme()
  const userName = `${user?.prenom ?? ''} ${user?.nom ?? ''}`.trim()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header className="mobile-topbar" style={{ flexWrap: 'nowrap', minWidth: 0 }}>
        <div style={{ flexShrink: 0, width: 110 }}><LogoExpogate height={28} /></div>
        <div className="topbar-user" style={{ marginLeft: 'auto', flexShrink: 0, gap: 6 }}>
          <NotifDropdown unread={unread} messages={messages} markAllRead={markAllRead} userName={userName} />
          <button onClick={() => setSettingsOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)', padding: '2px 4px' }} title="Paramètres">⚙️</button>
          <UserMenu userName={userName} />
        </div>
      </header>
      <main className="main-content">
        <Outlet />
      </main>
      {settingsOpen && <SettingsModal theme={theme} onThemeChange={setTheme} onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
