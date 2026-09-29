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

/*
  EVERY PUSH ENDS IN showNotification(). NO EXCEPTIONS, NO EARLY RETURNS.

  The subscription is made with `userVisibleOnly: true`, which is a promise to
  the browser, and WebKit enforces it: a push that does not call
  showNotification() counts as a silent push, and after three of them — ever;
  the count does not reset — iOS revokes every subscription this origin has.
  The member finds the profile card saying notifications are off, with nothing
  on their side having turned them off. That is exactly what happened while
  this handler dropped chat pushes for a focused app.

  So a push we do not want to surface is still shown — silently, under its own
  tag — and closed at once. Chrome and Firefox do not need this (a visible tab
  exempts the push there), but it costs them nothing.
*/
const QUIET_TAG = 'quiet';

self.addEventListener('push', (event) => {
  event.waitUntil(handlePush(event));
});

async function handlePush(event) {
  const payload = readPayload(event);

  if (payload && !(await isNoise(payload))) {
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
    return;
  }

  // Its own tag, so closing it can never take a real chat notification with it.
  await self.registration.showNotification(payload?.title ?? '', {
    tag: QUIET_TAG,
    silent: true,
  });
  const quiet = await self.registration.getNotifications({ tag: QUIET_TAG });
  quiet.forEach((n) => n.close());
}

function readPayload(event) {
  try {
    return event.data ? event.data.json() : null;
  } catch {
    return null;
  }
}

/*
  A chat message while you are already looking at the app is noise. The server
  cannot know whether a window is focused, so the decision is made here, where
  it is knowable.

  Only chat is suppressed. A rank change or a new post is still worth surfacing
  even with the app open, because you may be on another screen.
*/
async function isNoise(payload) {
  if (payload.kind !== 'chat') return false;
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  return windows.some((c) => c.focused);
}

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
