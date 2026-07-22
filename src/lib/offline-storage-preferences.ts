"use client";

const OFFLINE_IMPORT_STORAGE_KEY = "forekinghell:offline-import-storage-enabled";
const OFFLINE_IMPORT_RETENTION_KEY = "forekinghell:offline-import-retention-days";
const OFFLINE_LAST_SYNC_KEY = "forekinghell:offline-last-sync-at";

export const offlineImportRetentionOptions = [0, 1, 3, 7] as const;
export type OfflineImportRetentionDays = (typeof offlineImportRetentionOptions)[number];

export function isOfflineImportStorageEnabled() {
  return offlineImportRetentionDays() > 0;
}

export function offlineImportRetentionDays(): OfflineImportRetentionDays {
  if (typeof window === "undefined") {
    return 0;
  }

  const configured = Number(window.localStorage.getItem(OFFLINE_IMPORT_RETENTION_KEY));
  if (offlineImportRetentionOptions.includes(configured as OfflineImportRetentionDays)) {
    return configured as OfflineImportRetentionDays;
  }

  return window.localStorage.getItem(OFFLINE_IMPORT_STORAGE_KEY) === "1" ? 7 : 0;
}

export function setOfflineImportStorageEnabled(enabled: boolean) {
  setOfflineImportRetentionDays(enabled ? 7 : 0);
}

export function setOfflineImportRetentionDays(retentionDays: OfflineImportRetentionDays) {
  if (typeof window === "undefined") {
    return;
  }

  if (retentionDays > 0) {
    window.localStorage.setItem(OFFLINE_IMPORT_RETENTION_KEY, String(retentionDays));
  } else {
    window.localStorage.removeItem(OFFLINE_IMPORT_RETENTION_KEY);
  }
  window.localStorage.removeItem(OFFLINE_IMPORT_STORAGE_KEY);

  window.dispatchEvent(new Event("fkh-offline-storage-preference-changed"));
}

export function getOfflineLastSyncAt() {
  return typeof window === "undefined" ? null : window.localStorage.getItem(OFFLINE_LAST_SYNC_KEY);
}

export function setOfflineLastSyncAt(value = new Date().toISOString()) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(OFFLINE_LAST_SYNC_KEY, value);
    window.dispatchEvent(new Event("fkh-offline-storage-preference-changed"));
  }
}

export function subscribeOfflineImportStoragePreference(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("fkh-offline-storage-preference-changed", onChange);

  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("fkh-offline-storage-preference-changed", onChange);
  };
}
