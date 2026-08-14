"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, FolderClock, MoreHorizontal, RefreshCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
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
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(3,35,25,0.98)_0%,rgba(3,35,25,0.88)_62%,rgba(3,35,25,0.42)_100%)]"
        aria-hidden
      />
      <CardHeader className="gap-1 pr-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a6f04a]">
            {state.eyebrow}
          </p>
          <CardTitle className="mt-1 text-2xl font-semibold leading-7 tracking-[-0.025em] text-white">
            {state.title}
          </CardTitle>
        </div>
        <CardAction>
          <div className="flex flex-wrap justify-end gap-1.5">
            <Badge className="border-[#a6f04a] bg-[#a6f04a] !text-[#052f22] hover:bg-[#a6f04a]">
              {state.status}
            </Badge>
            {trainingLoadLabel && !syncState ? (
              <Badge variant="outline" className="border-white/25 bg-black/20 text-white">
                {trainingLoadLabel}
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
              <p className="mt-0.5 truncate text-sm font-semibold text-white">{fact.value}</p>
            </div>
          ))}
        </div>

        {syncState ? (
          <Alert
            className="gap-y-1 border-white/18 bg-black/20 py-2.5 text-white [&_[data-slot=alert-description]]:text-white/75"
            data-today-sync-state
          >
            <AlertTitle className="text-sm">{syncState.status}</AlertTitle>
            <AlertDescription className="grid gap-2 text-xs">
              <span>{syncState.reason}</span>
              <Progress
                value={syncProgress(syncState.status)}
                aria-label={`${syncState.status}: ${syncProgress(syncState.status)}%`}
                className="h-1.5"
              />
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
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>

      <CardFooter className="border-white/14 bg-black/15 px-3 py-3">
        <ButtonGroup className="w-full" aria-label="Today actions">
          <Button
            asChild
            className="min-h-12 flex-1 rounded-l-xl bg-white text-base text-[#073527] hover:bg-white/90"
          >
            <Link href={state.href}>
              {state.action}
              <ArrowRight className="ml-2 size-4" aria-hidden />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="icon"
            className="min-h-12 min-w-12 border-white bg-white !text-[#073527] hover:bg-white/90 hover:!text-[#073527]"
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
                className="min-h-12 min-w-12 rounded-r-xl border-white bg-white !text-[#073527] hover:bg-white/90 hover:!text-[#073527]"
                aria-label="More Today actions"
              >
                <MoreHorizontal className="size-4" aria-hidden />
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
        </ButtonGroup>
      </CardFooter>
    </Card>
  );
}

function syncProgress(status: string) {
  if (status === "Syncing") return 70;
  if (status === "Needs attention") return 100;
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
