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
import { ControleurEventPage } from './pages/ControleurEventPage'
import { ControleurStandPage } from './pages/ControleurStandPage'
import { sb } from './lib/supabase'
import { usePushNotifications } from './hooks/usePushNotifications'
import { useInstallPrompt } from './hooks/useInstallPrompt'
import { ThemeContext, useThemeProvider } from './hooks/useTheme'

function AppRoutes() {
  const { user, loading } = useAuth()
  const { permission, requestPermission, supported, subscribed, checking: pushChecking } = usePushNotifications(user?.id ?? null)
  const { standalone, canPrompt, isIos, isAndroid, hasNativePrompt, triggerInstall, inBrowserAfterInstall } = useInstallPrompt()

  const [installDismissed, setInstallDismissed] = useState(false)
  const [useAppDismissed, setUseAppDismissed] = useState(() => localStorage.getItem('use_app_dismissed') === '1')
  const [pushDismissed, setPushDismissed] = useState(() => localStorage.getItem('push_banner_dismissed') === '1')

  // Ordre de priorité : install → "utiliser l'app" → push
  const showInstallBanner = canPrompt && !installDismissed
  const showUseAppBanner = inBrowserAfterInstall && !useAppDismissed && !showInstallBanner
  const showPushBanner = !pushChecking && supported && !subscribed && permission !== 'denied' && !pushDismissed && !showInstallBanner && !showUseAppBanner

  function dismissInstall() { setInstallDismissed(true) }
  function dismissUseApp() { localStorage.setItem('use_app_dismissed', '1'); setUseAppDismissed(true) }
  function dismissPush() { localStorage.setItem('push_banner_dismissed', '1'); setPushDismissed(true) }

  useEffect(() => {
    if (user) {
      const role = user.is_admin ? 'Admin' : 'Organisateur'
      document.title = `${user.prenom} ${user.nom} — ${role}`
    } else {
      document.title = 'Expogate'
    }
  }, [user])

  // ── Bannière install (cas 3 : pas encore installée) ───────────────────────
  const installBanner = showInstallBanner ? (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 28, maxWidth: 380, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📲</div>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>Installer Expogate</div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.5 }}>
          {isIos
            ? <>Appuyez sur le bouton <strong>Partager ↑</strong> en bas de Safari, puis <strong>"Sur l'écran d'accueil"</strong> pour installer l'application.</>
            : isAndroid && !hasNativePrompt
              ? <>Appuyez sur le menu <strong>⋮</strong> de votre navigateur, puis <strong>"Ajouter à l'écran d'accueil"</strong>.</>
              : 'Installez l\'application pour un accès rapide et une utilisation hors ligne.'}
        </div>
        {isIos || (isAndroid && !hasNativePrompt) ? (
          <button className="btn btn-primary" style={{ width: '100%', marginBottom: 10 }} onClick={dismissInstall}>Compris</button>
        ) : (
          <>
            <button className="btn btn-primary" style={{ width: '100%', marginBottom: 10 }} onClick={async () => { await triggerInstall(); dismissInstall() }}>
              Installer l'application
            </button>
          </>
        )}
        <button onClick={dismissInstall} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13 }}>
          Plus tard
        </button>
      </div>
    </div>
  ) : null

  // ── Bannière "utiliser l'app" (cas 2 : installée mais accès via navigateur) ─
  const useAppBanner = showUseAppBanner ? (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 300, padding: 12 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '14px 16px', boxShadow: '0 -2px 16px rgba(0,0,0,0.12)', display: 'flex', alignItems: 'center', gap: 12, maxWidth: 480, margin: '0 auto' }}>
        <span style={{ fontSize: 28, flexShrink: 0 }}>📱</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>Expogate est installée</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Utilisez l'application pour une meilleure expérience hors ligne.</div>
        </div>
        <button onClick={dismissUseApp} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, padding: '4px 6px', flexShrink: 0 }}>✕</button>
      </div>
    </div>
  ) : null

  // ── Bannière push ──────────────────────────────────────────────────────────
  const pushBanner = showPushBanner ? (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 28, maxWidth: 380, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔔</div>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>Activer les notifications</div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.5 }}>Recevez les alertes de non-conformité en temps réel sur cet appareil.</div>
        <button className="btn btn-primary" style={{ width: '100%', marginBottom: 10 }} onClick={async () => { await requestPermission(); dismissPush() }}>
          Activer les notifications
        </button>
        <button onClick={dismissPush} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13 }}>
          Plus tard
        </button>
      </div>
    </div>
  ) : null

  if (loading) return null

  // Cas 1 : standalone → pas de bannière du tout
  // Cas 3 : non connecté → montrer la bannière install sur la page de login
  if (!user) return (
    <>
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
      {!standalone && installBanner}
    </>
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
        {installBanner}
        {useAppBanner}
        {pushBanner}
      </>
    )
  }

  return (
    <>
      <Routes>
        {/* Routes contrôleur terrain — sans sidebar */}
        <Route path="controleur/:eventId" element={<ControleurEventPage />} />
        <Route path="controleur/:eventId/:standId" element={<ControleurStandPage />} />
        {/* Routes organisateur / prestataire */}
        <Route element={<LayoutOrganisateur />}>
          <Route index element={<EvenementsOrganisateurPage />} />
          <Route path="evenements/:id" element={<FicheEvenementOrganisateurPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      {installBanner}
      {useAppBanner}
      {pushBanner}
    </>
  )
}

export default function App() {
  const themeCtx = useThemeProvider()
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
    <ThemeContext.Provider value={themeCtx}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ThemeContext.Provider>
  )
}
