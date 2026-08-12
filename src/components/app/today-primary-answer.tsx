"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { IOSInlineStatus } from "@/components/app/ios-mobile";
import { Button } from "@/components/ui/button";
import { listOfflineActions, type OfflineActionRecord } from "@/lib/offline-queue";
import { getTodaySyncOverride, type TodayPrimaryState } from "@/lib/today-sync-state";

type TodayFact = { label: string; value: string };

export function TodayPrimaryAnswer({
  accountId,
  serverState,
  facts,
}: {
  accountId: string;
  serverState: TodayPrimaryState;
  facts: TodayFact[];
}) {
  const isOnline = useSyncExternalStore(subscribeOnline, onlineSnapshot, serverOnlineSnapshot);
  const [actions, setActions] = useState<OfflineActionRecord[]>([]);

  const refresh = useCallback(() => {
    listOfflineActions(accountId)
      .then(setActions)
      .catch(() => setActions([]));
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

  const syncState = useMemo(() => getTodaySyncOverride(actions, isOnline), [actions, isOnline]);
  const state = syncState ?? serverState;
  const displayedFacts = syncState
    ? syncFacts(actions, isOnline, syncState.status === "Needs attention")
    : facts;

  return (
    <section className="ios-grouped-list grid gap-2 p-3" data-primary-recommendation>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            {state.eyebrow}
          </p>
          <h1 className="mt-1 text-xl font-bold leading-6 tracking-tight">{state.title}</h1>
        </div>
        <IOSInlineStatus label={state.status} tone={state.tone} />
      </div>

      <p className="text-sm leading-5 text-muted-foreground">{state.reason}</p>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-y border-border/70 py-2">
        {displayedFacts.map((fact) => (
          <div key={fact.label}>
            <p className="text-xs text-muted-foreground">{fact.label}</p>
            <p className="mt-0.5 text-sm font-semibold">{fact.value}</p>
          </div>
        ))}
      </div>

      <Button asChild className="min-h-12 rounded-xl text-base">
        <Link href={state.href}>
          {state.action}
          <ArrowRight className="ml-2 size-4" aria-hidden />
        </Link>
      </Button>
    </section>
  );
}

function syncFacts(
  actions: OfflineActionRecord[],
  isOnline: boolean,
  needsAttention: boolean,
): TodayFact[] {
  const count = actions.filter((action) => action.kind === "import-csv").length;
  return [
    { label: "Queue", value: `${count} session${count === 1 ? "" : "s"}` },
    { label: "Connection", value: isOnline ? "Online" : "Waiting" },
    { label: "Stored", value: "This phone" },
    { label: "Next", value: needsAttention ? "Review needed" : "Build review" },
  ];
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
