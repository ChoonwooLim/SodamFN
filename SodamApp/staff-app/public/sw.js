// Auto-versioned by build timestamp
const CACHE_VERSION = '__BUILD_TIME__';
const CACHE_NAME = `sodam-staff-${CACHE_VERSION}`;

// Only cache essential shell files
const SHELL_FILES = [
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png'
];

// Install — cache shell, skip waiting immediately
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
    );
    self.skipWaiting();
});

// Activate — delete ALL old caches, claim clients immediately
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((names) =>
            Promise.all(
                names
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            )
        ).then(() => self.clients.claim())
            .then(() => {
                // Notify all clients that a new version is active
                self.clients.matchAll().then((clients) => {
                    clients.forEach((client) => {
                        client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION });
                    });
                });
            })
    );
});

// Fetch strategy
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Skip non-GET and API calls
    if (request.method !== 'GET' || request.url.includes('/api/')) {
        return;
    }

    const url = new URL(request.url);

    // index.html & navigation — ALWAYS network first, never serve stale
    if (request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
        event.respondWith(
            fetch(request, { cache: 'no-store' })
                .catch(() => caches.match('/index.html'))
        );
        return;
    }

    // Hashed assets (/assets/*) — cache first (immutable)
    if (url.pathname.startsWith('/assets/')) {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached;
                return fetch(request).then((response) => {
                    if (response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((c) => c.put(request, clone));
                    }
                    return response;
                });
            })
        );
        return;
    }

    // Everything else — network first, cache fallback
    event.respondWith(
        fetch(request)
            .then((response) => {
                if (response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((c) => c.put(request, clone));
                }
                return response;
            })
            .catch(() => caches.match(request))
    );
});
