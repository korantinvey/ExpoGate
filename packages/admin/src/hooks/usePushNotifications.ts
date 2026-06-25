import { useEffect } from 'react'
import { sb } from '../lib/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export function usePushNotifications(userId: string | null) {
  useEffect(() => {
    if (!userId || !VAPID_PUBLIC_KEY) return
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return

    async function subscribe() {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return

      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      const { endpoint, keys } = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
      await sb.from('push_subscriptions').upsert({
        user_id: userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      }, { onConflict: 'user_id,endpoint' })
    }

    subscribe().catch(() => {})
  }, [userId])
}
