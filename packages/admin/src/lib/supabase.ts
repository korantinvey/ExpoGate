import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string
const service = import.meta.env.VITE_SUPABASE_SERVICE_ROLE as string

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  const signal = init?.signal
    ? AbortSignal.any([init.signal, controller.signal])
    : controller.signal
  return fetch(input, { ...init, signal }).finally(() => clearTimeout(timer))
}

export const sb = createClient(url, anon, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  global: { fetch: fetchWithTimeout },
})

export const sbAdmin = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { fetch: fetchWithTimeout },
})
