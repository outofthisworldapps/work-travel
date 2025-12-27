// Minimal Service Worker to enable PWA installation (WebAPK)
// This allows Chrome to remove the browser badge from the icon.

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // We can just let the browser handle requests normally
    event.respondWith(fetch(event.request));
});
