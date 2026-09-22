const CACHE_NAME = 'hkbc-shell-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // Keep requests network-controlled. Registration is required for installability,
  // but caching Next.js data and deployments here would make updates unreliable.
});