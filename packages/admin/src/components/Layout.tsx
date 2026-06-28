import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { AppHeader } from './AppHeader'

const NAV_ITEMS = [
  { to: '/dashboard', icon: '◻', label: 'Accueil' },
  { to: '/evenements', icon: '◈', label: 'Événements' },
  { to: '/utilisateurs', icon: '◉', label: 'Utilisateurs' },
  { to: '/prestataires', icon: '◎', label: 'Prestataires' },
]

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-wrapper">
        <AppHeader onHamburger={() => setSidebarOpen(true)} />
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
    </div>
  )
}
