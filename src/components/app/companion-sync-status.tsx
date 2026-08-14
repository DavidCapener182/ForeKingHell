"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { CloudUpload, RefreshCw, TriangleAlert, WifiOff } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { countOfflineActions, listOfflineActions } from "@/lib/offline-queue";

export function CompanionSyncStatus({ accountId }: { accountId: string }) {
  const isOnline = useSyncExternalStore(subscribeOnline, onlineSnapshot, serverOnlineSnapshot);
  const [state, setState] = useState<{ count: number; needsAttention: number }>({
    count: 0,
    needsAttention: 0,
  });

  const refresh = useCallback(() => {
    Promise.all([countOfflineActions(accountId), listOfflineActions(accountId)])
      .then(([count, actions]) =>
        setState({
          count,
          needsAttention: actions.filter((action) => action.status === "dead_letter").length,
        }),
      )
      .catch(() => setState({ count: 0, needsAttention: 0 }));
  }, [accountId]);

  useEffect(() => {
    const timer = window.setTimeout(refresh, 0);
    window.addEventListener("fkh-offline-queue-changed", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("fkh-offline-queue-changed", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
    };
  }, [refresh]);

  if (state.count === 0 && isOnline) return null;

  const presentation = state.needsAttention
    ? {
        icon: TriangleAlert,
        title: "Upload needs attention",
        detail: `${state.needsAttention} queued upload${state.needsAttention === 1 ? "" : "s"} need review in Settings.`,
        status: "Needs attention",
        tone: "attention" as const,
      }
    : isOnline
      ? {
          icon: RefreshCw,
          title: "Syncing queued upload",
          detail: `${state.count} upload${state.count === 1 ? "" : "s"} saved on this phone ${state.count === 1 ? "is" : "are"} waiting for a safe retry.`,
          status: "Syncing",
          tone: "info" as const,
        }
      : state.count > 0
        ? {
            icon: CloudUpload,
            title: "Upload queued on this phone",
            detail: "Waiting for connection. Analysis will appear after the upload syncs.",
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
    <Alert role="status" aria-live="polite" data-companion-sync-status>
      <Icon className="size-4" aria-hidden />
      <AlertTitle className="flex flex-wrap items-start justify-between gap-2">
        {presentation.title}
        <Badge variant={state.needsAttention ? "destructive" : "secondary"}>
          {presentation.status}
        </Badge>
      </AlertTitle>
      <AlertDescription className="grid gap-2">
        <span>{presentation.detail}</span>
        <Progress
          value={state.needsAttention ? 100 : isOnline ? 65 : 15}
          aria-label={`${presentation.status} upload progress`}
          className="h-1.5"
        />
        {state.count > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-fit"
            disabled={!isOnline}
            onClick={retrySync}
          >
            <RefreshCw className="size-3.5" aria-hidden />
            {isOnline ? "Retry sync" : "Retry when online"}
          </Button>
        ) : null}
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
