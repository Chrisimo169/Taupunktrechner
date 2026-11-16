/* Taupunktrechner: hält die App nach dem ersten Öffnen offline bereit.
   Bedient ausschließlich die vier eigenen Dateien der App. Alle anderen
   Anfragen fasst er nicht an, fremde Server ruft er nie auf. */
const CACHE = 'taupunktrechner-v2';
const SCOPE = self.registration.scope;                       // Ordner der App, endet mit /
const INDEX = SCOPE + 'index.html';
const FILES = new Set(['index.html', 'manifest.json', 'icon-192.png', 'icon-512.png'].map(name => SCOPE + name));

/* Adresse ohne Anhängsel. Die Ordner-Adresse steht für index.html. */
function keyFor(request) {
  const url = new URL(request.url);
  url.search = '';
  url.hash = '';
  return url.href === SCOPE ? INDEX : url.href;
}

/* Abgelegt wird nur eine echte, vollständige Antwort vom eigenen Server. */
const usable = res => res.ok && res.type === 'basic' && !res.redirected;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll([...FILES].map(url => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('taupunktrechner-') && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

/* Bei Netz im Hintergrund auffrischen. Jede Datei landet nur unter ihrer eigenen Adresse. */
async function refresh(cache, key) {
  try {
    const res = await fetch(key, { cache: 'no-cache' });
    if (usable(res)) await cache.put(key, res);
  } catch (err) { /* offline: die abgelegte Fassung bleibt */ }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const key = keyFor(request);
  if (!FILES.has(key)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(key);
    if (hit) {
      event.waitUntil(refresh(cache, key));
      return hit;
    }
    const res = await fetch(request);
    if (usable(res)) await cache.put(key, res.clone());
    return res;
  })());
});
