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
export const OFFLINE_IMPORT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function countOfflineActions() {
  const db = await openOfflineDb();
  await purgeExpiredOfflineActionsFromDb(db);
  return new Promise<number>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function listOfflineActions() {
  const db = await openOfflineDb();
  await purgeExpiredOfflineActionsFromDb(db);
  return new Promise<OfflineActionRecord[]>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as OfflineActionRecord[]);
    request.onerror = () => reject(request.error);
  });
}

export async function queueOfflineAction(
  record: Omit<OfflineActionRecord, "createdAt" | "retryCount">,
) {
  const db = await openOfflineDb();
  await purgeExpiredOfflineActionsFromDb(db);
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

export async function clearOfflineActions() {
  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  notifyOfflineQueueChanged();
}

export async function purgeExpiredOfflineActions() {
  const db = await openOfflineDb();
  const deleted = await purgeExpiredOfflineActionsFromDb(db);
  if (deleted > 0) {
    notifyOfflineQueueChanged();
  }
  return deleted;
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

async function purgeExpiredOfflineActionsFromDb(db: IDBDatabase) {
  const records = await new Promise<OfflineActionRecord[]>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as OfflineActionRecord[]);
    request.onerror = () => reject(request.error);
  });
  const expiredIds = records
    .filter((record) => record.kind === "import-csv" && isExpired(record.createdAt))
    .map((record) => record.id);

  if (expiredIds.length === 0) {
    return 0;
  }

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    expiredIds.forEach((id) => store.delete(id));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });

  return expiredIds.length;
}

function isExpired(createdAt: string) {
  const timestamp = Date.parse(createdAt);
  return Number.isFinite(timestamp) && Date.now() - timestamp > OFFLINE_IMPORT_TTL_MS;
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
