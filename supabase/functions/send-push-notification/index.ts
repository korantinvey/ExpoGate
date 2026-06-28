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

// ── Helpers ───────────────────────────────────────────────────────────────────

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4)
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
}

function bytesToB64url(b: Uint8Array): string {
  return btoa(String.fromCharCode(...b)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0))
  let i = 0
  for (const a of arrays) { out.set(a, i); i += a.length }
  return out
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8))
}

// ── RFC 8291 aes128gcm payload encryption ─────────────────────────────────────

async function encryptPayload(plaintext: string, p256dh: string, authSecret: string): Promise<Uint8Array> {
  const enc = new TextEncoder()
  const clientPubBytes = b64urlToBytes(p256dh)
  const authBytes = b64urlToBytes(authSecret)

  const clientPubKey = await crypto.subtle.importKey(
    'raw', clientPubBytes, { name: 'ECDH', namedCurve: 'P-256' }, false, []
  )
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
  )
  const serverPubBytes = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeyPair.publicKey))

  const ecdhBits = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: clientPubKey }, serverKeyPair.privateKey, 256)
  )

  const salt = crypto.getRandomValues(new Uint8Array(16))

  // IKM = HKDF(auth, ecdh_secret, "WebPush: info\x00" || client_pub || server_pub, 32)
  const ikm = await hkdf(
    authBytes, ecdhBits,
    concat(enc.encode('WebPush: info\x00'), clientPubBytes, serverPubBytes),
    32
  )

  const cek   = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\x00'), 16)
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\x00'), 12)

  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt'])

  // Padding delimiter 0x02 (last-record marker per RFC 8291)
  const content = concat(enc.encode(plaintext), new Uint8Array([0x02]))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, content)
  )

  // Header: salt (16) | rs (4 BE) | idlen (1) | server_pub (65) | ciphertext
  const rs = new Uint8Array(4)
  new DataView(rs.buffer).setUint32(0, 4096, false)

  return concat(salt, rs, new Uint8Array([65]), serverPubBytes, ciphertext)
}

// ── VAPID ─────────────────────────────────────────────────────────────────────

async function getVapidKey() {
  return await jose.importJWK(
    { kty: 'EC', crv: 'P-256', d: VAPID_PRIVATE_KEY, x: '', y: '' }, 'ES256'
  ).catch(async () => {
    const pub = b64urlToBytes(VAPID_PUBLIC_KEY)
    return await jose.importJWK(
      { kty: 'EC', crv: 'P-256', d: VAPID_PRIVATE_KEY, x: bytesToB64url(pub.slice(1, 33)), y: bytesToB64url(pub.slice(33, 65)) },
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

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const { user_ids, title, body, url } = await req.json() as {
    user_ids: string[]; title: string; body: string; url?: string
  }

  if (!title || !body) {
    return Response.json({ error: 'title and body are required' }, { status: 400, headers: corsHeaders })
  }

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
      const encryptedBody = await encryptPayload(payload, sub.p256dh, sub.auth)

      const res = await fetch(sub.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`,
          'Content-Type': 'application/octet-stream',
          'Content-Encoding': 'aes128gcm',
          'TTL': '86400',
          'Content-Length': String(encryptedBody.length),
        },
        body: encryptedBody,
      })
      console.log('push status', res.status, sub.endpoint.slice(0, 50))
      if (res.ok || res.status === 201) sent++
      else if (res.status === 410) {
        await sbAdmin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      } else {
        console.error('Push failed', res.status, await res.text())
      }
    } catch (e) { console.error('Push error', e) }
  }

  return Response.json({ sent }, { headers: corsHeaders })
})
