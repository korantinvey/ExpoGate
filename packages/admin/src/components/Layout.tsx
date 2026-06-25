import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useAuth } from '../hooks/useAuth'
import { useMessages } from '../hooks/useMessages'
import { NotifDropdown } from './NotifDropdown'
import { sb } from '../lib/supabase'

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user } = useAuth()
  const { unread, messages, markAllRead } = useMessages(user?.id ?? null)

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-wrapper">
        <header className="mobile-topbar">
          <button className="hamburger" onClick={() => setSidebarOpen(true)}>☰</button>
          <span className="mobile-topbar-title">Expogate Admin</span>
          <div className="topbar-user" style={{ marginLeft: 'auto' }}>
            <NotifDropdown unread={unread} messages={messages} markAllRead={markAllRead} userName={`${user?.prenom} ${user?.nom}`} />
            <button className="btn-logout" onClick={() => sb.auth.signOut()}>Déconnexion</button>
          </div>
        </header>
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
