import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { Layout } from './components/Layout'
import { LayoutOrganisateur } from './components/LayoutOrganisateur'
import { LoginPage } from './pages/LoginPage'
import { SetPasswordPage } from './pages/SetPasswordPage'
import { DashboardPage } from './pages/DashboardPage'
import { EvenementsPage } from './pages/EvenementsPage'
import { FicheEvenementPage } from './pages/FicheEvenementPage'
import { UtilisateursPage } from './pages/UtilisateursPage'
import { PrestatairesPage } from './pages/PrestatairesPage'
import { EvenementsOrganisateurPage } from './pages/EvenementsOrganisateurPage'
import { FicheEvenementOrganisateurPage } from './pages/FicheEvenementOrganisateurPage'
import { sb } from './lib/supabase'
import { usePushNotifications } from './hooks/usePushNotifications'

function AppRoutes() {
  const { user, loading } = useAuth()
  const { permission, requestPermission, supported } = usePushNotifications(user?.id ?? null)
  const [bannerDismissed, setBannerDismissed] = useState(() => localStorage.getItem('push_banner_dismissed') === '1')
  const showBanner = supported && permission === 'default' && !bannerDismissed

  function dismissBanner() {
    localStorage.setItem('push_banner_dismissed', '1')
    setBannerDismissed(true)
  }

  useEffect(() => {
    if (user) {
      const role = user.is_admin ? 'Admin' : 'Organisateur'
      document.title = `${user.prenom} ${user.nom} — ${role}`
    } else {
      document.title = 'Expogate'
    }
  }, [user])

  if (loading) return null
  if (!user) return (
    <Routes>
      <Route path="*" element={<LoginPage />} />
    </Routes>
  )

  if (user.user_metadata?.force_password_change) {
    return (
      <SetPasswordPage onDone={async () => {
        await sb.auth.updateUser({ data: { force_password_change: false } })
        await sb.auth.refreshSession()
      }} />
    )
  }

  const pushBanner = showBanner ? (
    <div style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 300, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, maxWidth: 'calc(100vw - 32px)', width: 420 }}>
      <span style={{ fontSize: 20 }}>🔔</span>
      <div style={{ flex: 1, fontSize: 13 }}>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>Activer les notifications</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Recevez les alertes de non-conformité en temps réel</div>
      </div>
      <button className="btn btn-primary btn-sm" onClick={async () => { await requestPermission(); dismissBanner() }}>Activer</button>
      <button onClick={dismissBanner} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, lineHeight: 1, padding: 2 }}>×</button>
    </div>
  ) : null

  if (user.is_admin) {
    return (
      <>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="evenements" element={<EvenementsPage />} />
            <Route path="evenements/:id" element={<FicheEvenementPage />} />
            <Route path="utilisateurs" element={<UtilisateursPage />} />
            <Route path="prestataires" element={<PrestatairesPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
        {pushBanner}
      </>
    )
  }

  return (
    <>
      <Routes>
        <Route element={<LayoutOrganisateur />}>
          <Route index element={<EvenementsOrganisateurPage />} />
          <Route path="evenements/:id" element={<FicheEvenementOrganisateurPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      {pushBanner}
    </>
  )
}

export default function App() {
  const [isRecovery, setIsRecovery] = useState(() => {
    const hash = window.location.hash
    return hash.includes('type=recovery') || hash.includes('type=invite')
  })

  useEffect(() => {
    const { data: { subscription } } = sb.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setIsRecovery(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (isRecovery) {
    return (
      <SetPasswordPage onDone={async () => {
        await sb.auth.signOut()
        setIsRecovery(false)
      }} />
    )
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
