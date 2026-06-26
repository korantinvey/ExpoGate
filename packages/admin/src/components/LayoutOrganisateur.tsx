import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useMessages } from '../hooks/useMessages'
import { useTheme } from '../hooks/useTheme'
import { NotifDropdown } from './NotifDropdown'
import { SettingsModal } from './SettingsModal'
import { LogoExpogate } from './LogoExpogate'
import { sb } from '../lib/supabase'

export function LayoutOrganisateur() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { user } = useAuth()
  const { unread, messages, markAllRead } = useMessages(user?.id ?? null)
  const { theme, setTheme } = useTheme()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header className="mobile-topbar" style={{ flexWrap: 'nowrap', minWidth: 0 }}>
        <div style={{ flexShrink: 0, width: 110 }}><LogoExpogate height={28} /></div>
        <div className="topbar-user" style={{ marginLeft: 'auto', flexShrink: 0, gap: 6 }}>
          <NotifDropdown unread={unread} messages={messages} markAllRead={markAllRead} userName={`${user?.prenom} ${user?.nom}`} />
          <button onClick={() => setSettingsOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-muted)', padding: '2px' }} title="Paramètres">⚙️</button>
          <button className="btn-logout" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => sb.auth.signOut()}>Déconnexion</button>
        </div>
      </header>
      <main className="main-content">
        <Outlet />
      </main>
      {settingsOpen && <SettingsModal theme={theme} onThemeChange={setTheme} onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
