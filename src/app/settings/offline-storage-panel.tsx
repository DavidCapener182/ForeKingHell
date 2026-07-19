"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ShieldCheck, Trash2, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  OFFLINE_IMPORT_TTL_MS,
  clearOfflineActions,
  currentOfflineAccountId,
  listOfflineActions,
  purgeExpiredOfflineActions,
  removeOfflineAction,
  type OfflineActionRecord,
} from "@/lib/offline-queue";
import {
  isOfflineImportStorageEnabled,
  setOfflineImportStorageEnabled,
  subscribeOfflineImportStoragePreference,
} from "@/lib/offline-storage-preferences";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function OfflineStoragePanel() {
  const [enabled, setEnabled] = useState(false);
  const [actions, setActions] = useState<OfflineActionRecord[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setEnabled(isOfflineImportStorageEnabled());
    const ownerUserId = currentOfflineAccountId();
    if (!ownerUserId) {
      setActions([]);
      return;
    }
    purgeExpiredOfflineActions()
      .then(() => listOfflineActions(ownerUserId))
      .then(setActions)
      .catch(() => setActions([]));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(refresh, 0);
    window.addEventListener("fkh-offline-queue-changed", refresh);
    const unsubscribePreference = subscribeOfflineImportStoragePreference(refresh);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("fkh-offline-queue-changed", refresh);
      unsubscribePreference();
    };
  }, [refresh]);

  const importCount = actions.filter((action) => action.kind === "import-csv").length;
  const fileCount = actions.reduce((total, action) => total + offlineFileCount(action), 0);

  return (
    <section id="offline-storage" className="scroll-mt-28 rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <WifiOff className="size-4 text-amber-600" />
            Offline storage
          </p>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            CSV imports can be temporarily stored in this browser for retry. Leave this off on
            shared devices.
          </p>
        </div>
        <label className="flex min-h-11 items-center gap-2 rounded-lg border bg-muted/40 px-3 text-sm font-medium">
          <input
            type="checkbox"
            checked={enabled}
            className="size-4 accent-primary"
            onChange={(event) => {
              setOfflineImportStorageEnabled(event.target.checked);
              setMessage(
                event.target.checked
                  ? "Offline import storage is enabled on this device."
                  : "Offline import storage is off for this device.",
              );
            }}
          />
          Store import retries on this device
        </label>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <OfflineStorageMetric label="Queued actions" value={actions.length} />
        <OfflineStorageMetric label="Queued import files" value={fileCount} />
        <OfflineStorageMetric
          label="Import expiry"
          value={`${OFFLINE_IMPORT_TTL_MS / 86400000} days`}
        />
      </div>

      {message ? (
        <p
          className="mt-3 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary"
          data-tone="green"
          data-tone-role="surface"
        >
          <ShieldCheck className="size-4" />
          {message}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="rounded-lg"
          disabled={actions.length === 0}
          onClick={() => {
            window.dispatchEvent(new Event("fkh-offline-retry-requested"));
            setMessage("Retry requested. Keep this browser online while queued imports sync.");
          }}
        >
          <RefreshCw className="size-4" />
          Retry now
        </Button>
        <Button
          type="button"
          variant="outline"
          className="rounded-lg"
          disabled={actions.length === 0}
          onClick={() => {
            clearOfflineActions()
              .then(() => {
                setActions([]);
                setMessage("Offline queue cleared on this device.");
              })
              .catch(() => setMessage("The offline queue could not be cleared."));
          }}
        >
          <Trash2 className="size-4" />
          Clear offline queue
        </Button>
      </div>

      <div className="mt-4 grid gap-2">
        {actions.length > 0 ? (
          actions.map((action) => (
            <div
              key={action.id}
              className="grid gap-1 rounded-lg border bg-muted/40 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto]"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {action.kind === "import-csv" ? "CSV import retry" : "Round edit retry"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {offlineFileCount(action)} file{offlineFileCount(action) === 1 ? "" : "s"} ·{" "}
                  {action.retryCount} retries · expires {formatExpiry(action.createdAt)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="justify-self-start sm:justify-self-end"
                onClick={() => {
                  removeOfflineAction(action.id).then(refresh);
                }}
              >
                Remove
              </Button>
            </div>
          ))
        ) : (
          <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
            No pending offline actions on this device.
          </p>
        )}
      </div>

      {importCount > 0 ? (
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Queued CSV payloads include the raw import text until they sync, expire, or are cleared.
        </p>
      ) : null}
    </section>
  );
}

function OfflineStorageMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-muted/40 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function offlineFileCount(action: OfflineActionRecord) {
  if (
    action.kind === "import-csv" &&
    action.payload &&
    typeof action.payload === "object" &&
    "inputs" in action.payload &&
    Array.isArray(action.payload.inputs)
  ) {
    return action.payload.inputs.length;
  }

  return action.kind === "round-edit" ? 0 : 1;
}

function formatExpiry(createdAt: string) {
  const timestamp = Date.parse(createdAt);

  if (!Number.isFinite(timestamp)) {
    return "soon";
  }

  return dateFormatter.format(new Date(timestamp + OFFLINE_IMPORT_TTL_MS));
}
