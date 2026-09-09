// ============================================================
// sw.js — Service Worker for Discipline PWA
// Offline caching, fast background updates, and standalone support
// ============================================================

const CACHE_NAME = 'discipline-v1.0.3';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.svg',
  './favicon.ico',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './css/main.css',
  './css/components.css',
  './css/animations.css',
  './css/responsive.css',
  './js/app.js',
  './js/auth.js',
  './js/data.js',
  './js/dashboard.js',
  './js/habits.js',
  './js/streaks.js',
  './js/analytics.js',
  './js/calendar.js',
  './js/achievements.js',
  './js/rewards.js',
  './js/xp.js',
  './js/ui.js',
  './js/icons.js',
  './js/email-validator.js',
  './js/onboarding.js',
  './js/firebase-config.js'
];

// Install Event: Precache core application shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Precache partial error (non-fatal):', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up stale caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Stale-While-Revalidate with offline fallback
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests or Firebase / Google Auth APIs
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) {
    // For Google Fonts or CDN assets: Stale-while-revalidate
    if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
      event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
          const cached = await cache.match(request);
          const networkPromise = fetch(request).then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          }).catch(() => null);
          return cached || networkPromise;
        })
      );
    }
    return;
  }

  // Navigation requests: Network-first, fallback to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match('./index.html') || caches.match('./');
      })
    );
    return;
  }

  // App Shell & Static assets: Stale-While-Revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(request);

      const networkFetch = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      }).catch((err) => {
        // Silent catch for network drops
        return null;
      });

      return cachedResponse || networkFetch;
    })
  );
});
