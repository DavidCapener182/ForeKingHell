"use client";

import { clearOfflineActions } from "@/lib/offline-queue";

export async function purgePrivateClientData() {
  await clearOfflineActions().catch(() => undefined);
  purgeCompanionLocalData();

  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

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

export function purgeCompanionDataForOtherAccounts(activeUserId: string) {
  if (typeof window === "undefined") return;
  for (const key of companionLocalStorageKeys()) {
    if (!key.includes(`:${activeUserId}`)) window.localStorage.removeItem(key);
  }
}

function purgeCompanionLocalData() {
  if (typeof window === "undefined") return;
  for (const key of companionLocalStorageKeys()) window.localStorage.removeItem(key);
}

function companionLocalStorageKeys() {
  const prefixes = [
    "fkh:active-practice:",
    "fkh:quick-bag:",
    "fkh:round-download:",
    "fkh:recent-review:",
  ];
  return Array.from({ length: window.localStorage.length }, (_, index) =>
    window.localStorage.key(index),
  ).filter((key): key is string =>
    Boolean(key && prefixes.some((prefix) => key.startsWith(prefix))),
  );
}
