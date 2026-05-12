import Link from "next/link";
import { ArrowLeft, Medal, Target, Trophy, Users } from "lucide-react";
import { and, desc, eq, gte, inArray, or } from "drizzle-orm";

import {
  DataPanel,
  DataTableFrame,
  MetricCard,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { accountMemberships, sessions, shots, users, xpLedger } from "@/db/schema";
import { getDb } from "@/db/client";
import { requireCurrentUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";

const integerFormatter = new Intl.NumberFormat("en-GB");
const numberFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

export default async function LeaderboardPage() {
  const data = await getLeaderboardData();

  return (
    <PageShell>
      <div className="flex items-center justify-between gap-4">
        <Button asChild variant="ghost" className="px-0">
          <Link href="/dashboard" prefetch={false}>
            <ArrowLeft className="size-4" />
            Dashboard
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/settings" prefetch={false}>
            <Users className="size-4" />
            Sharing settings
          </Link>
        </Button>
      </div>

      <PageHeader
        eyebrow={<StatusPill tone="green">Private community</StatusPill>}
        title="Leaderboards"
        description="Friend rankings and monthly challenges stay scoped to accounts connected through sharing and only include players who opted into leaderboard visibility."
        metrics={[
          { label: "Visible players", value: integerFormatter.format(data.players.length), detail: "You plus opted-in shared accounts." },
          { label: "Connected accounts", value: integerFormatter.format(data.connectedAccountCount), detail: "Owner, coach, viewer, or editor memberships." },
          { label: "Monthly shots", value: integerFormatter.format(data.monthlyShotTotal), detail: formatMonth(data.monthStart) },
          { label: "Rounds this month", value: integerFormatter.format(data.monthlyRoundTotal), detail: "Real and simulator scorecards." },
        ]}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Practice challenge"
          value={data.challengeWinners.practice?.displayName ?? "--"}
          detail={data.challengeWinners.practice ? `${integerFormatter.format(data.challengeWinners.practice.monthlyShots)} shots this month.` : "No monthly shots yet."}
          icon={Target}
          tone="green"
        />
        <MetricCard
          label="Low score"
          value={data.challengeWinners.lowRound?.displayName ?? "--"}
          detail={data.challengeWinners.lowRound?.bestRoundScore ? `${data.challengeWinners.lowRound.bestRoundScore} gross.` : "No completed scorecards yet."}
          icon={Trophy}
          tone="amber"
        />
        <MetricCard
          label="Longest drive"
          value={data.challengeWinners.longDrive?.displayName ?? "--"}
          detail={data.challengeWinners.longDrive?.longestDriveYd ? `${numberFormatter.format(data.challengeWinners.longDrive.longestDriveYd)} yd total.` : "No driver shots this month."}
          icon={Medal}
          tone="sky"
        />
      </section>

      <DataPanel>
        <SectionHeader
          title="Friend leaderboard"
          description="Ranks use all-time XP first, then monthly XP as the tiebreaker."
          action={<Badge variant="outline">{formatMonth(data.monthStart)}</Badge>}
        />
        <CardContent>
          <DataTableFrame>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead className="text-right">Total XP</TableHead>
                  <TableHead className="text-right">Monthly XP</TableHead>
                  <TableHead className="text-right">Monthly shots</TableHead>
                  <TableHead className="text-right">Best round</TableHead>
                  <TableHead className="text-right">Longest drive</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.players.map((player, index) => (
                  <TableRow key={player.userId}>
                    <TableCell>
                      <Badge variant={index === 0 ? "default" : "outline"}>{index + 1}</Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{player.displayName}</p>
                        <p className="text-xs text-muted-foreground">{player.isCurrentUser ? "You" : player.relationship}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{integerFormatter.format(player.totalXp)}</TableCell>
                    <TableCell className="text-right">{integerFormatter.format(player.monthlyXp)}</TableCell>
                    <TableCell className="text-right">{integerFormatter.format(player.monthlyShots)}</TableCell>
                    <TableCell className="text-right">{player.bestRoundScore ?? "--"}</TableCell>
                    <TableCell className="text-right">
                      {player.longestDriveYd ? `${numberFormatter.format(player.longestDriveYd)} yd` : "--"}
                    </TableCell>
                  </TableRow>
                ))}
                {data.players.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No opted-in shared players yet. Invite someone from settings, then ask them to enable leaderboard visibility.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </DataTableFrame>
        </CardContent>
      </DataPanel>
    </PageShell>
  );
}

async function getLeaderboardData() {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const membershipRows = await db
    .select()
    .from(accountMemberships)
    .where(or(eq(accountMemberships.ownerUserId, userId), eq(accountMemberships.memberUserId, userId)));
  const connectedIds = new Set<string>([userId]);
  const relationshipByUserId = new Map<string, string>([[userId, "Current login"]]);

  for (const membership of membershipRows) {
    connectedIds.add(membership.ownerUserId);
    connectedIds.add(membership.memberUserId);
    const otherUserId = membership.ownerUserId === userId ? membership.memberUserId : membership.ownerUserId;
    relationshipByUserId.set(otherUserId, membership.ownerUserId === userId ? membership.role : `shared ${membership.role}`);
  }

  const ids = [...connectedIds];
  const [profileRows, xpRows, monthlyXpRows, shotRows, roundRows] = await Promise.all([
    db.select().from(users).where(inArray(users.id, ids)),
    db.select().from(xpLedger).where(inArray(xpLedger.userId, ids)),
    db.select().from(xpLedger).where(and(inArray(xpLedger.userId, ids), gte(xpLedger.createdAt, monthStart))),
    db
      .select({
        userId: shots.userId,
        clubType: shots.clubType,
        totalYd: shots.totalYd,
      })
      .from(shots)
      .where(and(inArray(shots.userId, ids), gte(shots.shotAt, monthStart))),
    db
      .select({
        userId: sessions.userId,
        scorecardJson: sessions.scorecardJson,
      })
      .from(sessions)
      .where(and(inArray(sessions.userId, ids), gte(sessions.date, monthStart)))
      .orderBy(desc(sessions.date)),
  ]);

  const visibleProfiles = profileRows.filter((profile) => profile.id === userId || allowsLeaderboard(profile.privacySettingsJson));
  const totalXpByUser = sumXpByUser(xpRows);
  const monthlyXpByUser = sumXpByUser(monthlyXpRows);
  const monthlyShotsByUser = countByUser(shotRows.map((shot) => shot.userId));
  const longestDriveByUser = maxByUser(
    shotRows
      .filter((shot) => shot.clubType === "driver" && typeof shot.totalYd === "number")
      .map((shot) => ({ userId: shot.userId, value: shot.totalYd ?? 0 })),
  );
  const bestRoundByUser = minByUser(
    roundRows
      .map((round) => ({ userId: round.userId, value: scorecardTotal(round.scorecardJson ?? []) }))
      .filter((row): row is { userId: string; value: number } => typeof row.value === "number"),
  );

  const players = visibleProfiles
    .map((profile) => ({
      userId: profile.id,
      displayName: profile.name ?? profile.email ?? "ForeKingHell player",
      isCurrentUser: profile.id === userId,
      relationship: relationshipByUserId.get(profile.id) ?? "Shared account",
      totalXp: totalXpByUser.get(profile.id) ?? 0,
      monthlyXp: monthlyXpByUser.get(profile.id) ?? 0,
      monthlyShots: monthlyShotsByUser.get(profile.id) ?? 0,
      bestRoundScore: bestRoundByUser.get(profile.id) ?? null,
      longestDriveYd: longestDriveByUser.get(profile.id) ?? null,
    }))
    .sort((a, b) => b.totalXp - a.totalXp || b.monthlyXp - a.monthlyXp || a.displayName.localeCompare(b.displayName));

  return {
    monthStart,
    connectedAccountCount: Math.max(0, connectedIds.size - 1),
    monthlyShotTotal: players.reduce((total, player) => total + player.monthlyShots, 0),
    monthlyRoundTotal: roundRows.length,
    players,
    challengeWinners: {
      practice: maxPlayer(players, (player) => player.monthlyShots),
      lowRound: minPlayer(players.filter((player) => player.bestRoundScore !== null), (player) => player.bestRoundScore ?? Number.POSITIVE_INFINITY),
      longDrive: maxPlayer(players, (player) => player.longestDriveYd ?? 0),
    },
  };
}

function allowsLeaderboard(value: unknown) {
  return Boolean(value && typeof value === "object" && (value as { allowLeaderboard?: unknown }).allowLeaderboard === true);
}

function sumXpByUser(rows: Array<typeof xpLedger.$inferSelect>) {
  const totals = new Map<string, number>();

  for (const row of rows) {
    totals.set(row.userId, (totals.get(row.userId) ?? 0) + row.amount);
  }

  return totals;
}

function countByUser(userIds: string[]) {
  const totals = new Map<string, number>();

  for (const userId of userIds) {
    totals.set(userId, (totals.get(userId) ?? 0) + 1);
  }

  return totals;
}

function maxByUser(rows: Array<{ userId: string; value: number }>) {
  const maxes = new Map<string, number>();

  for (const row of rows) {
    maxes.set(row.userId, Math.max(maxes.get(row.userId) ?? 0, row.value));
  }

  return maxes;
}

function minByUser(rows: Array<{ userId: string; value: number }>) {
  const mins = new Map<string, number>();

  for (const row of rows) {
    mins.set(row.userId, Math.min(mins.get(row.userId) ?? Number.POSITIVE_INFINITY, row.value));
  }

  return mins;
}

function scorecardTotal(scorecard: NonNullable<(typeof sessions.$inferSelect)["scorecardJson"]>) {
  const scores = scorecard.map((hole) => hole.score).filter((score): score is number => typeof score === "number");
  return scores.length > 0 ? scores.reduce((total, score) => total + score, 0) : null;
}

function maxPlayer<T>(players: T[], valueFor: (player: T) => number) {
  return players.reduce<T | null>((best, player) => {
    if (!best || valueFor(player) > valueFor(best)) {
      return player;
    }

    return best;
  }, null);
}

function minPlayer<T>(players: T[], valueFor: (player: T) => number) {
  return players.reduce<T | null>((best, player) => {
    if (!best || valueFor(player) < valueFor(best)) {
      return player;
    }

    return best;
  }, null);
}

function formatMonth(value: Date) {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(value);
}
