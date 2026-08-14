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

  function retrySync() {
    window.dispatchEvent(new Event("fkh-offline-retry-requested"));
    window.setTimeout(refresh, 500);
  }

  return (
    <Card
      size="sm"
      className="relative isolate gap-2 overflow-hidden py-3"
      data-primary-recommendation
    >
      <div
        className="pointer-events-none absolute inset-0 -z-20 bg-[url('/assets/generated/lmwt-range-hero.png')] bg-cover bg-[72%_center] opacity-30"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-card via-card/90 to-card/60"
        aria-hidden
      />
      <CardHeader className="gap-1 pr-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            {state.eyebrow}
          </p>
          <CardTitle className="mt-1 text-xl font-bold leading-6 tracking-tight">
            {state.title}
          </CardTitle>
        </div>
        <CardAction>
          <Badge variant={state.tone === "attention" ? "outline" : "secondary"}>
            {state.status}
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="grid gap-2">
        <p className="max-w-[92%] text-sm leading-5 text-muted-foreground">{state.reason}</p>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-y border-border/70 py-2">
          {displayedFacts.map((fact) => (
            <div key={fact.label}>
              <p className="text-xs text-muted-foreground">{fact.label}</p>
              <p className="mt-0.5 text-sm font-semibold">{fact.value}</p>
            </div>
          ))}
        </div>

        {syncState ? (
          <Alert
            className="gap-y-1 border-primary/20 bg-background/75 py-2.5"
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

      <CardFooter className="bg-background/70 px-3 py-3">
        <ButtonGroup className="w-full" aria-label="Today actions">
          <Button asChild className="min-h-12 flex-1 rounded-l-xl text-base">
            <Link href={state.href}>
              {state.action}
              <ArrowRight className="ml-2 size-4" aria-hidden />
            </Link>
          </Button>
          <Button asChild variant="outline" size="icon" className="min-h-12 min-w-12">
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
                className="min-h-12 min-w-12 rounded-r-xl"
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
