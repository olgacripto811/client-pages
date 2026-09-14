// Минимальный service worker для личного кабинета (kabinet-*.html).
// Регистрируется только со страниц кабинета, не со всего сайта.
//
// Стратегия: cache-first для статики кабинета (быстрая загрузка оболочки
// офлайн), network-first для /api/** (данные всегда должны быть свежими —
// сигналы, баланс, история — кэш там только как офлайн-заглушка на случай
// потери сети).

const CACHE_NAME = 'kabinet-v1';
const APP_SHELL = [
  'kabinet-glavnaya.html',
  'kabinet-admin.html',
  'kabinet-vhod.html',
  'manifest.json',
  'assets/icon-192.png',
  'assets/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return; // не трогаем чужие origin и не-GET запросы (POST к /api/** и т.п.)
  }

  if (url.pathname.startsWith('/api/')) {
    // network-first: данные должны быть свежими, кэш — только на случай офлайна.
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // cache-first для статики оболочки кабинета.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match('kabinet-glavnaya.html'));
    })
  );
});
