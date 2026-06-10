const CACHE = 'pwa-form-v4';
const FILES = [
  '/', '/index.html', '/manifest.json',
  '/style.css', '/script.js',
  '/icon-192.svg', '/icon-512.svg'
];

//self.addEventListener('install', e => {
  //e.waitUntil(
    //caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())
  //);
//});

// Instalación del Service Worker
self.addEventListener('install', event => {
  console.log('Service Worker: Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Cache abierto');
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.error('Error en cache:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
