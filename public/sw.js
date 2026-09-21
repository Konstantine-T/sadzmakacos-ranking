/*
  The service worker.

  DELIBERATELY DOES ALMOST NOTHING. A worker has to exist, and has to have a
  fetch handler, before a browser will offer to install the app — but caching is
  where service workers turn into a support problem. A stale cache means someone
  reading yesterday's chat with no way to explain it, and no way for them to
  clear it. So this one passes every request straight through to the network.

  Offline support is a separate, later decision. Installability is not.

*/

self.addEventListener('install', () => {
  // Take over immediately rather than waiting for every tab to close, so a
  // deploy is never half-applied.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // Intentionally empty: no respondWith, so the browser handles it normally.
});

/* ---------------------------------------------------------------- push --- */

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  event.waitUntil(
    (async () => {
      /*
        A chat message while you are already looking at the app is noise. The
        server cannot know whether a window is focused, so the decision is made
        here, where it is knowable.

        Only chat is suppressed. A rank change or a new post is still worth
        surfacing even with the app open, because you may be on another screen.
      */
      if (payload.kind === 'chat') {
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        if (windows.some((c) => c.focused)) return;
      }

      await self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        // Same tag per kind, so ten chat messages replace each other in the
        // shade rather than burying everything else you had waiting.
        tag: payload.kind,
        renotify: true,
        data: { url: payload.url || '/' },
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

      // Reuse an open window rather than stacking another one up. Focusing an
      // existing tab and navigating it is what a native app does.
      for (const client of windows) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) await client.navigate(target);
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
