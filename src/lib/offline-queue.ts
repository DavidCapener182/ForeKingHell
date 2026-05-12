export type OfflineActionKind = "import-csv" | "round-edit";

export type OfflineActionRecord = {
  id: string;
  kind: OfflineActionKind;
  payload: unknown;
  createdAt: string;
  retryCount: number;
};

const DB_NAME = "forekinghell-offline";
const DB_VERSION = 1;
const STORE_NAME = "pending-actions";

export async function countOfflineActions() {
  const db = await openOfflineDb();
  return new Promise<number>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function listOfflineActions() {
  const db = await openOfflineDb();
  return new Promise<OfflineActionRecord[]>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as OfflineActionRecord[]);
    request.onerror = () => reject(request.error);
  });
}

export async function queueOfflineAction(record: Omit<OfflineActionRecord, "createdAt" | "retryCount">) {
  const db = await openOfflineDb();
  const value: OfflineActionRecord = {
    ...record,
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };

  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(value);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  if ("serviceWorker" in navigator) {
    const registration = await serviceWorkerReadyWithTimeout().catch(() => null);

    if (registration) {
      const syncRegistration = registration as ServiceWorkerRegistration & {
        sync?: { register: (tag: string) => Promise<void> };
      };
      await syncRegistration.sync?.register("forekinghell-offline-sync").catch(() => undefined);
    }
  }

  notifyOfflineQueueChanged();
}

export async function removeOfflineAction(id: string) {
  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  notifyOfflineQueueChanged();
}

export async function incrementOfflineActionRetry(record: OfflineActionRecord) {
  const db = await openOfflineDb();
  const value: OfflineActionRecord = {
    ...record,
    retryCount: record.retryCount + 1,
  };

  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(value);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  notifyOfflineQueueChanged();
}

function notifyOfflineQueueChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("fkh-offline-queue-changed"));
  }
}

function serviceWorkerReadyWithTimeout() {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 1500)),
  ]);
}

function openOfflineDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
