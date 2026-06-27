import { useState, useRef, useEffect } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useAuth } from '../hooks/useAuth'
import { useMessages } from '../hooks/useMessages'
import { useTheme } from '../hooks/useTheme'
import { NotifDropdown } from './NotifDropdown'
import { SettingsModal } from './SettingsModal'
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

const NAV_ITEMS = [
  { to: '/dashboard', icon: '◻', label: 'Accueil' },
  { to: '/evenements', icon: '◈', label: 'Événements' },
  { to: '/utilisateurs', icon: '◉', label: 'Utilisateurs' },
  { to: '/prestataires', icon: '◎', label: 'Prestataires' },
]

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { user } = useAuth()
  const { unread, messages, markAllRead } = useMessages(user?.id ?? null)
  const { theme, setTheme } = useTheme()
  const userName = `${user?.prenom ?? ''} ${user?.nom ?? ''}`.trim()

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-wrapper">
        <header className="mobile-topbar">
          <button className="hamburger" onClick={() => setSidebarOpen(true)}>☰</button>
          <div className="topbar-user" style={{ marginLeft: 'auto' }}>
            <NotifDropdown unread={unread} messages={messages} markAllRead={markAllRead} userName={userName} />
            <button onClick={() => setSettingsOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)', padding: '2px 4px' }} title="Paramètres">⚙️</button>
            <UserMenu userName={userName} />
          </div>
        </header>
        <main className="main-content" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}>
          <Outlet />
        </main>
        <nav className="mobile-bottom-nav">
          {NAV_ITEMS.map(({ to, icon, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `mobile-bottom-nav-item${isActive ? ' active' : ''}`}>
              <span className="mobile-bottom-nav-icon">{icon}</span>
              <span className="mobile-bottom-nav-label">{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
      {settingsOpen && <SettingsModal theme={theme} onThemeChange={setTheme} onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
