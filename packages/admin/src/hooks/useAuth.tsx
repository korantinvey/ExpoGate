import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { User as SupaUser } from '@supabase/supabase-js'
import { sb } from '../lib/supabase'
import type { User } from '../types'

interface AuthCtx {
  user: (SupaUser & User) | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthCtx>({ user: null, loading: true, signOut: async () => {} })

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<(SupaUser & User) | null>(null)
  const [loading, setLoading] = useState(true)
  const lastSupaUser = useRef<SupaUser | null>(null)

  async function loadUser(supaUser: SupaUser) {
    lastSupaUser.current = supaUser
    try {
      const { data: profile, error } = await sb.from('users').select('*').eq('id', supaUser.id).single()
      if (error) throw error
      if (!profile) {
        // Compte inexistant côté BDD — déconnexion propre
        lastSupaUser.current = null
        localStorage.removeItem('cached_user_profile')
        localStorage.removeItem('cached_supa_user')
        await sb.auth.signOut()
        setUser(null)
        setLoading(false)
        return
      }
      // Mise en cache du profil + identité Supabase pour le mode hors ligne
      localStorage.setItem('cached_user_profile', JSON.stringify(profile))
      localStorage.setItem('cached_supa_user', JSON.stringify({
        id: supaUser.id,
        email: supaUser.email,
        user_metadata: supaUser.user_metadata,
        app_metadata: supaUser.app_metadata,
      }))
      setUser({ ...supaUser, ...profile })
    } catch {
      // Hors ligne : on utilise le profil mis en cache
      const cached = localStorage.getItem('cached_user_profile')
      if (cached) {
        try { setUser({ ...supaUser, ...JSON.parse(cached) }) } catch { setUser(null) }
      } else {
        setUser(null)
      }
    }
    setLoading(false)
  }

  // Déconnexion explicite — efface lastSupaUser avant que onAuthStateChange ne réagisse
  async function signOut() {
    lastSupaUser.current = null
    localStorage.removeItem('cached_user_profile')
    localStorage.removeItem('cached_supa_user')
    await sb.auth.signOut()
    setUser(null)
    setLoading(false)
  }

  useEffect(() => {
    sb.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        // Fallback hors ligne : reconstruire l'utilisateur depuis notre propre cache
        // (le token peut être expiré offline sans qu'on puisse le rafraîchir)
        const cachedProfile = localStorage.getItem('cached_user_profile')
        const cachedSupaUser = localStorage.getItem('cached_supa_user')
        if (cachedProfile && cachedSupaUser) {
          try {
            setUser({ ...JSON.parse(cachedSupaUser), ...JSON.parse(cachedProfile) })
            setLoading(false)
            return
          } catch {}
        }
        setLoading(false)
        return
      }
      const expiresAt = session.expires_at ?? 0
      const fiveMinutes = 5 * 60
      if (expiresAt - Date.now() / 1000 < fiveMinutes) {
        sb.auth.refreshSession()
          .then(({ data: { session: refreshed } }) => {
            void loadUser(refreshed?.user ?? session.user)
          })
          .catch(() => void loadUser(session.user))
      } else {
        void loadUser(session.user)
      }
    })

    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        void loadUser(session.user)
      } else if (lastSupaUser.current) {
        // Pas une déconnexion explicite (signOut() efface lastSupaUser avant)
        // → probablement un échec de rafraîchissement de token hors ligne
        void loadUser(lastSupaUser.current)
      } else {
        setUser(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={{ user, loading, signOut }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
