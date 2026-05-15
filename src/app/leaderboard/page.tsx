import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, CalendarDays, Globe2, Medal, ShieldCheck, Target, Trophy, Users } from "lucide-react";
import { and, desc, eq, gte, inArray, or } from "drizzle-orm";

import {
  DataPanel,
  DataTableFrame,
  MetricCard,
  MobileBentoSummary,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { sessions, shots, userProfiles, users, xpLedger } from "@/db/schema";
import { getDb } from "@/db/client";
import { getChallengesPageData } from "@/lib/challenges";
import { ensureSocialProfileForUser, getFriendIds, parseVisibility } from "@/lib/social";
import { requireCurrentUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";

type LeaderboardTab = "friends" | "monthly" | "challenges" | "public";

type LeaderboardPageProps = {
  searchParams?: Promise<{
    tab?: string;
    provider?: string;
    verification?: string;
  }>;
};

type PlayerRow = {
  userId: string;
  displayName: string;
  username: string;
  isCurrentUser: boolean;
  relationship: string;
  totalXp: number;
  monthlyXp: number;
  previousMonthlyXp: number;
  monthlyShots: number;
  bestRoundScore: number | null;
  longestDriveYd: number | null;
  verificationLabel: string;
};

const integerFormatter = new Intl.NumberFormat("en-GB");
const numberFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

export default async function LeaderboardPage({ searchParams }: LeaderboardPageProps) {
  const params = await searchParams;
  const activeTab = parseTab(params?.tab);
  const filters = parseLeaderboardFilters(params);
  const data = await getLeaderboardData(activeTab, filters);

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
          <Link href="/profile" prefetch={false}>
            <ShieldCheck className="size-4" />
            Leaderboard privacy
          </Link>
        </Button>
      </div>

      <PageHeader
        eyebrow={<StatusPill tone="green">Leaderboard v2</StatusPill>}
        title="Leaderboards"
        description="Friends, monthly, challenge and public opt-in rankings. Coach/viewer/editor account sharing is not used for normal friend rankings."
        metrics={[
          { label: "Visible players", value: integerFormatter.format(data.players.length), detail: `${titleCase(activeTab)} scope` },
          { label: "Friends", value: integerFormatter.format(data.friendCount), detail: "Accepted friendships only" },
          { label: "Monthly shots", value: integerFormatter.format(data.monthlyShotTotal), detail: formatMonth(data.monthStart) },
          { label: "Challenge boards", value: integerFormatter.format(data.challengeBoards.length), detail: "Visible challenge leaders" },
        ]}
      />

      <MobileBentoSummary
        items={[
          {
            label: "Leader",
            value: data.players[0]?.displayName ?? "--",
            detail: data.players[0] ? `${integerFormatter.format(scoreForTab(data.players[0], activeTab))} ${activeTab === "monthly" ? "monthly XP" : "XP"}` : "No visible players.",
            tone: "amber",
          },
          {
            label: "You",
            value: data.players.find((player) => player.isCurrentUser)?.displayName ?? "Hidden",
            detail: "Profile-controlled visibility",
            tone: "green",
          },
          {
            label: "Monthly shots",
            value: integerFormatter.format(data.monthlyShotTotal),
            detail: formatMonth(data.monthStart),
            tone: "sky",
          },
          {
            label: "Boards",
            value: integerFormatter.format(data.challengeBoards.length),
            detail: "Challenges",
            tone: "slate",
          },
        ]}
      />

      <section className="hidden gap-4 sm:grid md:grid-cols-3">
        <MetricCard
          label="Monthly XP"
          value={data.monthlyLeader?.displayName ?? "--"}
          detail={data.monthlyLeader ? `${integerFormatter.format(data.monthlyLeader.monthlyXp)} XP this month.` : "No monthly XP yet."}
          icon={CalendarDays}
          tone="green"
        />
        <MetricCard
          label="Longest verified drive"
          value={data.longDriveLeader?.displayName ?? "--"}
          detail={data.longDriveLeader?.longestDriveYd ? `${numberFormatter.format(data.longDriveLeader.longestDriveYd)} yd · ${data.longDriveLeader.verificationLabel}` : "No driver shots yet."}
          icon={Medal}
          tone="amber"
        />
        <MetricCard
          label="Challenge leader"
          value={data.challengeBoards[0]?.leader?.displayName ?? "--"}
          detail={data.challengeBoards[0]?.leader ? data.challengeBoards[0].title : "No challenge results yet."}
          icon={Trophy}
          tone="sky"
        />
      </section>

      <div className="flex flex-wrap gap-2">
        <TabLink tab="friends" activeTab={activeTab} icon={<Users className="size-4" />} label="Friends" />
        <TabLink tab="monthly" activeTab={activeTab} icon={<CalendarDays className="size-4" />} label="Monthly" />
        <TabLink tab="challenges" activeTab={activeTab} icon={<Trophy className="size-4" />} label="Challenges" />
        <TabLink tab="public" activeTab={activeTab} icon={<Globe2 className="size-4" />} label="Public opt-in" />
      </div>

      <section className="rounded-xl border bg-white p-3 shadow-sm">
        <form className="flex flex-wrap items-end gap-2" action="/leaderboard">
          <input type="hidden" name="tab" value={activeTab} />
          <label className="grid gap-1 text-xs font-medium">
            <span>Provider</span>
            <select name="provider" defaultValue={filters.provider} className="h-9 rounded-lg border bg-slate-50 px-2 text-sm">
              <option value="all">All</option>
              <option value="rapsodo">Rapsodo CSV</option>
              <option value="rapsodo_cloud">Rapsodo Cloud</option>
              <option value="manual">Manual</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium">
            <span>Verification</span>
            <select name="verification" defaultValue={filters.verification} className="h-9 rounded-lg border bg-slate-50 px-2 text-sm">
              <option value="all">All</option>
              <option value="verified">Verified only</option>
              <option value="mixed">Mixed</option>
              <option value="manual">Manual only</option>
            </select>
          </label>
          <Button type="submit" variant="outline" size="sm">Apply filters</Button>
          <Badge variant="outline" className="px-3 py-1.5">Scope: {titleCase(activeTab)}</Badge>
          <Badge variant="outline" className="px-3 py-1.5">Month: {formatMonth(data.monthStart)}</Badge>
        </form>
      </section>

      {activeTab === "challenges" ? (
        <ChallengeBoards boards={data.challengeBoards} />
      ) : (
        <PlayerLeaderboard players={data.players} activeTab={activeTab} monthStart={data.monthStart} filters={filters} />
      )}
    </PageShell>
  );
}

type LeaderboardFilters = {
  provider: "all" | "rapsodo" | "rapsodo_cloud" | "manual";
  verification: "all" | "verified" | "mixed" | "manual";
};

async function getLeaderboardData(activeTab: LeaderboardTab, filters: LeaderboardFilters) {
  const db = getDb();
  const userId = await requireCurrentUserId();
  await ensureSocialProfileForUser(userId);
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const previousMonthStart = new Date(monthStart);
  previousMonthStart.setUTCMonth(previousMonthStart.getUTCMonth() - 1);

  const friendIds = await getFriendIds(userId);
  const scopedIds = activeTab === "public" ? [userId] : [userId, ...friendIds];
  const profileRows =
    activeTab === "public"
      ? await db
          .select({
            id: users.id,
            email: users.email,
            name: users.name,
            privacySettingsJson: users.privacySettingsJson,
            username: userProfiles.username,
            displayName: userProfiles.displayName,
            leaderboardVisibility: userProfiles.leaderboardVisibility,
            publicProfile: userProfiles.publicProfile,
          })
          .from(userProfiles)
          .innerJoin(users, eq(userProfiles.userId, users.id))
          .where(or(eq(userProfiles.publicProfile, true), eq(userProfiles.userId, userId)))
          .limit(100)
      : scopedIds.length > 0
        ? await db
            .select({
              id: users.id,
              email: users.email,
              name: users.name,
              privacySettingsJson: users.privacySettingsJson,
              username: userProfiles.username,
              displayName: userProfiles.displayName,
              leaderboardVisibility: userProfiles.leaderboardVisibility,
              publicProfile: userProfiles.publicProfile,
            })
            .from(userProfiles)
            .innerJoin(users, eq(userProfiles.userId, users.id))
            .where(inArray(userProfiles.userId, scopedIds))
        : [];
  const visibleProfiles = profileRows.filter((profile) => profile.id === userId || allowsLeaderboard(profile, activeTab));
  const visibleIds = visibleProfiles.map((profile) => profile.id);
  const [xpRows, monthlyXpRows, previousMonthlyXpRows, rawShotRows, roundRows] =
    visibleIds.length > 0
      ? await Promise.all([
          db.select().from(xpLedger).where(inArray(xpLedger.userId, visibleIds)),
          db.select().from(xpLedger).where(and(inArray(xpLedger.userId, visibleIds), gte(xpLedger.createdAt, monthStart))),
          db
            .select()
            .from(xpLedger)
            .where(and(inArray(xpLedger.userId, visibleIds), gte(xpLedger.createdAt, previousMonthStart))),
          db
            .select({
              userId: shots.userId,
              clubType: shots.clubType,
              totalYd: shots.totalYd,
              source: sessions.source,
            })
            .from(shots)
            .innerJoin(sessions, eq(shots.sessionId, sessions.id))
            .where(and(inArray(shots.userId, visibleIds), gte(shots.shotAt, monthStart))),
          db
            .select({
              userId: sessions.userId,
              scorecardJson: sessions.scorecardJson,
            })
            .from(sessions)
            .where(and(inArray(sessions.userId, visibleIds), gte(sessions.date, monthStart)))
            .orderBy(desc(sessions.date)),
        ])
      : [[], [], [], [], []];
  const shotRows = rawShotRows.filter((shot) => {
    const verification = verificationLabelForSource(shot.source);

    if (filters.provider !== "all" && shot.source !== filters.provider) {
      return false;
    }

    if (filters.verification === "verified") {
      return verification !== "Manual" && verification !== "Unverified";
    }

    if (filters.verification === "manual") {
      return verification === "Manual";
    }

    return true;
  });
  const totalXpByUser = sumXpByUser(xpRows);
  const monthlyXpByUser = sumXpByUser(monthlyXpRows);
  const previousMonthlyXpByUser = sumXpByUser(
    previousMonthlyXpRows.filter((row) => row.createdAt < monthStart),
  );
  const monthlyShotsByUser = countByUser(shotRows.map((shot) => shot.userId));
  const longestDriveByUser = longestDriveRowsByUser(shotRows);
  const bestRoundByUser = minByUser(
    roundRows
      .map((round) => ({ userId: round.userId, value: scorecardTotal(round.scorecardJson ?? []) }))
      .filter((row): row is { userId: string; value: number } => typeof row.value === "number"),
  );
  const friendIdSet = new Set(friendIds);
  const players = visibleProfiles
    .map((profile): PlayerRow => {
      const longDrive = longestDriveByUser.get(profile.id) ?? null;

      return {
        userId: profile.id,
        displayName: profile.displayName ?? profile.name ?? profile.email ?? "ForeKingHell player",
        username: profile.username,
        isCurrentUser: profile.id === userId,
        relationship: profile.id === userId ? "You" : friendIdSet.has(profile.id) ? "Friend" : "Public opt-in",
        totalXp: totalXpByUser.get(profile.id) ?? 0,
        monthlyXp: monthlyXpByUser.get(profile.id) ?? 0,
        previousMonthlyXp: previousMonthlyXpByUser.get(profile.id) ?? 0,
        monthlyShots: monthlyShotsByUser.get(profile.id) ?? 0,
        bestRoundScore: bestRoundByUser.get(profile.id) ?? null,
        longestDriveYd: longDrive?.totalYd ?? null,
        verificationLabel: longDrive?.verificationLabel ?? "Unverified",
      };
    })
    .sort((a, b) =>
      activeTab === "monthly"
        ? b.monthlyXp - a.monthlyXp || b.monthlyShots - a.monthlyShots || a.displayName.localeCompare(b.displayName)
        : b.totalXp - a.totalXp || b.monthlyXp - a.monthlyXp || a.displayName.localeCompare(b.displayName),
    );
  const challengeData = await getChallengesPageData();

  return {
    monthStart,
    friendCount: friendIds.length,
    monthlyShotTotal: players.reduce((total, player) => total + player.monthlyShots, 0),
    players,
    monthlyLeader: maxPlayer(players, (player) => player.monthlyXp),
    longDriveLeader: maxPlayer(players, (player) => player.longestDriveYd ?? 0),
    challengeBoards: challengeData.challenges.filter((challenge) => challenge.leader),
  };
}

function PlayerLeaderboard({
  players,
  activeTab,
  monthStart,
  filters,
}: {
  players: PlayerRow[];
  activeTab: LeaderboardTab;
  monthStart: Date;
  filters: LeaderboardFilters;
}) {
  const currentUserIndex = players.findIndex((player) => player.isCurrentUser);
  const currentUser = currentUserIndex >= 0 ? players[currentUserIndex] : null;
  const podium = players.slice(0, 3);

  return (
    <section className="grid gap-4">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <article className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Podium</p>
              <p className="mt-1 text-sm text-muted-foreground">Top three in the active leaderboard scope.</p>
            </div>
            <Badge variant="outline">{formatMonth(monthStart)}</Badge>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {podium.length === 0 ? (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground md:col-span-3">No opted-in players yet.</p>
            ) : (
              podium.map((player, index) => <LeaderboardPodiumCard key={player.userId} player={player} rank={index + 1} activeTab={activeTab} />)
            )}
          </div>
        </article>

        <article className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold">Your rank</p>
          {currentUser ? (
            <div className="mt-3 rounded-xl bg-slate-50 p-4">
              <Badge variant="secondary">#{currentUserIndex + 1}</Badge>
              <p className="mt-3 text-2xl font-semibold tracking-normal">{integerFormatter.format(scoreForTab(currentUser, activeTab))} XP</p>
              <p className="mt-1 text-sm text-muted-foreground">{movementLabel(currentUser)}</p>
              {currentUserIndex === 3 ? (
                <p className="mt-2 text-sm text-muted-foreground">Best route to climb: enter a challenge board with verified attempts.</p>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Enable leaderboard visibility in your profile.</p>
          )}
        </article>
      </section>

      <DataPanel>
        <SectionHeader
          title={activeTab === "public" ? "Public opt-in leaderboard" : activeTab === "monthly" ? "Monthly leaderboard" : "Friend leaderboard"}
          description={`Ranks include opted-in players. Provider filter: ${label(filters.provider)}. Verification filter: ${label(filters.verification)}.`}
          action={<Badge variant="outline">{formatMonth(monthStart)}</Badge>}
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
                  <TableHead className="text-right">Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {players.map((player, index) => (
                  <TableRow key={player.userId}>
                    <TableCell>
                      <Badge variant={index === 0 ? "default" : "outline"}>{index + 1}</Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <Link href={`/profile/${player.username}`} prefetch={false} className="font-medium hover:underline">
                          {player.displayName}
                        </Link>
                        <p className="text-xs text-muted-foreground">{player.relationship}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{integerFormatter.format(player.totalXp)}</TableCell>
                    <TableCell className="text-right">{integerFormatter.format(player.monthlyXp)}</TableCell>
                    <TableCell className="text-right">{integerFormatter.format(player.monthlyShots)}</TableCell>
                    <TableCell className="text-right">{player.bestRoundScore ?? "--"}</TableCell>
                    <TableCell className="text-right">
                      {player.longestDriveYd ? `${numberFormatter.format(player.longestDriveYd)} yd` : "--"}
                    </TableCell>
                    <TableCell className="text-right">{player.verificationLabel}</TableCell>
                  </TableRow>
                ))}
                {players.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      No opted-in players in this scope yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </DataTableFrame>
        </CardContent>
      </DataPanel>
    </section>
  );
}

function LeaderboardPodiumCard({ player, rank, activeTab }: { player: PlayerRow; rank: number; activeTab: LeaderboardTab }) {
  return (
    <article className={rank === 1 ? "rounded-xl border border-amber-200 bg-amber-50 p-4" : "rounded-xl border bg-slate-50 p-4"}>
      <Badge variant={rank === 1 ? "default" : "outline"}>#{rank}</Badge>
      <Link href={`/profile/${player.username}`} prefetch={false} className="mt-3 block text-lg font-semibold tracking-normal hover:underline">
        {player.displayName}
      </Link>
      <p className="mt-1 text-2xl font-semibold tracking-normal">{integerFormatter.format(scoreForTab(player, activeTab))}</p>
      <p className="text-sm text-muted-foreground">{activeTab === "monthly" ? "monthly XP" : "total XP"}</p>
    </article>
  );
}

function ChallengeBoards({ boards }: { boards: Awaited<ReturnType<typeof getLeaderboardData>>["challengeBoards"] }) {
  return (
    <DataPanel>
      <SectionHeader
        title="Challenge leaderboards"
        description="Visible challenge boards with current leaders and verification labels."
        action={<Target className="size-5 text-emerald-600" />}
      />
      <CardContent>
        <DataTableFrame>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Challenge</TableHead>
                <TableHead>Template</TableHead>
                <TableHead className="text-right">Participants</TableHead>
                <TableHead className="text-right">Leader</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="text-right">Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {boards.map((board) => (
                <TableRow key={board.id}>
                  <TableCell>
                    <Link href={`/challenges/${board.id}`} prefetch={false} className="font-medium hover:underline">
                      {board.title}
                    </Link>
                  </TableCell>
                  <TableCell>{board.templateName}</TableCell>
                  <TableCell className="text-right">{board.participantCount}</TableCell>
                  <TableCell className="text-right">{board.leader?.displayName ?? "--"}</TableCell>
                  <TableCell className="text-right">{board.leader?.scoreLabel ?? "--"}</TableCell>
                  <TableCell className="text-right">{board.leader?.verificationLabel ?? "--"}</TableCell>
                </TableRow>
              ))}
              {boards.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No challenge results yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </DataTableFrame>
      </CardContent>
    </DataPanel>
  );
}

function TabLink({
  tab,
  activeTab,
  label,
  icon,
}: {
  tab: LeaderboardTab;
  activeTab: LeaderboardTab;
  label: string;
  icon: ReactNode;
}) {
  return (
    <Button asChild variant={tab === activeTab ? "default" : "outline"}>
      <Link href={`/leaderboard?tab=${tab}`} prefetch={false}>
        {icon}
        {label}
      </Link>
    </Button>
  );
}

function allowsLeaderboard(profile: {
  id: string;
  privacySettingsJson: unknown;
  leaderboardVisibility: string;
  publicProfile: boolean;
}, activeTab: LeaderboardTab) {
  const accountAllows = Boolean(
    profile.privacySettingsJson &&
      typeof profile.privacySettingsJson === "object" &&
      (profile.privacySettingsJson as { allowLeaderboard?: unknown }).allowLeaderboard === true,
  );
  const profileVisibility = parseVisibility(profile.leaderboardVisibility, "private");

  if (!accountAllows || profileVisibility === "private") {
    return false;
  }

  return activeTab === "public" ? profileVisibility === "public" && profile.publicProfile : true;
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

function longestDriveRowsByUser(
  rows: Array<{
    userId: string;
    clubType: string;
    totalYd: number | null;
    source: string;
  }>,
) {
  const best = new Map<string, { totalYd: number; verificationLabel: string }>();

  for (const row of rows) {
    if (row.clubType.toLowerCase() !== "driver" || typeof row.totalYd !== "number") {
      continue;
    }

    const current = best.get(row.userId);

    if (!current || row.totalYd > current.totalYd) {
      best.set(row.userId, {
        totalYd: row.totalYd,
        verificationLabel: verificationLabelForSource(row.source),
      });
    }
  }

  return best;
}

function minByUser(rows: Array<{ userId: string; value: number }>) {
  const values = new Map<string, number>();

  for (const row of rows) {
    const current = values.get(row.userId);

    if (current === undefined || row.value < current) {
      values.set(row.userId, row.value);
    }
  }

  return values;
}

function maxPlayer(players: PlayerRow[], valueFor: (player: PlayerRow) => number) {
  return players.reduce<PlayerRow | null>((best, player) => {
    if (!best) {
      return player;
    }

    return valueFor(player) > valueFor(best) ? player : best;
  }, null);
}

function scorecardTotal(scorecard: Array<{ score?: number | null }>) {
  const scores = scorecard
    .map((hole) => hole.score)
    .filter((score): score is number => typeof score === "number" && Number.isFinite(score));

  return scores.length > 0 ? scores.reduce((total, score) => total + score, 0) : null;
}

function scoreForTab(player: PlayerRow, tab: LeaderboardTab) {
  return tab === "monthly" ? player.monthlyXp : player.totalXp;
}

function movementLabel(player: PlayerRow) {
  const delta = player.monthlyXp - player.previousMonthlyXp;

  if (delta > 0) {
    return `Movement since last month: +${integerFormatter.format(delta)} XP.`;
  }

  if (delta < 0) {
    return `Movement since last month: ${integerFormatter.format(delta)} XP.`;
  }

  return "Movement since last month: level with your previous monthly pace.";
}

function verificationLabelForSource(source: string) {
  switch (source) {
    case "rapsodo_cloud":
      return "Rapsodo Cloud";
    case "rapsodo":
      return "Rapsodo CSV";
    case "manual":
      return "Manual";
    default:
      return "Unverified";
  }
}

function formatMonth(value: Date) {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(value);
}

function parseTab(value: string | undefined): LeaderboardTab {
  return value === "monthly" || value === "challenges" || value === "public" ? value : "friends";
}

function parseLeaderboardFilters(params: Awaited<LeaderboardPageProps["searchParams"]>): LeaderboardFilters {
  return {
    provider:
      params?.provider === "rapsodo" || params?.provider === "rapsodo_cloud" || params?.provider === "manual"
        ? params.provider
        : "all",
    verification:
      params?.verification === "verified" || params?.verification === "mixed" || params?.verification === "manual"
        ? params.verification
        : "all",
  };
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function label(value: string) {
  return value
    .split("_")
    .map((part) => titleCase(part))
    .join(" ");
}
