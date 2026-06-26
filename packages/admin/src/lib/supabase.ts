import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string
const service = import.meta.env.VITE_SUPABASE_SERVICE_ROLE as string

export const sb = createClient(url, anon, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

export const sbAdmin = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false },
})
