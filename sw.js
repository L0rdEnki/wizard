// Carries the app version (see CHANGELOG.md), so every release refreshes the cache.
const CACHE_NAME = 'wizard-pwa-1.0.0';

const APP_SHELL = [
  './',
  './index.html',
  './js/app.js',
  './js/rules.js',
  './js/version.js',
  './css/tailwind.css',
  './style.css',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Versioned CDN files never change, so they are served cache-first.
const CDN_HOSTS = ['unpkg.com'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

const putInCache = (request, response) => {
  if (response.ok || response.type === 'opaque') {
    const copy = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
  }
  return response;
};

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(response => putInCache(request, response)))
    );
    return;
  }

  if (url.origin === self.location.origin) {
    // Network first so updates arrive immediately; the cache keeps the app working offline.
    event.respondWith(
      fetch(request)
        .then(response => putInCache(request, response))
        .catch(() => caches.match(request, { ignoreSearch: true }))
    );
  }
});
