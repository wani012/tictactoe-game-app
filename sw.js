const CACHE_NAME = 'furu-v7-libtl-monetag';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css?v=4.3',
  './game.js?v=4.3',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Network-first strategy, bypass ads from cache
self.addEventListener('fetch', (e) => {
  const url = e.request.url;
  // Always fetch real ads and analytics directly from network
  if (url.includes('libtl.com') || url.includes('alwingulla.com') || url.includes('gamedistribution.com') || url.includes('monetag.com') || url.includes('google')) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && e.request.method === 'GET') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => caches.match(e.request))
  );
});
