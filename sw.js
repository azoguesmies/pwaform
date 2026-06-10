const CACHE = 'pwa-form-v4';
//~ const FILES = [
  //~ '/', '/index.html', '/manifest.json',
  //~ '/style.css', '/script.js',
  //~ '/icon-192.svg', '/icon-512.svg'
//~ ];


const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/icon-192.svg', '/icon-512.svg'
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
];

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

// Activación del Service Worker
self.addEventListener('activate', event => {
  console.log('Service Worker: Activado');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Limpiando cache antiguo:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  event.waitUntil(clients.claim());
});

// Estrategia: Network First con fallback a cache
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Excluir peticiones a la API
  if (url.origin === 'http://localhost:8000' || url.origin.includes('localhost')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // Excluir peticiones a PDF.js worker
  if (url.pathname.includes('pdf.worker.min.js')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const responseToCache = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => {
            if (event.request.method === 'GET') {
              cache.put(event.request, responseToCache);
            }
          })
          .catch(err => console.error('Error guardando en cache:', err));
        return response;
      })
      .catch(() => {
        return caches.match(event.request)
          .then(response => {
            if (response) {
              return response;
            }
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('/');
            }
            return new Response('Recurso no disponible offline', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

// Manejo de mensajes
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
