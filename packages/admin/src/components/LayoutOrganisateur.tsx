import { Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { sb } from '../lib/supabase'

export function LayoutOrganisateur() {
  const { user } = useAuth()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header className="mobile-topbar">
        <span className="mobile-topbar-title">Expogate</span>
        <div className="topbar-user" style={{ marginLeft: 'auto' }}>
          <span>{user?.prenom} {user?.nom}</span>
          <button className="btn-logout" onClick={() => sb.auth.signOut()}>Déconnexion</button>
        </div>
      </header>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
