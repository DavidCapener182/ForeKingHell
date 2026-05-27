"use client";

const OFFLINE_IMPORT_STORAGE_KEY = "forekinghell:offline-import-storage-enabled";

export function isOfflineImportStorageEnabled() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(OFFLINE_IMPORT_STORAGE_KEY) === "1";
}

export function setOfflineImportStorageEnabled(enabled: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  if (enabled) {
    window.localStorage.setItem(OFFLINE_IMPORT_STORAGE_KEY, "1");
  } else {
    window.localStorage.removeItem(OFFLINE_IMPORT_STORAGE_KEY);
  }

  window.dispatchEvent(new Event("fkh-offline-storage-preference-changed"));
}

export function subscribeOfflineImportStoragePreference(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("fkh-offline-storage-preference-changed", onChange);

  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("fkh-offline-storage-preference-changed", onChange);
  };
}
