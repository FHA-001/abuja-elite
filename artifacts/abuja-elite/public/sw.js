/* Abuja Elite service worker.
   Deliberately small and safe:
   - It only touches files from this website. Supabase, fonts and anything else pass straight through.
   - It never stores pages, accounts or data, so nobody sees stale or someone else's information.
   - Built files in /assets/ have a unique name per release, so they are kept for speed.
   - If the phone is offline when opening a page, it shows a friendly offline screen. */
const VERSION = 'v1';
const ASSETS = `ae-assets-${VERSION}`;
const SHELL = `ae-shell-${VERSION}`;
const SCOPE = new URL(self.registration.scope);
const OFFLINE_URL = new URL('offline.html', SCOPE).href;
const ICON_URL = new URL('icon-192.png', SCOPE).href;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll([OFFLINE_URL, ICON_URL])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key !== ASSETS && key !== SHELL) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== SCOPE.origin) return; // never touch other websites (Supabase, fonts, ...)

  // The offline screen and its logo are kept so they work with no signal.
  if (request.url === OFFLINE_URL || request.url === ICON_URL) {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
    return;
  }

  // Built files: unique names per release, safe to keep.
  if (url.pathname.startsWith(`${SCOPE.pathname}assets/`)) {
    event.respondWith((async () => {
      const cache = await caches.open(ASSETS);
      const hit = await cache.match(request);
      if (hit) return hit;
      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    })());
    return;
  }

  // Opening a page: always the live site; offline screen only when there is no connection.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error()));
  }
});
