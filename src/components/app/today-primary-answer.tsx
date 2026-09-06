"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import Link from "next/link";
import { ArrowRight, RefreshCw, Target, ChevronRight, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import styles from "./mobile-companion.module.css";
import { listOfflineActions, type OfflineActionRecord } from "@/lib/offline-queue";
import { getTodaySyncOverride, type TodayPrimaryState } from "@/lib/today-sync-state";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";

type TodayFact = { label: string; value: string };

export function TodayPrimaryAnswer({
  accountId,
  serverState,
  facts,
  evidenceDate,
  evidenceContent,
  compact = false,
}: {
  accountId: string;
  serverState: TodayPrimaryState;
  facts: TodayFact[];
  evidenceDate?: string;
  evidenceContent: ReactNode;
  compact?: boolean;
}) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
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
  const club = facts.find((fact) => fact.label === "Club")?.value;
  const isReview = serverState.status === "Review ready";
  const isRecommendation = ["Low", "Moderate", "High"].includes(serverState.status);
  const evidenceTitle = isReview ? "Today’s review evidence" : "Why this recommendation?";
  const title =
    serverState.status === "Low"
      ? club && club !== "Baseline"
        ? `${club} baseline`
        : "Build your baseline"
      : serverState.title
          .replace(/^Practise /, "")
          .replace(/^SW\b/, "Sand wedge")
          .replace(/^PW\b/, "Pitching wedge")
          .replace(/^GW\b/, "Gap wedge");
  const reason =
    serverState.status === "Low"
      ? "Establish your carry and usual miss with a measured calibration block."
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
      <section
        className={compact ? styles.reviewBrief : styles.focus}
        data-primary-recommendation
        aria-label={isReview ? "Today’s practice review" : "Today's focus"}
      >
        <div className={styles.focusHeading}>
          <p className={styles.focusEyebrow}>
            {isRecommendation ? "For your next session" : serverState.eyebrow}
          </p>
          <span className={styles.focusIcon}>
            {isReview ? (
              <ClipboardCheck className="size-5" aria-hidden />
            ) : (
              <Target className="size-5" aria-hidden />
            )}
          </span>
        </div>
        <div>
          <h2 className={styles.focusTitle}>
            {compact && reason === "Mixed session" ? "Mixed results today" : title}
          </h2>
          {!compact || reason !== "Mixed session" ? (
            <p className={styles.focusReason}>{reason}</p>
          ) : null}
        </div>
        {!compact ? (
          <Link href={serverState.href} className={styles.focusAction} data-today-primary-action>
            {isRecommendation && duration ? `Build ${duration} practice` : serverState.action}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        ) : null}
        <button
          id="today-evidence"
          className={styles.focusEvidence}
          onClick={() => setEvidenceOpen(true)}
          aria-label={evidenceTitle}
        >
          <span>
            <strong>
              {compact ? "Saved practice · View evidence" : evidence}
              {isRecommendation ? ` · ${serverState.status} confidence` : ""}
            </strong>
            {evidenceDate ? <span>Latest practice · {evidenceDate}</span> : null}
          </span>
          <ChevronRight className="size-5 shrink-0" aria-hidden />
        </button>
      </section>
      <Drawer open={evidenceOpen} onOpenChange={setEvidenceOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{evidenceTitle}</DrawerTitle>
            <DrawerDescription>
              {serverState.status === "Low"
                ? "The current sample is too small to call a reliable weakness. This focus helps build evidence."
                : serverState.reason}
            </DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 overflow-y-auto px-4 pb-4">
            {evidenceOpen ? evidenceContent : null}
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline" className="min-h-11">
                Done
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
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
