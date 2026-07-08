import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LogoExpogate } from './LogoExpogate'
import { useAuth } from '../hooks/useAuth'
import { useSidebarNav } from '../contexts/SidebarNavContext'

interface Props {
  open: boolean
  onClose: () => void
}

async function forceUpdate() {
  const regs = await navigator.serviceWorker.getRegistrations()
  await Promise.all(regs.map(r => r.unregister()))
  const keys = await caches.keys()
  await Promise.all(keys.map(k => caches.delete(k)))
  window.location.reload()
}

export function Sidebar({ open, onClose }: Props) {
  const [updating, setUpdating] = useState(false)
  const { user } = useAuth()
  const { navItems, activeNav, setActiveNav } = useSidebarNav()
  const isAdmin = user?.is_admin ?? false

  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar${open ? ' sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <LogoExpogate height={36} />
          <div className="sidebar-subtitle" style={{ marginTop: 6 }}>
            {isAdmin ? 'Back-office Admin' : 'Espace organisateur'}
          </div>
          <button className="sidebar-close" onClick={onClose}>×</button>
        </div>
        <nav className="sidebar-nav">
          {/* Gestion — admin uniquement, toujours visible */}
          {isAdmin && (
            <>
              {navItems.length === 0 && (
                <>
                  <div className="nav-section">Vue d'ensemble</div>
                  <NavLink to="/dashboard" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} onClick={onClose}>
                    <span className="nav-icon">◻</span> Tableau de bord
                  </NavLink>
                </>
              )}
              <div className="nav-section" style={{ marginTop: navItems.length === 0 ? 12 : 0 }}>Gestion</div>
              <NavLink to="/evenements" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} onClick={onClose}>
                <span className="nav-icon">◈</span> Événements
              </NavLink>
              <NavLink to="/utilisateurs" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} onClick={onClose}>
                <span className="nav-icon">◉</span> Utilisateurs
              </NavLink>
              <NavLink to="/prestataires" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} onClick={onClose}>
                <span className="nav-icon">◎</span> Prestataires
              </NavLink>
            </>
          )}

          {/* Non-admin : lien Mes événements (flèche retour seulement si on est dans un événement) */}
          {!isAdmin && (
            <NavLink to="/" end className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} onClick={onClose}>
              {navItems.length > 0 && <span className="nav-icon">◀</span>} Mes événements
            </NavLink>
          )}

          {/* Navigation contextuelle — onglets de l'événement en cours */}
          {navItems.length > 0 && (
            <>
              <div className="nav-section" style={{ marginTop: 12 }}>Cet événement</div>
              {navItems.map(item => (
                <button
                  key={item.key}
                  className={`nav-item${activeNav === item.key ? ' active' : ''}`}
                  onClick={() => { setActiveNav(item.key); onClose() }}
                >
                  {item.label}
                </button>
              ))}
            </>
          )}
        </nav>
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', marginTop: 'auto' }}>
          <div className="nav-section" style={{ marginBottom: 6 }}>À propos</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 10 }}>
            <div>Expogate</div>
            {__BUILD_DATE__ && (
              <div>Déployé le {new Date(__BUILD_DATE__).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            )}
          </div>
          <button
            onClick={() => { setUpdating(true); forceUpdate() }}
            disabled={updating}
            style={{ width: '100%', padding: '8px 12px', fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: updating ? 'var(--text-muted)' : 'var(--text)', cursor: updating ? 'default' : 'pointer' }}
          >
            {updating ? 'Mise à jour…' : '↻ Forcer la mise à jour'}
          </button>
        </div>
      </aside>
    </>
  )
}
