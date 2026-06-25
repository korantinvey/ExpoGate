import { NavLink } from 'react-router-dom'

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
          <div className="sidebar-logo">Expogate</div>
          <div className="sidebar-subtitle">Back-office Admin</div>
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
      </aside>
    </>
  )
}
