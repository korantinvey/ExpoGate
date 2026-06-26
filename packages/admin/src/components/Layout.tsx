import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useAuth } from '../hooks/useAuth'
import { useMessages } from '../hooks/useMessages'
import { useTheme } from '../hooks/useTheme'
import { NotifDropdown } from './NotifDropdown'
import { SettingsModal } from './SettingsModal'
import { sb } from '../lib/supabase'

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { user } = useAuth()
  const { unread, messages, markAllRead } = useMessages(user?.id ?? null)
  const { theme, setTheme } = useTheme()

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-wrapper">
        <header className="mobile-topbar">
          <button className="hamburger" onClick={() => setSidebarOpen(true)}>☰</button>
          <span className="mobile-topbar-title">Expogate Admin</span>
          <div className="topbar-user" style={{ marginLeft: 'auto' }}>
            <NotifDropdown unread={unread} messages={messages} markAllRead={markAllRead} userName={`${user?.prenom} ${user?.nom}`} />
            <button onClick={() => setSettingsOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)', padding: '2px 4px' }} title="Paramètres">⚙️</button>
            <button className="btn-logout" onClick={() => sb.auth.signOut()}>Déconnexion</button>
          </div>
        </header>
        <main className="main-content">
          <Outlet />
        </main>
      </div>
      {settingsOpen && <SettingsModal theme={theme} onThemeChange={setTheme} onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
