"use client";

export function purgePrivateServiceWorkerCaches() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  navigator.serviceWorker.controller?.postMessage({ type: "FKH_PURGE_PRIVATE_CACHES" });

  if ("caches" in window) {
    void caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key.includes("pwa-pages")).map((key) => caches.delete(key)),
        ),
      );
  }
}
