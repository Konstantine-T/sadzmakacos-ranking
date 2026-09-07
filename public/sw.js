/*
  The service worker.

  DELIBERATELY DOES ALMOST NOTHING. A worker has to exist, and has to have a
  fetch handler, before a browser will offer to install the app — but caching is
  where service workers turn into a support problem. A stale cache means someone
  reading yesterday's chat with no way to explain it, and no way for them to
  clear it. So this one passes every request straight through to the network.

  Offline support is a separate, later decision. Installability is not.

  Push handlers land here in part two.
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
