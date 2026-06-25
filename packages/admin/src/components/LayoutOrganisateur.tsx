import { Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useMessages } from '../hooks/useMessages'
import { NotifDropdown } from './NotifDropdown'
import { sb } from '../lib/supabase'

export function LayoutOrganisateur() {
  const { user } = useAuth()
  const { unread, messages, markAllRead } = useMessages(user?.id ?? null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header className="mobile-topbar">
        <span className="mobile-topbar-title">Expogate</span>
        <div className="topbar-user" style={{ marginLeft: 'auto' }}>
          <NotifDropdown unread={unread} messages={messages} markAllRead={markAllRead} userName={`${user?.prenom} ${user?.nom}`} />
          <button className="btn-logout" onClick={() => sb.auth.signOut()}>Déconnexion</button>
        </div>
      </header>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
