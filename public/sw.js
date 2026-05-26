const CACHE_NAME = "forekinghell-pwa-v4";
const PAGE_CACHE_NAME = "forekinghell-pwa-pages-v1";
const PRECACHE_ASSETS = [
  "/manifest.webmanifest",
  "/icons/favicon-16x16.png",
  "/icons/favicon-32x32.png",
  "/icons/apple-touch-icon.png",
  "/icons/lmwt-icon-192.png",
  "/icons/lmwt-icon-512.png",
  "/icons/lmwt-icon-maskable-192.png",
  "/icons/lmwt-icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== PAGE_CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  const isLocalDevelopmentHost =
    self.location.hostname === "localhost" ||
    self.location.hostname === "127.0.0.1" ||
    self.location.hostname === "[::1]";

  if (isLocalDevelopmentHost && url.pathname.startsWith("/_next/")) {
    return;
  }

  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest";

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then((response) => {
          if (response.ok) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
          }

          return response;
        });
      }),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
  }
});

self.addEventListener("sync", (event) => {
  if (event.tag === "forekinghell-offline-sync") {
    event.waitUntil(
      self.clients.matchAll({ type: "window" }).then((clients) => {
        clients.forEach((client) => client.postMessage({ type: "FKH_OFFLINE_SYNC_REQUESTED" }));
      }),
    );
  }
});

async function networkFirstPage(request) {
  const cache = await caches.open(PAGE_CACHE_NAME);

  try {
    const response = await fetch(request);

    if (response.ok && response.headers.get("content-type")?.includes("text/html")) {
      cache.put(request, response.clone());
    }

    return response;
  } catch {
    const cached = await cache.match(request);
    return (
      cached ||
      new Response("LM World Tour is offline and this page is not cached yet.", {
        status: 503,
        headers: { "content-type": "text/plain; charset=utf-8" },
      })
    );
  }
}
