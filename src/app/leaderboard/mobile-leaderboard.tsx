"use client";

import Link from "next/link";
import { useState } from "react";

import { MobilePageTabs } from "@/components/app/mobile-controls";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type MobileLeaderboardPlayer = {
  userId: string;
  displayName: string;
  username: string;
  isCurrentUser: boolean;
  rankMovement: number | null;
  monthlyXp: number;
};

export function MobileLeaderboard({
  initialScope,
  monthLabel,
  friends,
  global,
}: {
  initialScope: "friends" | "public";
  monthLabel: string;
  friends: MobileLeaderboardPlayer[];
  global: MobileLeaderboardPlayer[];
}) {
  return (
    <MobilePageTabs
      initialValue={initialScope}
      ariaLabel="Leaderboard audience"
      tabs={[
        {
          value: "friends",
          label: "Friends",
          href: "/leaderboard?tab=friends",
          content: (
            <MobileLeaderboardBoard scope="Friends" monthLabel={monthLabel} players={friends} />
          ),
        },
        {
          value: "public",
          label: "Global",
          href: "/leaderboard?tab=public",
          content: (
            <MobileLeaderboardBoard scope="Global" monthLabel={monthLabel} players={global} />
          ),
        },
      ]}
    />
  );
}

function MobileLeaderboardBoard({
  scope,
  monthLabel,
  players,
}: {
  scope: "Friends" | "Global";
  monthLabel: string;
  players: MobileLeaderboardPlayer[];
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? players : players.slice(0, 5);
  const currentRank = players.findIndex((player) => player.isCurrentUser) + 1;

  return (
    <div className="grid gap-4">
      <section
        className="rounded-[var(--mobile-radius-lg)] bg-card p-4"
        aria-label={`Your ${scope.toLowerCase()} monthly leaderboard rank`}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {scope} · {monthLabel}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {currentRank > 0 ? `You are #${currentRank} this month` : "You are not ranked this month"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {players.length} opted-in golfer{players.length === 1 ? "" : "s"} in this board.
        </p>
      </section>

      <section
        className="overflow-hidden rounded-[var(--mobile-radius-lg)] bg-card"
        aria-label={`${scope} player leaderboard`}
      >
        <div className="grid grid-cols-[2rem_minmax(0,1fr)_auto_2.25rem] gap-2 border-b bg-muted px-3 py-2 text-[11px] font-semibold text-muted-foreground">
          <span>Rank</span>
          <span>Golfer</span>
          <span className="text-right">Score</span>
          <span className="text-right">Move</span>
        </div>
        <div className="divide-y">
          {visible.length > 0 ? (
            visible.map((player, index) => {
              const rank = index + 1;
              return (
                <div
                  key={player.userId}
                  className={cn(
                    "grid min-h-14 grid-cols-[2rem_minmax(0,1fr)_auto_2.25rem] items-center gap-2 px-3 py-3",
                    player.isCurrentUser && "bg-primary/10",
                    !player.isCurrentUser && rank === 1 && "bg-[var(--status-warning-surface)]",
                    !player.isCurrentUser && rank > 1 && rank <= 3 && "bg-muted/55",
                  )}
                >
                  <span
                    className={cn(
                      "tabular-nums",
                      rank <= 3
                        ? "text-lg font-semibold text-foreground"
                        : "text-sm font-medium text-muted-foreground",
                    )}
                  >
                    {rank}
                  </span>
                  <div className="min-w-0">
                    <Link
                      href={player.isCurrentUser ? "/profile" : `/profile/${player.username}`}
                      className="focus-aaa block min-h-11 truncate py-3 text-sm font-semibold outline-none"
                    >
                      {player.displayName}
                    </Link>
                    {player.isCurrentUser ? (
                      <span className="text-[11px] font-medium text-primary">You</span>
                    ) : null}
                  </div>
                  <span className="text-right text-sm font-semibold tabular-nums">
                    {new Intl.NumberFormat("en-GB").format(player.monthlyXp)}
                  </span>
                  <span className="text-right text-xs text-muted-foreground tabular-nums">
                    {rankMovementLabel(player.rankMovement)}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No opted-in golfers are ranked yet.
            </div>
          )}
        </div>
      </section>

      {players.length > 5 ? (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show top 5" : `View all ${players.length} golfers`}
        </Button>
      ) : null}
    </div>
  );
}

function rankMovementLabel(value: number | null) {
  if (value === null || value === 0) return "—";
  return value > 0 ? `↑ ${value}` : `↓ ${Math.abs(value)}`;
}
