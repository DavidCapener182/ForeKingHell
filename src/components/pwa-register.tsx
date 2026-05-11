"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      let cancelled = false;

      const clearLocalServiceWorker = async () => {
        const registrations = await navigator.serviceWorker.getRegistrations();
        const wasControlled = Boolean(navigator.serviceWorker.controller);
        const unregisterResults = await Promise.all(
          registrations.map((registration) => registration.unregister()),
        );

        if ("caches" in window) {
          const cacheKeys = await caches.keys();
          await Promise.all(
            cacheKeys
              .filter((key) => key.startsWith("forekinghell-pwa"))
              .map((key) => caches.delete(key)),
          );
        }

        if (!cancelled && wasControlled && unregisterResults.some(Boolean)) {
          window.location.reload();
        }
      };

      clearLocalServiceWorker().catch(() => {
        // A failed local cleanup should never block the app UI.
      });

      return () => {
        cancelled = true;
      };
    }

    const registerServiceWorker = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // A failed service-worker registration should never block the app UI.
      });
    };

    if (document.readyState === "complete") {
      registerServiceWorker();
      return;
    }

    window.addEventListener("load", registerServiceWorker, { once: true });
    return () => window.removeEventListener("load", registerServiceWorker);
  }, []);

  return null;
}
