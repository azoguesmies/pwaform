const CACHE = 'pwa-form-v2';
const STATIC = [
  '/',
  '/index.html',
  '/manifest.json',
  '/style.css',
  '/script.js',
  '/icon-192.svg',
  '/icon-512.svg'
];

// ── Instalación: precargar app shell ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

// ── Activación: limpiar caches viejos ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first para estáticos, network-first para el resto ──
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Solo interceptar mismositio
  if (url.origin !== location.origin) return;

  // Cache-first para los recursos estáticos
  if (STATIC.includes(url.pathname)) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
    return;
  }

  // Network-first para el resto (ej: fuentes, CDN)
  e.respondWith(
    fetch(e.request).then(r => {
      const clone = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return r;
    }).catch(() => caches.match(e.request).then(r => r || new Response('Offline', { status: 503 })))
  );
});

// ── Mensajes del cliente ──
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
