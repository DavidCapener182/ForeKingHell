import { offlineImportRetentionDays } from "@/lib/offline-storage-preferences";

export type OfflineActionKind = "import-csv" | "round-edit";
export type OfflineActionStatus = "pending" | "dead_letter";

export type OfflineActionRecord = {
  id: string;
  kind: OfflineActionKind;
  ownerUserId: string;
  payload: unknown;
  createdAt: string;
  retryCount: number;
  schemaVersion?: number;
  status?: OfflineActionStatus;
  expiresAt?: string | null;
  lastAttemptAt?: string | null;
  nextRetryAt?: string | null;
  lastErrorCode?: string | null;
};

const DB_NAME = "forekinghell-offline";
const DB_VERSION = 2;
const STORE_NAME = "pending-actions";
export const OFFLINE_IMPORT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const OFFLINE_QUEUE_SCHEMA_VERSION = 2;
export const MAX_OFFLINE_RETRY_COUNT = 5;

export async function countOfflineActions(ownerUserId: string) {
  return (await listOfflineActions(ownerUserId)).length;
}

export async function listOfflineActions(ownerUserId: string) {
  const db = await openOfflineDb();
  await purgeExpiredOfflineActionsFromDb(db);
  const records = await new Promise<OfflineActionRecord[]>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as OfflineActionRecord[]);
    request.onerror = () => reject(request.error);
  });
  return offlineActionsForAccount(records, ownerUserId);
}

export async function queueOfflineAction(
  record: Omit<OfflineActionRecord, "ownerUserId" | "createdAt" | "retryCount">,
) {
  const ownerUserId = currentOfflineAccountId();
  if (!ownerUserId) {
    throw new Error("Sign in again before storing an offline action.");
  }

  const db = await openOfflineDb();
  await purgeExpiredOfflineActionsFromDb(db);
  const retentionDays = record.kind === "import-csv" ? offlineImportRetentionDays() : 0;
  if (record.kind === "import-csv" && retentionDays === 0) {
    throw new Error("Offline import storage is disabled on this device.");
  }
  const createdAt = new Date();
  const value: OfflineActionRecord = {
    ...record,
    ownerUserId,
    createdAt: createdAt.toISOString(),
    retryCount: 0,
    schemaVersion: OFFLINE_QUEUE_SCHEMA_VERSION,
    status: "pending",
    expiresAt:
      record.kind === "import-csv"
        ? new Date(createdAt.getTime() + retentionDays * 24 * 60 * 60 * 1000).toISOString()
        : null,
    lastAttemptAt: null,
    nextRetryAt: null,
    lastErrorCode: null,
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

export async function purgeOfflineActionsForOtherAccounts(ownerUserId: string) {
  const db = await openOfflineDb();
  const records = await allOfflineActions(db);
  const ids = records
    .filter((record) => !record.ownerUserId || record.ownerUserId !== ownerUserId)
    .map((record) => record.id);
  await deleteOfflineActions(db, ids);
  if (ids.length > 0) notifyOfflineQueueChanged();
  return ids.length;
}

export function offlineActionsForAccount(records: OfflineActionRecord[], ownerUserId: string) {
  return records.filter((record) => record.ownerUserId === ownerUserId);
}

export function currentOfflineAccountId() {
  if (typeof document === "undefined") return null;
  return document.documentElement.dataset.offlineAccountId?.trim() || null;
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

export async function retryDeadLetterOfflineAction(record: OfflineActionRecord) {
  if (record.status !== "dead_letter") return record;

  const db = await openOfflineDb();
  const value: OfflineActionRecord = {
    ...record,
    retryCount: 0,
    status: "pending",
    lastAttemptAt: null,
    nextRetryAt: null,
  };

  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(value);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  notifyOfflineQueueChanged();
  return value;
}

export async function incrementOfflineActionRetry(record: OfflineActionRecord) {
  return recordOfflineActionFailure(record);
}

export async function recordOfflineActionFailure(
  record: OfflineActionRecord,
  failure: { permanent?: boolean; errorCode?: string | null } = {},
) {
  const db = await openOfflineDb();
  const retryCount = record.retryCount + 1;
  const deadLetter = Boolean(failure.permanent) || retryCount >= MAX_OFFLINE_RETRY_COUNT;
  const now = new Date();
  const value: OfflineActionRecord = {
    ...record,
    retryCount,
    schemaVersion: OFFLINE_QUEUE_SCHEMA_VERSION,
    status: deadLetter ? "dead_letter" : "pending",
    lastAttemptAt: now.toISOString(),
    nextRetryAt: deadLetter
      ? null
      : new Date(now.getTime() + retryDelayMs(retryCount)).toISOString(),
    lastErrorCode: failure.errorCode ?? null,
  };

  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(value);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  notifyOfflineQueueChanged();
  return value;
}

export function isOfflineActionReadyForRetry(record: OfflineActionRecord, now = Date.now()) {
  if (record.status === "dead_letter") return false;
  const nextRetryAt = record.nextRetryAt ? Date.parse(record.nextRetryAt) : 0;
  return !Number.isFinite(nextRetryAt) || nextRetryAt <= now;
}

function notifyOfflineQueueChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("fkh-offline-queue-changed"));
  }
}

async function purgeExpiredOfflineActionsFromDb(db: IDBDatabase) {
  const records = await allOfflineActions(db);
  const expiredIds = records
    .filter((record) => record.kind === "import-csv" && isExpired(record))
    .map((record) => record.id);

  if (expiredIds.length === 0) {
    return 0;
  }

  await deleteOfflineActions(db, expiredIds);

  return expiredIds.length;
}

function allOfflineActions(db: IDBDatabase) {
  return new Promise<OfflineActionRecord[]>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as OfflineActionRecord[]);
    request.onerror = () => reject(request.error);
  });
}

function deleteOfflineActions(db: IDBDatabase, ids: string[]) {
  if (ids.length === 0) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    ids.forEach((id) => store.delete(id));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function isExpired(record: OfflineActionRecord) {
  const expiresAt = record.expiresAt ? Date.parse(record.expiresAt) : Number.NaN;
  if (Number.isFinite(expiresAt)) {
    return Date.now() >= expiresAt;
  }

  const createdAt = Date.parse(record.createdAt);
  return Number.isFinite(createdAt) && Date.now() - createdAt > OFFLINE_IMPORT_TTL_MS;
}

function retryDelayMs(retryCount: number) {
  return Math.min(60_000, 2 ** Math.max(0, retryCount - 1) * 2_000);
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
