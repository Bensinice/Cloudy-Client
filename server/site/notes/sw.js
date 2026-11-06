// Cloudy Notes – Service Worker. Nur App-Dateien (Offline-Start); Notizen/API laufen nie ueber diesen Cache.
// VERSION muss mit APP_VERSION in app.js und ?v= in index.html uebereinstimmen (wird getestet). Neue Version = neuer Cache, alter wird geloescht.
const VERSION = '1.0.0', CACHE = 'cloudy-notes-' + VERSION;
const FILES = ['./', 'index.html', 'app.js?v=' + VERSION, 'app.css?v=' + VERSION, 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
self.addEventListener('install', e => {
  // cache:'reload' umgeht den HTTP-Cache: nie alte JS/CSS-Dateien in den neuen Cache laden
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(FILES.map(f => fetch(new Request(f, { cache: 'reload' })).then(r => { if (!r.ok) throw new Error(f + ' ' + r.status); return c.put(f, r); })))));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('cloudy-notes-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || !u.pathname.startsWith('/notes/')) return;
  if (r.mode === 'navigate') { // Seite: erst Netz (immer aktuell), offline aus dem Cache
    e.respondWith(fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put('index.html', cp)); } return res; }).catch(() => caches.match('index.html').then(m => m || caches.match('./'))));
    return;
  }
  if (!/\.(js|css|png|webmanifest)$/.test(u.pathname)) return; // alles andere (API wie /notes/info) geht direkt ins Netz
  const k = u.pathname.split('/').pop() + (u.search || '');
  e.respondWith(caches.match(r.url.replace(location.origin + '/notes/', '')).then(m => m || caches.match(k)).then(m => m || fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(k, cp)); } return res; })));
});
