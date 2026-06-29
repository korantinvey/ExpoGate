import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { User as SupaUser } from '@supabase/supabase-js'
import { sb } from '../lib/supabase'
import type { User } from '../types'

interface AuthCtx {
  user: (SupaUser & User) | null
  loading: boolean
}

const AuthContext = createContext<AuthCtx>({ user: null, loading: true })

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<(SupaUser & User) | null>(null)
  const [loading, setLoading] = useState(true)
  const lastSupaUser = useRef<SupaUser | null>(null)

  async function loadUser(supaUser: SupaUser) {
    lastSupaUser.current = supaUser
    try {
      const { data: profile, error } = await sb.from('users').select('*').eq('id', supaUser.id).single()
      if (error) throw error  // erreur réseau ou Supabase → fallback cache
      if (!profile) {
        await sb.auth.signOut()
        setUser(null)
        setLoading(false)
        return
      }
      // Mise en cache du profil pour le mode hors ligne
      localStorage.setItem('cached_user_profile', JSON.stringify(profile))
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

  useEffect(() => {
    sb.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setLoading(false); return }
      // Refresh du token s'il expire dans moins de 5 minutes
      const expiresAt = session.expires_at ?? 0
      const fiveMinutes = 5 * 60
      if (expiresAt - Date.now() / 1000 < fiveMinutes) {
        sb.auth.refreshSession()
          .then(({ data: { session: refreshed } }) => {
            void loadUser(refreshed?.user ?? session.user)
          })
          .catch(() => void loadUser(session.user)) // hors ligne : on continue avec la session courante
      } else {
        void loadUser(session.user)
      }
    })

    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        void loadUser(session.user)
      } else if (!navigator.onLine && lastSupaUser.current) {
        // Échec de rafraîchissement du token hors ligne : on garde la session en cache
        void loadUser(lastSupaUser.current)
      } else {
        setUser(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
