"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, FolderClock, MoreHorizontal, RefreshCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { listOfflineActions, type OfflineActionRecord } from "@/lib/offline-queue";
import { getTodaySyncOverride, type TodayPrimaryState } from "@/lib/today-sync-state";
import { cn } from "@/lib/utils";

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
  const state = syncState ?? serverState;
  const displayedFacts = syncState
    ? syncFacts(actions, isOnline, syncState.status === "Needs attention")
    : facts;
  const glanceFacts = displayedFacts.slice(0, 3);

  function retrySync() {
    window.dispatchEvent(new Event("fkh-offline-retry-requested"));
    window.setTimeout(refresh, 500);
  }

  return (
    <Card
      size="sm"
      className="relative isolate gap-2 overflow-hidden border-0 bg-[#052f22] py-3 text-white shadow-lg ring-0"
      data-primary-recommendation
    >
      <div
        className="pointer-events-none absolute inset-0 -z-20 bg-[url('/assets/generated/lmwt-range-hero.png')] bg-cover bg-[72%_center] opacity-55"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(3,35,25,0.99)_0%,rgba(3,35,25,0.94)_66%,rgba(3,35,25,0.64)_100%)]"
        aria-hidden
      />
      <CardHeader className="gap-2 pr-3 has-data-[slot=card-action]:grid-cols-1">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a6f04a]">
            {state.eyebrow}
          </p>
          <CardTitle className="mt-1 text-2xl font-semibold leading-7 tracking-[-0.025em] text-white">
            {state.title}
          </CardTitle>
        </div>
        <CardAction className="col-start-1 row-span-1 row-start-2 justify-self-start">
          <div className="flex flex-wrap justify-start gap-1.5">
            <Badge className="border-[#a6f04a] bg-[#a6f04a] !text-[#052f22] hover:bg-[#a6f04a]">
              {recommendationStatusLabel(state)}
            </Badge>
            {trainingLoadLabel && !syncState ? (
              <Badge
                variant="outline"
                className="hidden border-white/45 bg-black/45 !text-white min-[360px]:inline-flex"
              >
                Training load: {trainingLoadLabel}
              </Badge>
            ) : null}
          </div>
        </CardAction>
      </CardHeader>

      <CardContent className="grid gap-2">
        <p className="max-w-[94%] text-sm leading-5 text-white/74">{state.reason}</p>

        <div className="grid grid-cols-3 gap-3 border-y border-white/14 py-2">
          {glanceFacts.map((fact) => (
            <div key={fact.label}>
              <p className="text-[11px] text-white/55">{fact.label}</p>
              <p className="mt-0.5 break-words text-sm font-semibold leading-5 text-white">
                {fact.value}
              </p>
            </div>
          ))}
        </div>

        {syncState ? (
          <Alert
            role={syncState.status === "Needs attention" ? "alert" : "status"}
            aria-live={syncState.status === "Needs attention" ? "assertive" : "polite"}
            className={cn(
              "gap-y-1 py-2.5",
              syncState.status === "Needs attention"
                ? "border-[var(--status-error-border)] bg-[var(--status-error-surface)] text-[var(--status-error-foreground)] [&_[data-slot=alert-description]]:text-[var(--status-error-foreground)]"
                : "border-white/18 bg-black/20 text-white [&_[data-slot=alert-description]]:text-white/75",
            )}
            data-today-sync-state
          >
            <AlertTitle className="text-sm">{syncState.status}</AlertTitle>
            <AlertDescription className="grid gap-2 text-xs">
              <span>{syncState.reason}</span>
              {syncState.status !== "Needs attention" ? (
                <Progress
                  value={syncProgress(syncState.status)}
                  aria-label={`${syncState.status}: ${syncProgress(syncState.status)}%`}
                  className="h-1.5"
                />
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-fit"
                disabled={!isOnline}
                onClick={retrySync}
                aria-label={
                  isOnline ? "Retry session upload sync" : "Retry session upload when online"
                }
              >
                <RefreshCw className="size-3.5" aria-hidden />
                {isOnline ? "Retry sync" : "Retry when online"}
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>

      <CardFooter className="border-white/14 bg-black/15 px-3 py-3">
        <div
          className="grid w-full grid-cols-[minmax(0,1fr)_3rem_3rem] gap-1.5 min-[375px]:gap-2"
          aria-label="Today actions"
        >
          <Button
            asChild
            data-today-primary-action
            className="min-h-12 min-w-0 rounded-[var(--mobile-radius-md)] bg-white px-2 text-sm text-[#073527] hover:bg-white/90 min-[375px]:px-3 min-[375px]:text-base"
          >
            <Link href={state.href}>
              <span className="truncate">{state.action}</span>
              <ArrowRight className="ml-1 size-4 shrink-0" aria-hidden />
            </Link>
          </Button>
          <Button
            asChild
            data-today-secondary-action
            variant="outline"
            size="icon"
            className="min-h-12 min-w-12 rounded-[var(--mobile-radius-md)] border-white bg-white/92 !text-[#073527] hover:bg-white hover:!text-[#073527]"
          >
            <Link href="/sessions" aria-label="Open session history">
              <FolderClock className="size-4" aria-hidden />
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="min-h-12 min-w-12 rounded-[var(--mobile-radius-md)] border-white/55 bg-[#0b4334] !text-white hover:bg-[#125440] hover:!text-white"
                aria-label="More Today actions"
              >
                <MoreHorizontal className="size-5" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href="/import">Import a session</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/quick-bag">Open Quick Bag</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/play">Prepare to play</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardFooter>
    </Card>
  );
}

function recommendationStatusLabel(state: TodayPrimaryState) {
  return /^(low|moderate|high)$/i.test(state.status)
    ? `Confidence: ${state.status}`
    : `Status: ${state.status}`;
}

function syncProgress(status: string) {
  if (status === "Syncing") return 70;
  return 20;
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
