/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('push', event => {
  const data = event.data ? Promise.resolve(event.data.json()).catch(() => ({})) : Promise.resolve({})
  event.waitUntil(
    data.then((d: { title?: string; body?: string; url?: string }) =>
      self.registration.showNotification(d.title ?? 'Expogate', {
        body: d.body ?? 'Vous avez un nouveau message',
        icon: '/pwa-192x192.png',
        badge: '/pwa-64x64.png',
        data: { url: d.url ?? '/' },
      })
    )
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      if (clients.length > 0) {
        clients[0].focus().then(() => {
          setTimeout(() => {
            const bc = new BroadcastChannel('notif')
            bc.postMessage('OPEN_NOTIFICATIONS')
            setTimeout(() => bc.close(), 500)
          }, 300)
        })
        return
      }
      return self.clients.openWindow('/')
    })
  )
})
