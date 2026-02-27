// SodamFN Service Worker - App Shell + Network First Strategy
// Development mode: self-destruct to prevent stale cache issues
const IS_DEV = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

if (IS_DEV) {
    // In development, immediately unregister and clear all caches
    self.addEventListener('install', () => self.skipWaiting());
    self.addEventListener('activate', (event) => {
        event.waitUntil(
            caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
                .then(() => self.clients.claim())
                .then(() => self.registration.unregister())
                .then(() => {
                    // Notify all clients to reload
                    self.clients.matchAll().then(clients => {
                        clients.forEach(client => client.navigate(client.url));
                    });
                })
        );
    });
} else {
    // === PRODUCTION MODE ===
    const CACHE_NAME = 'sodam-fn-v2';

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

    // Fetch Event - Network First for all, fallback to cache
    self.addEventListener('fetch', (event) => {
        const { request } = event;
        if (request.method !== 'GET') return;

        // Always try network first, fall back to cache
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response.ok) {
                        const cloned = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
                    }
                    return response;
                })
                .catch(() => {
                    return caches.match(request);
                })
        );
    });
}
