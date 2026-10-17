const CACHE_NAME = "micropack-admin-v1";
const ADMIN_SHELL = [
  "/admin",
  "/styles.css?v=40",
  "/admin-auth.js?v=40",
  "/firebase-config.js?v=4",
  "/app.js?v=38",
  "/firebase-data.js?v=4",
  "/analysis.js?v=19",
  "/openings.js?v=32"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ADMIN_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("micropack-admin-") && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (request.mode === "navigate" && url.origin === self.location.origin && url.pathname === "/admin") {
    event.respondWith(networkFirst(request, "/admin"));
    return;
  }

  const cacheableAsset = ["script", "style", "font", "image"].includes(request.destination);
  if (cacheableAsset) event.respondWith(staleWhileRevalidate(request));
});

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(fallbackUrl, response.clone());
    return response;
  } catch {
    return (await cache.match(fallbackUrl)) || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const network = fetch(request).then(response => {
    if (response.ok || response.type === "opaque") cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || (await network) || Response.error();
}
