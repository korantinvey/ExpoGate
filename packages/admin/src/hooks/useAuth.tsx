import { createContext, useContext, useEffect, useState } from 'react'
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

  async function loadUser(supaUser: SupaUser) {
    const { data: profile } = await sb.from('users').select('*').eq('id', supaUser.id).single()
    if (!profile) {
      await sb.auth.signOut()
      setUser(null)
    } else {
      setUser({ ...supaUser, ...profile })
    }
    setLoading(false)
  }

  useEffect(() => {
    sb.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setLoading(false); return }
      // Refresh the token immediately if it expires within 5 minutes
      const expiresAt = session.expires_at ?? 0
      const fiveMinutes = 5 * 60
      if (expiresAt - Date.now() / 1000 < fiveMinutes) {
        sb.auth.refreshSession().then(({ data: { session: refreshed } }) => {
          if (refreshed?.user) void loadUser(refreshed.user)
          else { setLoading(false) }
        })
      } else {
        void loadUser(session.user)
      }
    })

    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      if (session?.user) void loadUser(session.user)
      else { setUser(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
