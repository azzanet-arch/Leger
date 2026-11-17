// Réseau d'abord (mises à jour immédiates), cache en secours pour l'usage hors ligne.
const CACHE = 'leger-v8';
const ASSETS = ['./', './index.html', './config.js', './manifest.webmanifest', './icon.svg', './legal.html'];
const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const cacheable = url.origin === location.origin || req.url.startsWith(CDN);
  if (!cacheable) return; // API Supabase / Stripe : jamais de cache
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: req.mode === 'navigate' })
      .then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
