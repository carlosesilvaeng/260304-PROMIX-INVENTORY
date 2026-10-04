// Cache the application shell only. API responses, tokens and drafts never enter
// this cache; authenticated drafts are isolated in IndexedDB instead.
const CACHE = 'promix-inventory-shell-phase2-v1';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add('/')));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('promix-inventory-shell-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type !== 'CACHE_SHELL') return;
  const urls = (event.data.urls || []).filter(value => {
    const url = new URL(value, self.location.origin);
    return url.origin === self.location.origin && (url.pathname === '/' || url.pathname.startsWith('/assets/'));
  });
  event.waitUntil(caches.open(CACHE).then(cache => Promise.allSettled(urls.map(url => cache.add(url)))));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(async response => {
      if (response.ok) (await caches.open(CACHE)).put('/', response.clone());
      return response;
    }).catch(() => caches.match('/')));
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(async response => {
      if (response.ok) (await caches.open(CACHE)).put(event.request,response.clone());
      return response;
    })));
  }
});
