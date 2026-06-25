import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as jose from 'https://deno.land/x/jose@v5.2.4/index.ts'

const VAPID_SUBJECT = 'mailto:korantin.vey@gmail.com'
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function getVapidKey() {
  return await jose.importJWK(
    { kty: 'EC', crv: 'P-256', d: VAPID_PRIVATE_KEY, x: '', y: '' },
    'ES256'
  ).catch(async () => {
    // Reconstruct x,y from public key
    const pub = Uint8Array.from(atob(VAPID_PUBLIC_KEY.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
    const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    return await jose.importJWK(
      { kty: 'EC', crv: 'P-256', d: VAPID_PRIVATE_KEY, x: toB64(pub.slice(1, 33)), y: toB64(pub.slice(33, 65)) },
      'ES256'
    )
  })
}

async function signVapid(audience: string): Promise<string> {
  const key = await getVapidKey()
  return await new jose.SignJWT({ sub: VAPID_SUBJECT })
    .setProtectedHeader({ alg: 'ES256', typ: 'JWT' })
    .setAudience(audience)
    .setExpirationTime('12h')
    .sign(key)
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const { user_ids, title, body, url } = await req.json() as { user_ids: string[]; title: string; body: string; url?: string }

  const sbAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: subs } = await sbAdmin.from('push_subscriptions').select('*').in('user_id', user_ids)

  console.log('subs found', subs?.length, 'for user_ids', user_ids)
  if (!subs?.length) return Response.json({ sent: 0 }, { headers: corsHeaders })

  let sent = 0
  for (const sub of subs) {
    try {
      const origin = new URL(sub.endpoint).origin
      const jwt = await signVapid(origin)
      const payload = JSON.stringify({ title, body, url: url ?? '/' })

      const res = await fetch(sub.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`,
          'TTL': '86400',
        },
      })
      console.log('push status', res.status, sub.endpoint.slice(0, 50))
      if (res.ok || res.status === 201) sent++
      else if (res.status === 410) await sbAdmin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      else console.error('Push failed', res.status, await res.text())
    } catch (e) { console.error('Push error', e) }
  }

  return Response.json({ sent }, { headers: corsHeaders })
})
