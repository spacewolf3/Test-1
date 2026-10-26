/* Lets the app open without a connection. App files are fetched fresh when
   online (so updates show up right away) and served from the cache when offline.
   Requests to other sites (topic sources, covers, fonts) are left alone. */
const CACHE = "my-paper-v1";
const SHELL = [
  "./", "index.html", "manifest.webmanifest", "css/styles.css",
  "js/store.js", "js/format.js", "js/evergreen.js", "js/feeds.js", "js/sources.js", "js/books.js", "js/app.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "icons/favicon-32.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match("index.html")))
  );
});
