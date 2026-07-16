import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AppHeader } from './AppHeader'
import { Sidebar } from './Sidebar'
import { SidebarNavProvider } from '../contexts/SidebarNavContext'

export function LayoutOrganisateur() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <SidebarNavProvider>
      <div className="app-shell">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="main-wrapper">
          <AppHeader onHamburger={() => setSidebarOpen(true)} />
          <main className="main-content" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarNavProvider>
  )
}
