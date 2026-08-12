"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { CloudUpload, RefreshCw, TriangleAlert, WifiOff } from "lucide-react";

import { IOSInlineStatus } from "@/components/app/ios-mobile";
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

  return (
    <section
      className="ios-grouped-list flex items-start gap-3 p-4"
      role="status"
      aria-live="polite"
      data-companion-sync-status
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="text-sm font-semibold">{presentation.title}</p>
          <IOSInlineStatus label={presentation.status} tone={presentation.tone} />
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{presentation.detail}</p>
      </div>
    </section>
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
