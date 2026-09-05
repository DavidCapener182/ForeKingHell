const CACHE_NAME = "forekinghell-pwa-v8";
const PAGE_CACHE_NAME = "forekinghell-pwa-pages-v3";
const OFFLINE_SAFE_PAGE_PATHS = new Set(["/login", "/offline", "/privacy"]);
const PRECACHE_ASSETS = [
  "/offline",
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
      .then(async (cache) => {
        await cache.addAll(PRECACHE_ASSETS);
        // Cache the static offline shell's scripts and styles, never private page HTML.
        const offline = await cache.match("/offline");
        const html = offline ? await offline.text() : "";
        const assets = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
          .map((match) => new URL(match[1], self.location.origin))
          .filter(
            (url) =>
              url.origin === self.location.origin && url.pathname.startsWith("/_next/static/"),
          )
          .map((url) => url.href);
        await cache.addAll([...new Set(assets)]);
      })
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

  if (event.data?.type === "FKH_PURGE_PRIVATE_CACHES") {
    event.waitUntil(caches.delete(PAGE_CACHE_NAME));
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
  const url = new URL(request.url);

  try {
    const response = await fetch(request);
    const responseUrl = new URL(response.url);
    const cacheControl = response.headers.get("cache-control")?.toLowerCase() ?? "";

    if (
      response.ok &&
      OFFLINE_SAFE_PAGE_PATHS.has(url.pathname) &&
      !response.redirected &&
      responseUrl.origin === url.origin &&
      responseUrl.pathname === url.pathname &&
      !cacheControl.includes("private") &&
      !cacheControl.includes("no-store") &&
      !request.headers.get("cookie") &&
      !response.headers.has("set-cookie") &&
      response.headers.get("content-type")?.includes("text/html")
    ) {
      cache.put(request, response.clone());
    }

    return response;
  } catch {
    const cached =
      (OFFLINE_SAFE_PAGE_PATHS.has(url.pathname) ? await cache.match(request) : null) ||
      (await cache.match("/offline"));

    return (
      cached ||
      new Response("LM World Tour is offline and this page is not cached yet.", {
        status: 503,
        headers: { "content-type": "text/plain; charset=utf-8" },
      })
    );
  }
}
