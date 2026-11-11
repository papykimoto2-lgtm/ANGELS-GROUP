/* Service worker 11Barré : pages réseau d'abord (mises à jour immédiates), cache en secours pour l'usage hors ligne. */
const V = "onzebarre-v1";
const COQUE = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => Promise.all(COQUE.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== location.origin) return;
  e.respondWith(fetch(r).then(res => { if (res.ok) { const c = res.clone(); caches.open(V).then(k => k.put(r, c)); } return res; }).catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || caches.match("index.html"))));
});
