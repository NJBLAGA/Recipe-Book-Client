import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

self.addEventListener('push', (event) => {
  if (!event.data) return;
  const rawData = event.data.json() as Record<string, unknown>;
  const title = typeof rawData.title === 'string' ? rawData.title : 'Recipe Book';
  const body = typeof rawData.body === 'string' ? rawData.body : '';
  const tag = typeof rawData.tag === 'string' ? rawData.tag : 'timer';
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const open = clients.find((c) => 'focus' in c);
        if (open) return (open as WindowClient).focus();
        return self.clients.openWindow('/recipes');
      }),
  );
});
