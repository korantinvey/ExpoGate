/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Serve index.html for all navigation requests (SPA offline support)
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

self.addEventListener('push', event => {
  const data = event.data ? Promise.resolve(event.data.json()).catch(() => ({})) : Promise.resolve({})
  event.waitUntil(
    data.then((d: { title?: string; body?: string; url?: string; message_id?: string }) =>
      self.registration.showNotification(d.title ?? 'Expogate', {
        body: d.body ?? 'Vous avez un nouveau message',
        icon: '/pwa-192x192.png',
        badge: '/pwa-64x64.png',
        data: { url: d.url ?? '/', message_id: d.message_id ?? null },
      })
    )
  )
})

self.addEventListener('notificationclick', event => {
  const messageId = event.notification.data?.message_id as string | null
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      if (clients.length > 0) {
        clients[0].focus().then(client => {
          setTimeout(() => {
            if (messageId) client.postMessage({ type: 'PUSH_CLICKED', messageId })
            const bc = new BroadcastChannel('notif')
            bc.postMessage('OPEN_NOTIFICATIONS')
            setTimeout(() => bc.close(), 500)
          }, 300)
        })
        return
      }
      return self.clients.openWindow(`/?push_clicked=${messageId ?? ''}`)
    })
  )
})
