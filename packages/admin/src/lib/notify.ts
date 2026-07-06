import { sb } from './supabase'

export async function notifyNonConformite(prestationId: string): Promise<void> {
  const { data: { session } } = await sb.auth.getSession()
  if (!session?.access_token) return
  try {
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-non-conformite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      },
      body: JSON.stringify({ prestation_id: prestationId }),
    })
  } catch { /* non bloquant */ }
}
