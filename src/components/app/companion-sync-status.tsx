"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, useRef } from "react";
import { CloudUpload, RefreshCw, TriangleAlert, WifiOff } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listOfflineActions } from "@/lib/offline-queue";

export function CompanionSyncStatus({ accountId }: { accountId: string }) {
  const isOnline = useSyncExternalStore(subscribeOnline, onlineSnapshot, serverOnlineSnapshot);
  const [snapshot, setSnapshot] = useState<{accountId: string; count: number; needsAttention: number; error: boolean} | null>(null);
  const request = useRef(0);
  const state = snapshot?.accountId === accountId ? snapshot : null;
  const refresh = useCallback(() => {
    const current = ++request.current;
    listOfflineActions(accountId)
      .then((actions) => {
        if (request.current === current) setSnapshot({accountId, count: actions.length, needsAttention: actions.filter((action) => action.status === "dead_letter").length, error: false});
      })
      .catch(() => {
        if (request.current === current) setSnapshot({accountId, count: 0, needsAttention: 0, error: true});
      });
  }, [accountId]);

  useEffect(() => {
    const timer = window.setTimeout(refresh, 0);
    window.addEventListener("fkh-offline-queue-changed", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    return () => {
      request.current += 1;
      window.clearTimeout(timer);
      window.removeEventListener("fkh-offline-queue-changed", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
    };
  }, [refresh]);

  if (!state) return <p role="status" className="text-sm text-muted-foreground">Checking saved actions…</p>;
  if (state.error) return <Alert variant="destructive"><TriangleAlert aria-hidden /><AlertTitle>Saved actions could not be checked</AlertTitle><AlertDescription>Your sync status is unknown. <Button type="button" variant="outline" onClick={refresh}>Check again</Button><a href="/settings">Review local storage in Settings</a></AlertDescription></Alert>;
  if (state.count === 0 && isOnline) return null;

  const presentation = state.needsAttention
    ? {
        icon: TriangleAlert,
        title: "Saved actions need attention",
        detail: `${state.needsAttention} queued action${state.needsAttention === 1 ? " needs" : "s need"} review in Settings.`,
        status: "Needs attention",
        tone: "attention" as const,
      }
    : isOnline
      ? {
          icon: RefreshCw,
          title: "Actions queued for sync",
          detail: `${state.count} action${state.count === 1 ? "" : "s"} saved on this device ${state.count === 1 ? "is" : "are"} waiting for a safe retry.`,
          status: "Queued",
          tone: "info" as const,
        }
      : state.count > 0
        ? {
            icon: CloudUpload,
            title: "Actions queued on this device",
            detail: "Waiting for connection. Saved actions remain on this device until sync succeeds.",
            status: "Waiting for connection",
            tone: "attention" as const,
          }
        : {
            icon: WifiOff,
            title: "Private analysis needs a connection",
            detail:
              "You can queue a CSV only when local import storage is enabled for this device.",
            status: "Offline",
            tone: "neutral" as const,
          };
  const Icon = presentation.icon;

  function retrySync() {
    window.dispatchEvent(new Event("fkh-offline-retry-requested"));
    window.setTimeout(refresh, 500);
  }

  return (
    <Alert
      role={state.needsAttention ? "alert" : "status"}
      aria-live={state.needsAttention ? "assertive" : "polite"}
      className={
        state.needsAttention
          ? "border-[var(--status-error-border)] bg-[var(--status-error-surface)] text-[var(--status-error-foreground)] [&_[data-slot=alert-description]]:text-[var(--status-error-foreground)]"
          : undefined
      }
      data-companion-sync-status
    >
      <Icon className="size-4" aria-hidden />
      <AlertTitle className="flex flex-wrap items-start justify-between gap-2">
        {presentation.title}
        <Badge variant={state.needsAttention ? "destructive" : "secondary"}>
          {presentation.status}
        </Badge>
      </AlertTitle>
      <AlertDescription className="grid gap-2">
        <span>{presentation.detail}</span>
        {state.count > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-fit"
            disabled={!isOnline}
            onClick={retrySync}
            aria-label={isOnline ? "Retry queued upload sync" : "Retry queued upload when online"}
          >
            <RefreshCw className="size-3.5" aria-hidden />
            {isOnline ? "Retry sync" : "Retry when online"}
          </Button>
        ) : null}
        <a href="/settings" className="min-h-11 content-center underline">Review saved actions in Settings</a>
      </AlertDescription>
    </Alert>
  );
}

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function onlineSnapshot() {
  return navigator.onLine;
}

function serverOnlineSnapshot() {
  return true;
}
