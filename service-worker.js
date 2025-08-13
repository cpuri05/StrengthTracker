/*
 * Service worker for the Workout Tracker PWA.
 *
 * This service worker caches the application's core assets so that it
 * can be installed to the home screen on mobile devices and work
 * offline.  When installed, it pre-caches all files listed in the
 * urlsToCache array.  During fetch events, it attempts to serve
 * requests from the cache first, falling back to the network if
 * necessary.  When new versions of the app are deployed, the cache
 * name should be bumped so that outdated caches are purged.
 */

const CACHE_NAME = 'workout-tracker-v1';
// List of assets to cache.  These must be relative to the service
// worker's location.  Add any additional static files here if they
// should be available offline.
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './myreact.js',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Install event: cache the core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// Activate event: clean up any old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event: serve cached assets when available, otherwise fall back
// to the network.  For navigation requests (e.g., user loading the
// page), try the network first so that updates are fetched.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }
  // For navigation requests, use network first to ensure the latest
  // version of index.html is fetched.  For other resources, use cache
  // first falling back to the network.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html'))
    );
  } else {
    event.respondWith(
      caches.match(request).then((response) => {
        return response || fetch(request);
      })
    );
  }
});