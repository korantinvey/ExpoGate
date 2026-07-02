import { NavLink } from 'react-router-dom'
import { LogoExpogate } from './LogoExpogate'

interface Props {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: Props) {
  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar${open ? ' sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <LogoExpogate height={36} />
          <div className="sidebar-subtitle" style={{ marginTop: 6 }}>Back-office Admin</div>
          <button className="sidebar-close" onClick={onClose}>×</button>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section">Vue d'ensemble</div>
          <NavLink to="/dashboard" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} onClick={onClose}>
            <span className="nav-icon">◻</span> Tableau de bord
          </NavLink>
          <div className="nav-section" style={{ marginTop: 12 }}>Gestion</div>
          <NavLink to="/evenements" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} onClick={onClose}>
            <span className="nav-icon">◈</span> Événements
          </NavLink>
          <NavLink to="/utilisateurs" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} onClick={onClose}>
            <span className="nav-icon">◉</span> Utilisateurs
          </NavLink>
        </nav>
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', marginTop: 'auto' }}>
          <div className="nav-section" style={{ marginBottom: 6 }}>À propos</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <div>Expogate Admin</div>
            {__BUILD_DATE__ && (
              <div>Déployé le {new Date(__BUILD_DATE__).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
