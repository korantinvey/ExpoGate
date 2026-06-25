import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VAPID_SUBJECT = 'mailto:korantin.vey@gmail.com'
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!

async function signVapid(audience: string): Promise<string> {
  const header = btoa(JSON.stringify({ typ: 'JWT', alg: 'ES256' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const now = Math.floor(Date.now() / 1000)
  const payload = btoa(JSON.stringify({ aud: audience, exp: now + 43200, sub: VAPID_SUBJECT })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const rawKey = Uint8Array.from(atob(VAPID_PRIVATE_KEY.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('raw', rawKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${header}.${payload}`))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  return `${header}.${payload}.${sigB64}`
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } })

  const { user_ids, title, body, url } = await req.json() as { user_ids: string[]; title: string; body: string; url?: string }

  const sbAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: subs } = await sbAdmin.from('push_subscriptions').select('*').in('user_id', user_ids)

  if (!subs?.length) return Response.json({ sent: 0 })

  let sent = 0
  for (const sub of subs) {
    try {
      const origin = new URL(sub.endpoint).origin
      const jwt = await signVapid(origin)
      const payload = JSON.stringify({ title, body, url: url ?? '/' })

      const res = await fetch(sub.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`,
          'TTL': '86400',
        },
        body: payload,
      })
      if (res.ok || res.status === 201) sent++
      else if (res.status === 410) await sbAdmin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    } catch (_) { /* ignore */ }
  }

  return Response.json({ sent })
})
