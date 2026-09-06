"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Download, RefreshCw, WifiOff, X } from "lucide-react";

import { trackPlausibleEvent } from "@/lib/analytics";
import {
  countOfflineActions,
  isOfflineActionReadyForRetry,
  listOfflineActions,
  purgeOfflineActionsForOtherAccounts,
  recordOfflineActionFailure,
  removeOfflineAction,
} from "@/lib/offline-queue";
import { setOfflineLastSyncAt } from "@/lib/offline-storage-preferences";
import { Button } from "@/components/ui/button";
import { BRAND_NAME } from "@/lib/brand";
import { purgeCompanionDataForOtherAccounts } from "@/lib/service-worker-cache";
import { canApplyAppUpdate, dismissInstallNotice, installNoticeDismissed, isActiveEntryRoute } from "@/lib/pwa-notice-policy";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function PwaRegister({ activeUserId }: { activeUserId: string | null }) {
  const pathname = usePathname();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [updateReady, setUpdateReady] = useState<ServiceWorkerRegistration | null>(null);
  const isOnline = useSyncExternalStore(
    subscribeOnlineStatus,
    getOnlineStatusSnapshot,
    getServerOnlineStatusSnapshot,
  );
  const [queueChecked, setQueueChecked] = useState(false);
  const [pendingOfflineActions, setPendingOfflineActions] = useState<number | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [dismissedMessage, setDismissedMessage] = useState<string | null>(null);
  const editedForms = useRef(new Set<HTMLFormElement>());

  useEffect(() => {
    const rememberEdit = (event: Event) => {
      const target = event.target;
      if ((target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) && target.form) editedForms.current.add(target.form);
    };
    document.addEventListener("input", rememberEdit, true);
    document.addEventListener("change", rememberEdit, true);
    return () => { document.removeEventListener("input", rememberEdit, true); document.removeEventListener("change", rememberEdit, true); };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDismissed(installNoticeDismissed(window.localStorage)), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const refreshOfflineCount = useCallback(() => {
    if (!("indexedDB" in window)) {
      setPendingOfflineActions(null);
      setQueueChecked(true);
      return;
    }

    if (!activeUserId) {
      setPendingOfflineActions(0);
      setQueueChecked(true);
      return;
    }

    countOfflineActions(activeUserId)
      .then(setPendingOfflineActions)
      .catch(() => setPendingOfflineActions(null))
      .finally(() => setQueueChecked(true));
  }, [activeUserId]);

  const replayOfflineActions = useCallback(async () => {
    if (!activeUserId || !navigator.onLine || !("indexedDB" in window)) {
      return;
    }

    await withOfflineReplayLock(async () => {
      await purgeOfflineActionsForOtherAccounts(activeUserId).catch(() => 0);
      const actions = await listOfflineActions(activeUserId).catch(() => null);
      if (actions === null) {
        setPendingOfflineActions(null);
        setQueueChecked(true);
        setSyncMessage("Saved actions could not be read. Open Settings to review local storage; no queued action was discarded.");
        return;
      }
      const syncableActions = actions.filter(
        (action) =>
          (action.kind === "import-csv" || action.kind === "round-edit") &&
          isOfflineActionReadyForRetry(action),
      );

      if (syncableActions.length === 0) {
        refreshOfflineCount();
        setSyncMessage(null);
        return;
      }

      setSyncMessage(
        `Syncing ${syncableActions.length} queued action${syncableActions.length === 1 ? "" : "s"}…`,
      );
      let synced = 0;
      let retained = 0;
      let needsReview = 0;

      for (const action of syncableActions) {
        try {
          const response = await fetch(
            action.kind === "import-csv" ? "/api/offline/imports" : "/api/offline/round-edits",
            {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-fkh-offline-owner": action.ownerUserId,
                "x-fkh-offline-operation": action.id,
              },
              body: JSON.stringify(action.payload),
            },
          );

          if (response.ok) {
            await removeOfflineAction(action.id);
            synced += 1;
            continue;
          }

          const errorCode = await offlineResponseErrorCode(response);
          const permanent = isPermanentOfflineFailure(response.status, errorCode);
          const updated = await recordOfflineActionFailure(action, { permanent, errorCode });
          retained += 1;
          if (updated.status === "dead_letter") needsReview += 1;
        } catch {
          const updated = await recordOfflineActionFailure(action, {
            errorCode: "network_error",
          });
          retained += 1;
          if (updated.status === "dead_letter") needsReview += 1;
        }
      }

      if (synced > 0) setOfflineLastSyncAt();
      refreshOfflineCount();
      setSyncMessage(
        needsReview > 0
          ? `${synced} synced; ${needsReview} action${needsReview === 1 ? " needs" : "s need"} review in Settings.`
          : retained > 0
            ? `${synced} synced; ${retained} retained for a safe retry.`
            : `${synced} offline action${synced === 1 ? "" : "s"} synced successfully.`,
      );
      window.setTimeout(() => setSyncMessage(null), 5000);
    });
  }, [activeUserId, refreshOfflineCount]);

  useEffect(() => {
    if (activeUserId) purgeCompanionDataForOtherAccounts(activeUserId);
  }, [activeUserId]);

  useEffect(() => {
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      trackPlausibleEvent("PWA Installed");
      setInstallPrompt(null);
      setDismissed(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      refreshOfflineCount();

      if (isOnline) {
        void replayOfflineActions();
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isOnline, refreshOfflineCount, replayOfflineActions]);

  useEffect(() => {
    window.addEventListener("fkh-offline-queue-changed", refreshOfflineCount);
    window.addEventListener("fkh-offline-retry-requested", replayOfflineActions);
    return () => {
      window.removeEventListener("fkh-offline-queue-changed", refreshOfflineCount);
      window.removeEventListener("fkh-offline-retry-requested", replayOfflineActions);
    };
  }, [refreshOfflineCount, replayOfflineActions]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "FKH_OFFLINE_SYNC_REQUESTED") {
        void replayOfflineActions();
      }
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, [replayOfflineActions]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      let cancelled = false;

      const clearLocalServiceWorker = async () => {
        const registrations = await navigator.serviceWorker.getRegistrations();
        const wasControlled = Boolean(navigator.serviceWorker.controller);
        const unregisterResults = await Promise.all(
          registrations.map((registration) => registration.unregister()),
        );

        if ("caches" in window) {
          const cacheKeys = await caches.keys();
          await Promise.all(
            cacheKeys
              .filter((key) => key.startsWith("forekinghell-pwa"))
              .map((key) => caches.delete(key)),
          );
        }

        if (!cancelled && wasControlled && unregisterResults.some(Boolean)) {
          window.location.reload();
        }
      };

      clearLocalServiceWorker().catch(() => {
        // A failed local cleanup should never block the app UI.
      });

      return () => {
        cancelled = true;
      };
    }

    const registerServiceWorker = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          if (registration.waiting) {
            setUpdateReady(registration);
          }

          registration.addEventListener("updatefound", () => {
            const worker = registration.installing;
            worker?.addEventListener("statechange", () => {
              if (worker.state === "installed" && navigator.serviceWorker.controller) {
                setUpdateReady(registration);
              }
            });
          });
        })
        .catch(() => {
          // A failed service-worker registration should never block the app UI.
        });
    };

    if (document.readyState === "complete") {
      registerServiceWorker();
      return;
    }

    window.addEventListener("load", registerServiceWorker, { once: true });
    return () => window.removeEventListener("load", registerServiceWorker);
  }, []);

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/share/") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/today") ||
    pathname.startsWith("/play/") ||
    isActiveEntryRoute(pathname) ||
    (dismissed && !updateReady && isOnline && pendingOfflineActions === 0 && !syncMessage) ||
    (!installPrompt && !updateReady && isOnline && pendingOfflineActions === 0 && !syncMessage)
  ) {
    return null;
  }

  const canInstall = !dismissed && isOnline && pendingOfflineActions === 0 && !updateReady && installPrompt;
  const message = syncMessage
    ? syncMessage
    : pendingOfflineActions === null
      ? "Saved actions could not yet be checked. Review local storage in Settings before updating."
    : pendingOfflineActions > 0
      ? `${pendingOfflineActions} pending offline action${pendingOfflineActions === 1 ? "" : "s"} will sync when available.`
      : !isOnline
        ? "Private analysis needs a connection. Queued imports and round edits stay on this device until sync succeeds."
        : updateReady
          ? `A ${BRAND_NAME} update is ready.`
          : `Install ${BRAND_NAME} for faster access on this device.`;

  if ((!queueChecked && pendingOfflineActions === null && !syncMessage && !updateReady && isOnline) || dismissedMessage === message) return null;

  return (
    <div className="mx-4 my-3 pb-[env(safe-area-inset-bottom)]" data-pwa-notice>
      <div className="surface-toast rounded-2xl p-3">
        <div className="flex items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[#111827] text-white">
            {!isOnline ? (
              <WifiOff className="size-4" />
            ) : updateReady ? (
              <RefreshCw className="size-4" />
            ) : (
              <Download className="size-4" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium" role="status" aria-live="polite">
              {message}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {canInstall ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={async () => {
                    await installPrompt.prompt();
                    const choice = await installPrompt.userChoice;
                    if (choice.outcome === "accepted") {
                      trackPlausibleEvent("PWA Installed");
                    }
                    setInstallPrompt(null);
                  }}
                >
                  Install
                </Button>
              ) : null}
              {updateReady && pendingOfflineActions === 0 ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    const hasDraft = [...editedForms.current].some((form) => form.isConnected) || Boolean(document.querySelector('[data-dirty-form-bar], form[aria-busy="true"]'));
                    if (!canApplyAppUpdate({pathname, queued: pendingOfflineActions, hasDraft})) {
                      setSyncMessage("Save your changes, leave the form and finish syncing before applying this update.");
                      return;
                    }
                    navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), {once: true});
                    updateReady.waiting?.postMessage({ type: "SKIP_WAITING" });
                  }}
                >
                  Apply update
                </Button>
              ) : null}
              {pendingOfflineActions !== 0 ? <a href="/settings" className="inline-flex min-h-11 items-center text-sm underline">Review saved actions</a> : null}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 shrink-0"
            onClick={() => { dismissInstallNotice(window.localStorage); setDismissed(true); setDismissedMessage(message); setInstallPrompt(null); }}
          >
            <X className="size-4" />
            <span className="sr-only">Dismiss PWA notice</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

function subscribeOnlineStatus(onStoreChange: () => void) {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  window.addEventListener("fkh-offline-queue-changed", onStoreChange);

  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
    window.removeEventListener("fkh-offline-queue-changed", onStoreChange);
  };
}

function getOnlineStatusSnapshot() {
  return navigator.onLine;
}

function getServerOnlineStatusSnapshot() {
  return true;
}

async function withOfflineReplayLock(action: () => Promise<void>) {
  if ("locks" in navigator) {
    await navigator.locks.request(
      "forekinghell-offline-replay",
      { ifAvailable: true },
      async (lock) => {
        if (lock) await action();
      },
    );
    return;
  }

  await action();
}

async function offlineResponseErrorCode(response: Response) {
  const body = (await response
    .clone()
    .json()
    .catch(() => null)) as { code?: unknown } | null;
  return typeof body?.code === "string" ? body.code : `http_${response.status}`;
}

function isPermanentOfflineFailure(status: number, errorCode: string) {
  if (status >= 500 || status === 401 || status === 408 || status === 429) return false;
  if (status === 409 && errorCode === "offline_operation_in_progress") return false;
  return status >= 400;
}
