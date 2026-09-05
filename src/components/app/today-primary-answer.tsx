"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, RefreshCw, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import styles from "./mobile-companion.module.css";
import { listOfflineActions, type OfflineActionRecord } from "@/lib/offline-queue";
import { getTodaySyncOverride, type TodayPrimaryState } from "@/lib/today-sync-state";

type TodayFact = { label: string; value: string };

export function TodayPrimaryAnswer({
  accountId,
  serverState,
  facts,
  trainingLoadLabel,
}: {
  accountId: string;
  serverState: TodayPrimaryState;
  facts: TodayFact[];
  trainingLoadLabel?: string;
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

  function retrySync() {
    window.dispatchEvent(new Event("fkh-offline-retry-requested"));
    window.setTimeout(refresh, 500);
  }

  const duration = facts.find((fact) => fact.label === "Session")?.value;
  const evidence = facts.find((fact) => fact.label === "Evidence")?.value;
  const title = serverState.title
    .replace(/^Practise /, "")
    .replace(/^SW\b/, "Sand wedge")
    .replace(/^PW\b/, "Pitching wedge")
    .replace(/^GW\b/, "Gap wedge");
  const reason =
    serverState.status === "Low"
      ? `${evidence} support this focus. Start with calibration and build a repeatable sample before judging a change.`
      : serverState.reason;
  return (
    <div className="grid gap-3">
      {syncState ? (
        <div
          className={styles.sync}
          role={syncState.status === "Needs attention" ? "alert" : "status"}
          data-today-sync-state
        >
          <p className="font-semibold">{syncState.title}</p>
          <p className="text-sm text-muted-foreground">{syncState.reason}</p>
          <Button variant="outline" className="min-h-11" onClick={retrySync}>
            <RefreshCw className="size-4" />
            Retry sync
          </Button>
          <Link
            href={syncState.href}
            className="flex min-h-11 items-center font-semibold text-primary"
          >
            {syncState.action}
          </Link>
        </div>
      ) : null}
      <section className={styles.focus} data-primary-recommendation aria-label="Today's focus">
        <div className={styles.focusHeading}>
          <p className={styles.focusEyebrow}>For your next session</p>
          <span className={styles.focusIcon}>
            <Target className="size-5" aria-hidden />
          </span>
        </div>
        <div>
          <h2 className={styles.focusTitle}>{title}</h2>
          <p className={styles.focusReason}>{reason}</p>
        </div>
        <div className={styles.focusFacts}>
          <span>{duration}</span>
          <span>{facts.find((fact) => fact.label === "Club")?.value}</span>
          {trainingLoadLabel ? <span>{trainingLoadLabel} training load</span> : null}
        </div>
        <Link href={serverState.href} className={styles.focusAction} data-today-primary-action>
          {duration ? `Build ${duration} practice` : serverState.action}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
        <p className={styles.focusEvidence}>
          {evidence} · {serverState.status} confidence · <a href="#today-evidence">View evidence</a>
        </p>
      </section>
    </div>
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
