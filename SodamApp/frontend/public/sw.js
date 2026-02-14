// SodamFN Service Worker - App Shell + Network First Strategy
const CACHE_NAME = 'sodam-fn-v1';

// Static assets to cache for App Shell
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png'
];

// Install Event - Cache App Shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    // Activate immediately
    self.skipWaiting();
});

// Activate Event - Clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// Fetch Event - Network First for API, Cache First for static
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // API requests: Network First
    if (url.pathname.startsWith('/api') || url.pathname.startsWith('/dashboard') || url.pathname.startsWith('/analytics')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Clone and cache successful responses
                    if (response.ok) {
                        const cloned = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
                    }
                    return response;
                })
                .catch(() => {
                    // Fallback to cache if offline
                    return caches.match(request);
                })
        );
        return;
    }

    // Static assets: Cache First, then Network
    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) return cached;
            return fetch(request).then((response) => {
                // Cache new static resources
                if (response.ok && url.origin === self.location.origin) {
                    const cloned = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
                }
                return response;
            });
        })
    );
});
