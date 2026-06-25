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

function AppRoutes() {
  const { user, loading } = useAuth()

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

  if (user.is_admin) {
    return (
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
    )
  }

  return (
    <Routes>
      <Route element={<LayoutOrganisateur />}>
        <Route index element={<EvenementsOrganisateurPage />} />
        <Route path="evenements/:id" element={<FicheEvenementOrganisateurPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
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
