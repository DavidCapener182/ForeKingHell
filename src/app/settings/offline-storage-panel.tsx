"use client";

import Link from "next/link";

import { ConfirmSubmitButton } from "@/components/app/confirm-submit-button";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ShieldCheck, Trash2, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  clearOfflineActions,
  currentOfflineAccountId,
  listOfflineActions,
  purgeExpiredOfflineActions,
  removeOfflineAction,
  retryDeadLetterOfflineAction,
  type OfflineActionRecord,
} from "@/lib/offline-queue";
import {
  getOfflineLastSyncAt,
  isOfflineImportStorageEnabled,
  offlineImportRetentionDays,
  offlineImportRetentionOptions,
  setOfflineImportRetentionDays,
  subscribeOfflineImportStoragePreference,
  type OfflineImportRetentionDays,
} from "@/lib/offline-storage-preferences";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function OfflineStoragePanel() {
  const [enabled, setEnabled] = useState(false);
  const [retentionDays, setRetentionDays] = useState<OfflineImportRetentionDays>(0);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [actions, setActions] = useState<OfflineActionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setLoadError(undefined);
    setEnabled(isOfflineImportStorageEnabled());
    setRetentionDays(offlineImportRetentionDays());
    setLastSyncAt(getOfflineLastSyncAt());
    const ownerUserId = currentOfflineAccountId();
    if (!ownerUserId) {
      setActions([]);
      setLoading(false);
      setLoadError("The current offline account is not ready. Refresh after signing in.");
      return;
    }
    purgeExpiredOfflineActions()
      .then(() => listOfflineActions(ownerUserId))
      .then(setActions)
      .catch(() =>
        setLoadError("Saved data could not be read. Previously loaded rows may be out of date."),
      )
      .finally(() => setLoading(false));
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
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold">
              <WifiOff className="size-4 text-primary" />
              Offline storage
            </p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              CSV imports can be temporarily stored in this browser for retry. Leave this off on
              shared devices.
            </p>
          </div>
          <div className="grid gap-1 rounded-lg border bg-muted/40 px-3 py-2 text-sm font-medium">
            <Label htmlFor="offline-retention">Import retention on this device</Label>
            <Select
              value={String(retentionDays)}
              onValueChange={(value) => {
                const next = Number(value) as OfflineImportRetentionDays;
                if (!offlineImportRetentionOptions.includes(next)) return;
                setOfflineImportRetentionDays(next);
                setMessage(
                  next === 0
                    ? "Offline import storage is off for this device."
                    : `Queued CSV imports will expire after ${next} day${next === 1 ? "" : "s"}.`,
                );
              }}
            >
              <SelectTrigger id="offline-retention" className="min-h-11 w-full bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Never store imports offline</SelectItem>
                <SelectItem value="1">24 hours</SelectItem>
                <SelectItem value="3">72 hours</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <OfflineStorageMetric
            label="Queued actions"
            value={loading ? "Checking…" : loadError ? "Unavailable" : actions.length}
          />
          <OfflineStorageMetric
            label="Queued import files"
            value={loading ? "Checking…" : loadError ? "Unavailable" : fileCount}
          />
          <OfflineStorageMetric
            label="Import expiry"
            value={enabled ? `${retentionDays} day${retentionDays === 1 ? "" : "s"}` : "Off"}
          />
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Last successful sync: {formatTimestamp(lastSyncAt)}
        </p>

        {loadError ? (
          <p role="alert" className="mt-3 rounded-lg border p-3 text-sm">
            {loadError}
          </p>
        ) : null}
        {loading ? (
          <p role="status" className="mt-3 text-sm">
            Reading saved actions…
          </p>
        ) : null}
        {message ? (
          <Alert className="mt-3">
            <ShieldCheck className="size-4" />
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={loading} onClick={refresh}>
            Refresh saved data
          </Button>
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
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="rounded-lg"
                disabled={actions.length === 0}
              >
                <Trash2 className="size-4" />
                Clear offline queue
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear this device&apos;s offline queue?</AlertDialogTitle>
                <AlertDialogDescription>
                  Pending imports and edits stored in this browser will be removed and cannot be
                  retried after this action.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep queued actions</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => {
                    clearOfflineActions()
                      .then(() => {
                        setActions([]);
                        setMessage("Offline queue cleared on this device.");
                      })
                      .catch(() => setMessage("The offline queue could not be cleared."));
                  }}
                >
                  Clear offline queue
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="mt-4 grid gap-2">
          {actions.length > 0 ? (
            actions.map((action) => (
              <div
                key={action.id}
                className="grid gap-1 rounded-lg border bg-muted/40 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="min-w-0">
                  <p className="break-words font-medium">
                    {action.kind === "import-csv" ? "CSV import retry" : "Round edit retry"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {offlineFileCount(action)} file{offlineFileCount(action) === 1 ? "" : "s"} ·{" "}
                    {action.status === "dead_letter"
                      ? `Needs review${action.lastErrorCode ? ` · ${action.lastErrorCode}` : ""}`
                      : `${action.retryCount} retries · ${formatRetry(action.nextRetryAt)}`}{" "}
                    · expires {formatExpiry(action)}
                    <span className="block">
                      Queued {formatTimestamp(action.createdAt)} · Payload{" "}
                      {new TextEncoder()
                        .encode(JSON.stringify(action.payload))
                        .length.toLocaleString("en-GB")}{" "}
                      bytes
                    </span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-1 justify-self-start sm:justify-self-end">
                  {action.status === "dead_letter" ? (
                    <>
                      <Button asChild variant="outline" size="sm">
                        <Link href={offlineActionReviewHref(action)}>Review failed action</Link>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          retryDeadLetterOfflineAction(action)
                            .then(() => {
                              window.dispatchEvent(new Event("fkh-offline-retry-requested"));
                              setMessage("The reviewed action was returned to the retry queue.");
                            })
                            .catch(() => setMessage("The failed action could not be retried."));
                        }}
                      >
                        Retry action
                      </Button>
                    </>
                  ) : null}
                  <ConfirmSubmitButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    confirmTitle={`Remove ${action.kind === "import-csv" ? "import" : "round edit"} queued ${formatTimestamp(action.createdAt)}?`}
                    confirmMessage="This removes the saved offline action from this device, so it cannot sync or retry later."
                    confirmActionLabel="Remove action"
                    onClick={() => {
                      removeOfflineAction(action.id)
                        .then(refresh)
                        .catch(() =>
                          setMessage(
                            "The saved action could not be removed. Refresh its current state before trying again.",
                          ),
                        );
                    }}
                  >
                    Remove
                  </ConfirmSubmitButton>
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
              {loading
                ? "Checking saved actions…"
                : loadError
                  ? "Saved action count is unavailable."
                  : "No pending offline actions on this device."}
            </p>
          )}
        </div>

        {importCount > 0 ? (
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Queued CSV payloads include the raw import text until they sync, expire, or are cleared.
          </p>
        ) : null}
      </CardContent>
    </Card>
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

function offlineActionReviewHref(action: OfflineActionRecord) {
  if (
    action.kind === "round-edit" &&
    action.payload &&
    typeof action.payload === "object" &&
    "sessionId" in action.payload &&
    typeof action.payload.sessionId === "string"
  ) {
    return `/rounds/${encodeURIComponent(action.payload.sessionId)}?offlineConflict=1`;
  }

  return "/import?source=csv&offlineRetry=1#csv-import";
}

function formatExpiry(action: OfflineActionRecord) {
  if (action.kind !== "import-csv") return "when cleared";
  const timestamp = action.expiresAt
    ? Date.parse(action.expiresAt)
    : Date.parse(action.createdAt) + 7 * 24 * 60 * 60 * 1000;

  if (!Number.isFinite(timestamp)) {
    return "soon";
  }

  return dateFormatter.format(new Date(timestamp));
}

function formatRetry(value: string | null | undefined) {
  if (!value) return "ready to retry";
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > Date.now()
    ? `next retry ${new Date(timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
    : "ready to retry";
}

function formatTimestamp(value: string | null) {
  if (!value) return "No completed sync recorded on this device";
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString("en-GB") : "Unknown";
}
