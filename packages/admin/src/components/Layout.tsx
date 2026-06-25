import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useAuth } from '../hooks/useAuth'
import { sb } from '../lib/supabase'

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user } = useAuth()

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-wrapper">
        <header className="mobile-topbar">
          <button className="hamburger" onClick={() => setSidebarOpen(true)}>☰</button>
          <span className="mobile-topbar-title">Expogate Admin</span>
          <div className="topbar-user" style={{ marginLeft: 'auto' }}>
            <span>{user?.prenom} {user?.nom}</span>
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
