// Offline support: stale-while-revalidate. The cached copy is served at once (instant launch, works offline)
// and refreshed from the network in the background, so updates show on the next launch.
const CACHE = 'apex-v3';
const FILES = ['./', './index.html', './studies.js', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request, { cache: 'no-cache' }).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; });
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return net;
  }));
});

// Rest timer: the page posts {type:'rest', end} (end 0 cancels). Keep the worker alive until then and
// notify only if no window is visible; a visible page beeps on its own. Platforms that suspend
// background workers (iOS) may not deliver this.
let restGen = 0;
self.addEventListener('message', e => {
  const d = e.data || {};
  if (d.type !== 'rest') return;
  const gen = ++restGen;
  if (!d.end) return;
  e.waitUntil(new Promise(r => setTimeout(r, Math.max(0, d.end - Date.now()))).then(async () => {
    if (gen !== restGen) return;
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (wins.some(w => w.visibilityState === 'visible')) return;
    return self.registration.showNotification('Отдых окончен', { body: 'Пора на следующий подход', tag: 'rest', renotify: true, vibrate: [200, 100, 200], icon: 'icon-192.png' });
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => ws[0] ? ws[0].focus() : self.clients.openWindow('./')));
});
