import { Outlet } from 'react-router-dom'
import { AppHeader } from './AppHeader'

export function LayoutOrganisateur() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppHeader />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
