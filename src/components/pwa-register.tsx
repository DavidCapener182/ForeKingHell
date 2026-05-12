"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Download, RefreshCw, WifiOff, X } from "lucide-react";

import { trackPlausibleEvent } from "@/lib/analytics";
import {
  countOfflineActions,
  incrementOfflineActionRetry,
  listOfflineActions,
  removeOfflineAction,
} from "@/lib/offline-queue";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function PwaRegister() {
  const pathname = usePathname();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [updateReady, setUpdateReady] = useState<ServiceWorkerRegistration | null>(null);
  const isOnline = useSyncExternalStore(
    subscribeOnlineStatus,
    getOnlineStatusSnapshot,
    getServerOnlineStatusSnapshot,
  );
  const [pendingOfflineActions, setPendingOfflineActions] = useState(0);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const refreshOfflineCount = useCallback(() => {
    if (!("indexedDB" in window)) {
      setPendingOfflineActions(0);
      return;
    }

    countOfflineActions()
      .then(setPendingOfflineActions)
      .catch(() => setPendingOfflineActions(0));
  }, []);

  const replayOfflineActions = useCallback(async () => {
    if (!navigator.onLine || !("indexedDB" in window)) {
      return;
    }

    const actions = await listOfflineActions().catch(() => []);
    const syncableActions = actions.filter((action) => action.kind === "import-csv" || action.kind === "round-edit");

    if (syncableActions.length === 0) {
      refreshOfflineCount();
      setSyncMessage(null);
      return;
    }

    setSyncMessage(`Syncing ${syncableActions.length} queued action${syncableActions.length === 1 ? "" : "s"}...`);

    for (const action of syncableActions) {
      try {
        const response = await fetch(action.kind === "import-csv" ? "/api/offline/imports" : "/api/offline/round-edits", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(action.payload),
        });

        if (response.ok) {
          await removeOfflineAction(action.id);
        } else {
          await incrementOfflineActionRetry(action);
        }
      } catch {
        await incrementOfflineActionRetry(action);
      }
    }

    refreshOfflineCount();
    setSyncMessage("Offline import sync finished.");
    window.setTimeout(() => setSyncMessage(null), 5000);
  }, [refreshOfflineCount]);

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
    return () => window.removeEventListener("fkh-offline-queue-changed", refreshOfflineCount);
  }, [refreshOfflineCount]);

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
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((registration) => {
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
      }).catch(() => {
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
    dismissed ||
    (!installPrompt && !updateReady && isOnline && pendingOfflineActions === 0 && !syncMessage)
  ) {
    return null;
  }

  const canInstall = isOnline && pendingOfflineActions === 0 && !updateReady && installPrompt;
  const message = syncMessage
    ? syncMessage
    : pendingOfflineActions > 0
      ? `${pendingOfflineActions} pending offline action${pendingOfflineActions === 1 ? "" : "s"} will sync when available.`
      : !isOnline
        ? "Offline mode is active. Previously loaded screens remain available."
      : updateReady
        ? "A ForeKingHell update is ready."
        : "Install ForeKingHell for faster access on this device.";

  return (
    <div className="fixed inset-x-3 bottom-20 z-50 sm:bottom-4 sm:left-auto sm:right-4 sm:w-[360px]">
      <div className="glass-toolbar rounded-2xl p-3">
        <div className="flex items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[#111827] text-white">
            {!isOnline ? <WifiOff className="size-4" /> : updateReady ? <RefreshCw className="size-4" /> : <Download className="size-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{message}</p>
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
              {updateReady ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    updateReady.waiting?.postMessage({ type: "SKIP_WAITING" });
                    window.location.reload();
                  }}
                >
                  Reload
                </Button>
              ) : null}
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => setDismissed(true)}>
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
