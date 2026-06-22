// Momentum Habit Tracker — Service Worker
// Version bump here to force cache refresh on redeploy
const CACHE_VERSION = 'v1.7.0';
const CACHE_NAME = `momentum-${CACHE_VERSION}`;
const OFFLINE_URL = '/';

// All assets to precache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/planner.css',
  '/css/versioning.css',
  '/css/realtime.css',
  '/css/focus.css',
  '/js/planner.js',
  '/js/versioning.js',
  '/js/realtime.js',
  '/js/focus.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-192-maskable.png',
  '/icons/icon-512-maskable.png',
];

// External resources to cache at runtime (CDN assets)
const RUNTIME_CDN = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://cdn.jsdelivr.net',
];

// ─── INSTALL ───────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting()) // Activate immediately
  );
});

// ─── ACTIVATE ──────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key)) // Remove old caches
      )
    ).then(() => self.clients.claim()) // Take control of all open pages
  );
});

// ─── FETCH ─────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip browser-sync, chrome-extension, or non-http requests
  if (!request.url.startsWith('http')) return;

  // For CDN requests: Network first, fallback to cache
  if (RUNTIME_CDN.some(cdn => request.url.startsWith(cdn))) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // For same-origin requests: Cache first, fallback to network, then offline page
  if (url.origin === location.origin) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // For all other cross-origin requests: Network only
  event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
});

// ─── STRATEGIES ────────────────────────────────────────────────────────────

// Cache First: Serve from cache, update cache in background, fallback to network
async function cacheFirstStrategy(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  if (cached) {
    // Refresh cache in background (stale-while-revalidate)
    fetch(request)
      .then(response => {
        if (response && response.status === 200) {
          cache.put(request, response.clone());
        }
      })
      .catch(() => {}); // Fail silently — we have the cached version
    return cached;
  }

  // Not in cache: fetch from network and cache it
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // If network fails for a navigation request, serve offline page
    if (request.mode === 'navigate') {
      return cache.match(OFFLINE_URL);
    }
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// Network First: Try network, fallback to cache
async function networkFirstStrategy(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return cache.match(request);
  }
}

// ─── UPDATE NOTIFICATION ───────────────────────────────────────────────────
// Tell all clients a new version is available
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Broadcast update available to all open clients
self.addEventListener('activate', event => {
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION });
      });
    })
  );
});

// ─── NOTIFICATION CLICK HANDLING ──────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (let client of clients) {
        if (client.url && 'focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            tag: event.notification.tag,
            action: event.action
          });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});
