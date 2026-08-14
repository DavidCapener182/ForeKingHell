import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  ShieldCheck,
  Target,
  Trophy,
} from "lucide-react";
import { and, desc, eq, gte, inArray, or, sql } from "drizzle-orm";

import { DataPanel, DataTableFrame, PageShell, SectionHeader } from "@/components/premium";
import { MobileAppShell, MobileRouteTabs, MobileTopBar } from "@/components/mobile-sports";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import type {
  DesktopSavedViewSuggestion,
  DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  courseRecordCategories,
  courseRecordResults,
  courseRecords,
  courses,
  sessions,
  shots,
  tournamentStandings,
  tournaments,
  userProfiles,
  users,
  xpLedger,
} from "@/db/schema";
import { getDb } from "@/db/client";
import { getChallengesPageData } from "@/lib/challenges";
import { ensureSocialProfileForUser, getFriendIds, parseVisibility } from "@/lib/social";
import { requireCurrentUserId } from "@/lib/current-user";
import { getRequestAppSurface } from "@/lib/app-surface-server";
import {
  LeaderboardPlayerControls,
  LeaderboardTypeTabs,
} from "@/app/leaderboard/leaderboard-controls";
import { AppEmptyState } from "@/components/app/app-empty-state";

export const dynamic = "force-dynamic";

type LeaderboardTab = "friends" | "monthly" | "courses" | "challenges" | "tournaments" | "public";
type LeaderboardPeriod = "all-time" | "monthly";

type LeaderboardPageProps = {
  searchParams?: Promise<{
    tab?: string;
    period?: string;
    provider?: string;
    verification?: string;
    sort?: string;
    dir?: string;
  }>;
};

type PlayerRow = {
  userId: string;
  displayName: string;
  username: string;
  isCurrentUser: boolean;
  rankMovement: number | null;
  relationship: string;
  totalXp: number;
  monthlyXp: number;
  monthlyShots: number;
  monthlySessions: number;
  monthlyRounds: number;
  bestRoundScore: number | null;
  longestDriveYd: number | null;
  verificationLabel: string;
};

type CourseChampionBoard = {
  id: string;
  courseId: string;
  courseName: string;
  categoryName: string;
  scope: string;
  period: string;
  scoreLabel: string;
  verificationTier: string;
  champion: {
    displayName: string;
    username: string;
  };
};

type TournamentBoard = {
  id: string;
  title: string;
  format: string;
  grossTotal: number;
  roundsCompleted: number;
  champion: {
    displayName: string;
    username: string;
  };
};

const integerFormatter = new Intl.NumberFormat("en-GB");

type LeaderboardSortDirection = "asc" | "desc";
type PlayerLeaderboardSortMetric =
  | "rank"
  | "player"
  | "total-xp"
  | "monthly-xp"
  | "monthly-shots"
  | "best-round"
  | "longest-drive"
  | "source";
type ChallengeLeaderboardSortMetric =
  | "challenge"
  | "template"
  | "participants"
  | "leader"
  | "score"
  | "source";
type PlayerLeaderboardSortState = {
  metric: PlayerLeaderboardSortMetric;
  dir: LeaderboardSortDirection;
};
type ChallengeLeaderboardSortState = {
  metric: ChallengeLeaderboardSortMetric;
  dir: LeaderboardSortDirection;
};

const leaderboardPlayerColumns: DesktopWorkbenchColumn[] = [
  { id: "rank", label: "Rank", locked: true },
  { id: "player", label: "Golfer", locked: true },
  { id: "result", label: "Result" },
  { id: "movement", label: "Movement" },
  { id: "rounds-sessions", label: "Rounds / sessions" },
  { id: "proof", label: "Proof" },
];

const playerSortLabels: Record<PlayerLeaderboardSortMetric, string> = {
  rank: "Rank",
  player: "Player",
  "total-xp": "Total XP",
  "monthly-xp": "Monthly XP",
  "monthly-shots": "Monthly shots",
  "best-round": "Best round",
  "longest-drive": "Longest drive",
  source: "Source",
};

const playerSortDefaultDirections: Record<PlayerLeaderboardSortMetric, LeaderboardSortDirection> = {
  rank: "asc",
  player: "asc",
  "total-xp": "desc",
  "monthly-xp": "desc",
  "monthly-shots": "desc",
  "best-round": "asc",
  "longest-drive": "desc",
  source: "asc",
};

const leaderboardSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Monthly XP race",
    href: "/leaderboard?tab=friends&period=monthly",
    detail: "Rank friends by the current month with round and session context.",
  },
  {
    title: "Verified leaderboard rows",
    href: "/leaderboard?tab=friends&period=monthly&verification=verified",
    detail: "Show rows backed by launch-monitor or official-source evidence.",
  },
  {
    title: "Public opt-in board",
    href: "/leaderboard?tab=public",
    detail: "Compare only privacy-safe public leaderboard profiles.",
  },
];

const challengeLeaderboardColumns: DesktopWorkbenchColumn[] = [
  { id: "challenge", label: "Challenge", locked: true },
  { id: "template", label: "Template" },
  { id: "participants", label: "Participants" },
  { id: "leader", label: "Leader" },
  { id: "score", label: "Score" },
  { id: "source", label: "Source" },
];

const challengeSortLabels: Record<ChallengeLeaderboardSortMetric, string> = {
  challenge: "Challenge",
  template: "Template",
  participants: "Participants",
  leader: "Leader",
  score: "Score",
  source: "Source",
};

const challengeSortDefaultDirections: Record<
  ChallengeLeaderboardSortMetric,
  LeaderboardSortDirection
> = {
  challenge: "asc",
  template: "asc",
  participants: "desc",
  leader: "asc",
  score: "desc",
  source: "asc",
};

const challengeLeaderboardSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Active challenge boards",
    href: "/leaderboard?tab=challenges",
    detail: "Review live challenge leaders, participant count and proof source.",
  },
  {
    title: "Create a climb route",
    href: "/challenges",
    detail: "Use challenges to turn leaderboard movement into an action plan.",
  },
];

export default async function LeaderboardPage({ searchParams }: LeaderboardPageProps) {
  const params = await searchParams;
  const requestedTab = parseTab(params?.tab);
  const activeTab = requestedTab === "monthly" ? "friends" : requestedTab;
  const period = parseLeaderboardPeriod(params?.period, requestedTab);
  const filters = parseLeaderboardFilters(params);
  const playerSort = parsePlayerLeaderboardSort(params?.sort, params?.dir);
  const challengeSort = parseChallengeLeaderboardSort(params?.sort, params?.dir);
  const [data, surface] = await Promise.all([
    getLeaderboardData(activeTab, filters, period),
    getRequestAppSurface(),
  ]);
  const workbench =
    surface === "workbench" ? await import("@/components/app/desktop-workbench") : null;
  const DesktopWorkbenchLayout = workbench?.DesktopWorkbenchLayout;
  const showMobilePlayerFilters = isPlayerLeaderboardTab(activeTab);

  return (
    <PageShell>
      {surface === "companion" ? (
        <MobileAppShell>
          <MobileTopBar title="Leaderboards" />
          <MobileRouteTabs group="social" activeKey="leaderboard" />
          <LeaderboardCompetitionHeader
            activeTab={activeTab}
            period={period}
            monthStart={data.monthStart}
            playerCount={data.players.length}
          />
          <LeaderboardTypeTabs activeTab={activeTab} period={period} />
          {showMobilePlayerFilters ? (
            <LeaderboardPlayerControls
              activeTab={activeTab}
              period={period}
              monthLabel={formatMonth(data.monthStart)}
              provider={filters.provider}
              verification={filters.verification}
            />
          ) : null}
          {activeTab === "courses" ? (
            <MobileBoardLeaderboard
              label="Course champions"
              items={data.courseChampionBoards.map((board) => ({
                id: board.id,
                name: board.champion.displayName,
                href: `/profile/${board.champion.username}`,
                score: board.scoreLabel,
                detail: board.courseName,
              }))}
            />
          ) : activeTab === "challenges" ? (
            <MobileBoardLeaderboard
              label="Challenge boards"
              items={data.challengeBoards.map((board) => ({
                id: board.id,
                name: board.leader?.displayName ?? "Open",
                href: board.leader ? `/profile/${board.leader.username}` : undefined,
                score: board.leader?.scoreLabel ?? "--",
                detail: board.title,
              }))}
            />
          ) : activeTab === "tournaments" ? (
            <MobileBoardLeaderboard
              label="Tournament boards"
              items={data.tournamentBoards.map((board) => ({
                id: board.id,
                name: board.champion.displayName,
                href: `/profile/${board.champion.username}`,
                score: board.grossTotal,
                detail: `${board.title} · ${board.roundsCompleted} rounds`,
              }))}
            />
          ) : (
            <MobileCompetitionLeaderboard players={data.players} period={period} />
          )}
        </MobileAppShell>
      ) : null}

      {surface === "workbench" && DesktopWorkbenchLayout ? (
        <DesktopWorkbenchLayout scope="leaderboard">
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

          <>
            <LeaderboardCompetitionHeader
              activeTab={activeTab}
              period={period}
              monthStart={data.monthStart}
              playerCount={data.players.length}
            />

            <LeaderboardTypeTabs activeTab={activeTab} period={period} />

            {activeTab === "friends" || activeTab === "public" ? (
              <LeaderboardPlayerControls
                activeTab={activeTab}
                period={period}
                monthLabel={formatMonth(data.monthStart)}
                provider={filters.provider}
                verification={filters.verification}
              />
            ) : null}

            {activeTab === "challenges" ? (
              <ChallengeBoards boards={data.challengeBoards} sortState={challengeSort} />
            ) : activeTab === "courses" ? (
              <CourseChampionBoards boards={data.courseChampionBoards} />
            ) : activeTab === "tournaments" ? (
              <TournamentBoards boards={data.tournamentBoards} />
            ) : (
              <PlayerLeaderboard
                players={data.players}
                activeTab={activeTab}
                period={period}
                monthStart={data.monthStart}
                filters={filters}
                sortState={playerSort}
              />
            )}
          </>
        </DesktopWorkbenchLayout>
      ) : null}
    </PageShell>
  );
}

type LeaderboardProvider = "all" | "espn" | "rapsodo" | "rapsodo_cloud" | "manual";

type LeaderboardFilters = {
  provider: LeaderboardProvider;
  verification: "all" | "verified" | "manual";
};

async function getLeaderboardData(
  activeTab: LeaderboardTab,
  filters: LeaderboardFilters,
  period: LeaderboardPeriod,
) {
  const db = getDb();
  const userId = await requireCurrentUserId();
  await ensureSocialProfileForUser(userId);
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
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
            visibilitySettingsJson: userProfiles.visibilitySettingsJson,
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
              visibilitySettingsJson: userProfiles.visibilitySettingsJson,
            })
            .from(userProfiles)
            .innerJoin(users, eq(userProfiles.userId, users.id))
            .where(inArray(userProfiles.userId, scopedIds))
        : [];
  const visibleProfiles = profileRows.filter(
    (profile) => profile.id === userId || allowsLeaderboard(profile, activeTab),
  );
  const visibleIds = visibleProfiles.map((profile) => profile.id);
  const tourPlayerIds = new Set(
    visibleProfiles.filter(isTourPlayerProfile).map((profile) => profile.id),
  );
  const [xpRows, monthlyXpRows, rawShotRows, roundRows] =
    visibleIds.length > 0
      ? await Promise.all([
          db
            .select({
              userId: xpLedger.userId,
              totalXp: sql<number>`coalesce(sum(${xpLedger.amount}), 0)::int`,
            })
            .from(xpLedger)
            .where(inArray(xpLedger.userId, visibleIds))
            .groupBy(xpLedger.userId),
          db
            .select({
              userId: xpLedger.userId,
              totalXp: sql<number>`coalesce(sum(${xpLedger.amount}), 0)::int`,
            })
            .from(xpLedger)
            .where(and(inArray(xpLedger.userId, visibleIds), gte(xpLedger.createdAt, monthStart)))
            .groupBy(xpLedger.userId),
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
      : [[], [], [], []];
  const shotRows = rawShotRows
    .map((shot) => ({
      ...shot,
      source: effectiveLeaderboardSource(shot.source, tourPlayerIds.has(shot.userId)),
    }))
    .filter((shot) => {
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
  const monthlyShotsByUser = countByUser(shotRows.map((shot) => shot.userId));
  const monthlySessionsByUser = countByUser(roundRows.map((session) => session.userId));
  const monthlyRoundsByUser = countByUser(
    roundRows
      .filter((session) => scorecardTotal(session.scorecardJson ?? []) !== null)
      .map((session) => session.userId),
  );
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
        displayName: profile.displayName ?? profile.name ?? profile.email ?? "LM World Tour player",
        username: profile.username,
        isCurrentUser: profile.id === userId,
        rankMovement: null,
        relationship:
          profile.id === userId ? "You" : friendIdSet.has(profile.id) ? "Friend" : "Public opt-in",
        totalXp: totalXpByUser.get(profile.id) ?? 0,
        monthlyXp: monthlyXpByUser.get(profile.id) ?? 0,
        monthlyShots: monthlyShotsByUser.get(profile.id) ?? 0,
        monthlySessions: monthlySessionsByUser.get(profile.id) ?? 0,
        monthlyRounds: monthlyRoundsByUser.get(profile.id) ?? 0,
        bestRoundScore: bestRoundByUser.get(profile.id) ?? null,
        longestDriveYd: longDrive?.totalYd ?? null,
        verificationLabel: longDrive?.verificationLabel ?? "Unverified",
      };
    })
    .sort((a, b) =>
      period === "monthly"
        ? b.monthlyXp - a.monthlyXp ||
          b.monthlyShots - a.monthlyShots ||
          a.displayName.localeCompare(b.displayName)
        : b.totalXp - a.totalXp ||
          b.monthlyXp - a.monthlyXp ||
          a.displayName.localeCompare(b.displayName),
    );
  const [challengeData, courseChampionBoards, tournamentBoards] = await Promise.all([
    getChallengesPageData(),
    getCourseChampionBoards(userId, friendIds),
    getTournamentBoards(userId, friendIds),
  ]);

  return {
    monthStart,
    players,
    challengeBoards: challengeData.challenges.filter((challenge) => challenge.leader),
    courseChampionBoards,
    tournamentBoards,
  };
}

async function getCourseChampionBoards(
  viewerUserId: string,
  friendIds: string[],
): Promise<CourseChampionBoard[]> {
  const creatorIds = [viewerUserId, ...friendIds];
  const visibilityConditions = [
    eq(courseRecords.scope, "public"),
    eq(courseRecords.createdByUserId, viewerUserId),
  ];

  if (creatorIds.length > 0) {
    visibilityConditions.push(
      and(eq(courseRecords.scope, "friends"), inArray(courseRecords.createdByUserId, creatorIds))!,
    );
  }

  const rows = await getDb()
    .select({
      result: courseRecordResults,
      record: courseRecords,
      category: courseRecordCategories,
      course: courses,
      profile: userProfiles,
    })
    .from(courseRecordResults)
    .innerJoin(courseRecords, eq(courseRecordResults.recordId, courseRecords.id))
    .innerJoin(courseRecordCategories, eq(courseRecords.categoryId, courseRecordCategories.id))
    .innerJoin(courses, eq(courseRecords.courseId, courses.id))
    .leftJoin(userProfiles, eq(courseRecordResults.userId, userProfiles.userId))
    .where(and(eq(courseRecordResults.rank, 1), or(...visibilityConditions)))
    .orderBy(desc(courseRecordResults.calculatedAt))
    .limit(12);

  return rows
    .filter((row) => row.profile)
    .map((row) => ({
      id: row.record.id,
      courseId: row.course.id,
      courseName: row.course.name,
      categoryName: row.category.name,
      scope: row.record.scope,
      period: row.record.period,
      scoreLabel: row.result.scoreLabel,
      verificationTier: row.result.verificationTier,
      champion: {
        displayName: row.profile?.displayName ?? "Player",
        username: row.profile?.username ?? row.result.userId,
      },
    }));
}

async function getTournamentBoards(
  viewerUserId: string,
  friendIds: string[],
): Promise<TournamentBoard[]> {
  const creatorIds = [viewerUserId, ...friendIds];
  const rows = await getDb()
    .select({
      standing: tournamentStandings,
      tournament: tournaments,
      profile: userProfiles,
    })
    .from(tournamentStandings)
    .innerJoin(tournaments, eq(tournamentStandings.tournamentId, tournaments.id))
    .leftJoin(userProfiles, eq(tournamentStandings.userId, userProfiles.userId))
    .where(
      and(
        eq(tournamentStandings.rank, 1),
        or(eq(tournaments.visibility, "public"), inArray(tournaments.createdByUserId, creatorIds)),
      ),
    )
    .orderBy(desc(tournamentStandings.calculatedAt))
    .limit(12);

  return rows
    .filter((row) => row.profile)
    .map((row) => ({
      id: row.tournament.id,
      title: row.tournament.title,
      format: row.tournament.format,
      grossTotal: row.standing.grossTotal,
      roundsCompleted: row.standing.roundsCompleted,
      champion: {
        displayName: row.profile?.displayName ?? "Player",
        username: row.profile?.username ?? row.standing.userId,
      },
    }));
}

async function PlayerLeaderboard({
  players,
  activeTab,
  period,
  monthStart,
  filters,
  sortState,
}: {
  players: PlayerRow[];
  activeTab: LeaderboardTab;
  period: LeaderboardPeriod;
  monthStart: Date;
  filters: LeaderboardFilters;
  sortState: PlayerLeaderboardSortState;
}) {
  const { DesktopTableWorkbenchControls } = await import("@/components/app/desktop-workbench");
  const rankByUserId = new Map(players.map((player, index) => [player.userId, index + 1]));
  const tablePlayers = sortPlayerLeaderboard(players, sortState);
  const title = activeTab === "public" ? "Global leaderboard" : "Friends leaderboard";
  const resultLabel = period === "monthly" ? "Monthly XP" : "Total XP";

  return (
    <section className="grid gap-4">
      <DataPanel id="full-leaderboard" className="overflow-hidden">
        <SectionHeader
          title={title}
          description={`${resultLabel} standings for opted-in golfers. Rank movement appears only when a prior ranking snapshot exists.`}
          action={
            <div className="text-right">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Period
              </p>
              <p className="mt-1 text-sm font-semibold">
                {period === "monthly" ? formatMonth(monthStart) : "All time"}
              </p>
            </div>
          }
        />
        <CardContent>
          <DesktopTableWorkbenchControls
            viewKey={`leaderboard-${activeTab}`}
            scope="leaderboard"
            currentViewLabel={leaderboardViewLabel(activeTab, period)}
            resultLabel={`${integerFormatter.format(players.length)} golfers`}
            columns={leaderboardPlayerColumns}
            suggestedViews={leaderboardSuggestedViews}
            exportTableId="leaderboard-players"
            exportFileName="forekinghell-leaderboard-players-view.csv"
            className="mb-3"
          />
          <DataTableFrame
            mainTable
            mainTableId="leaderboard-player-main-table"
            mainTableLabel="Leaderboard player table"
            stickyFirstColumn
          >
            <Table
              className="min-w-[760px]"
              data-workbench-scope="leaderboard"
              data-workbench-export-table="leaderboard-players"
              aria-describedby="leaderboard-player-table-summary"
            >
              <TableCaption id="leaderboard-player-table-summary" className="sr-only">
                Ranked golfers with result, verified rank movement where available, round and
                session counts, and proof status.
              </TableCaption>
              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-muted">
                <TableRow>
                  <SortablePlayerHead
                    activeTab={activeTab}
                    period={period}
                    columnId="rank"
                    filters={filters}
                    metric="rank"
                    sortState={sortState}
                    className="sticky left-0 z-20 bg-muted shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
                  />
                  <SortablePlayerHead
                    activeTab={activeTab}
                    period={period}
                    columnId="player"
                    filters={filters}
                    metric="player"
                    sortState={sortState}
                  />
                  <SortablePlayerHead
                    activeTab={activeTab}
                    period={period}
                    align="right"
                    columnId="result"
                    filters={filters}
                    metric={period === "monthly" ? "monthly-xp" : "total-xp"}
                    sortState={sortState}
                  />
                  <TableHead data-column="movement" className="text-right">
                    Movement
                  </TableHead>
                  <TableHead data-column="rounds-sessions" className="text-right">
                    Rounds / sessions
                  </TableHead>
                  <SortablePlayerHead
                    activeTab={activeTab}
                    period={period}
                    align="right"
                    columnId="proof"
                    filters={filters}
                    metric="source"
                    sortState={sortState}
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tablePlayers.map((player) => {
                  const rank = rankByUserId.get(player.userId) ?? 0;
                  const movement = rankMovementForPlayer(player);

                  return (
                    <TableRow
                      key={player.userId}
                      tabIndex={0}
                      data-current-user={player.isCurrentUser ? "true" : undefined}
                      data-top-three={rank <= 3 ? String(rank) : undefined}
                      className={leaderboardRowClassName(rank, player.isCurrentUser)}
                    >
                      <TableCell
                        data-column="rank"
                        className="sticky left-0 z-10 bg-inherit py-4 shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
                      >
                        <span className={rankNumberClassName(rank)}>{rank > 0 ? rank : "--"}</span>
                      </TableCell>
                      <TableCell data-column="player">
                        <div className="flex items-center gap-3">
                          <span
                            aria-hidden
                            className="grid size-9 shrink-0 place-items-center rounded-full border bg-card text-xs font-semibold"
                          >
                            {golferInitials(player.displayName)}
                          </span>
                          <div className="min-w-0">
                            <Link
                              href={`/profile/${player.username}`}
                              prefetch={false}
                              className="block truncate font-semibold hover:underline"
                            >
                              {player.displayName}
                            </Link>
                            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{player.relationship}</span>
                              {player.isCurrentUser ? (
                                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                                  You
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell data-column="result" className="text-right">
                        <span className="text-lg font-semibold tabular-nums">
                          {integerFormatter.format(scoreForPeriod(player, period))}
                        </span>
                        <span className="ml-1 text-xs text-muted-foreground">XP</span>
                      </TableCell>
                      <TableCell data-column="movement" className="text-right">
                        {movement ? (
                          <span className="font-medium tabular-nums">{movement}</span>
                        ) : (
                          <span className="text-muted-foreground" title="No prior rank snapshot">
                            —<span className="sr-only"> No ranking history</span>
                          </span>
                        )}
                      </TableCell>
                      <TableCell data-column="rounds-sessions" className="text-right tabular-nums">
                        <span className="font-medium">{player.monthlyRounds}</span>
                        <span className="px-1 text-muted-foreground">/</span>
                        <span>{player.monthlySessions}</span>
                      </TableCell>
                      <TableCell data-column="proof" className="text-right">
                        <Badge variant={proofBadgeVariant(player.verificationLabel)}>
                          {player.verificationLabel}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {tablePlayers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-4">
                      <AppEmptyState
                        title="No ranked entries yet"
                        description="No opted-in players match this audience and evidence filter."
                        primaryAction={
                          <Button asChild variant="outline">
                            <Link href="/profile" prefetch={false}>
                              Review leaderboard privacy
                            </Link>
                          </Button>
                        }
                      />
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

function SortablePlayerHead({
  activeTab,
  period,
  align = "left",
  className,
  columnId,
  filters,
  metric,
  sortState,
}: {
  activeTab: LeaderboardTab;
  period: LeaderboardPeriod;
  align?: "left" | "right";
  className?: string;
  columnId: string;
  filters: LeaderboardFilters;
  metric: PlayerLeaderboardSortMetric;
  sortState: PlayerLeaderboardSortState;
}) {
  const active = sortState.metric === metric;

  return (
    <TableHead
      data-column={columnId}
      className={sortableHeadClassName(align, className)}
      aria-sort={active ? sortAriaValue(sortState.dir) : "none"}
    >
      <SortablePlayerHeadLink
        activeTab={activeTab}
        period={period}
        align={align}
        filters={filters}
        metric={metric}
        sortState={sortState}
      />
    </TableHead>
  );
}

function SortablePlayerHeadLink({
  activeTab,
  period,
  align = "left",
  filters,
  metric,
  sortState,
}: {
  activeTab: LeaderboardTab;
  period: LeaderboardPeriod;
  align?: "left" | "right";
  filters: LeaderboardFilters;
  metric: PlayerLeaderboardSortMetric;
  sortState: PlayerLeaderboardSortState;
}) {
  const active = sortState.metric === metric;
  const nextDir: LeaderboardSortDirection = active
    ? sortState.dir === "desc"
      ? "asc"
      : "desc"
    : playerSortDefaultDirections[metric];
  const Icon = active ? (sortState.dir === "desc" ? ArrowDown : ArrowUp) : ArrowUpDown;
  const label = playerSortLabels[metric];

  return (
    <Link
      href={leaderboardTableSortHref({
        activeTab,
        dir: nextDir,
        filters,
        metric,
        period,
      })}
      prefetch={false}
      className={`focus-aaa inline-flex w-full items-center gap-1 rounded-md text-xs font-semibold text-muted-foreground outline-none transition-colors hover:text-foreground ${
        align === "right" ? "justify-end" : "justify-start"
      }`}
      aria-label={`Sort leaderboard players by ${label}, ${playerSortDirectionCopy(metric, nextDir)}`}
    >
      {label}
      <Icon className={`size-3.5 ${active ? "text-primary" : "opacity-45"}`} aria-hidden />
    </Link>
  );
}

function SortableChallengeHead({
  align = "left",
  className,
  columnId,
  metric,
  sortState,
}: {
  align?: "left" | "right";
  className?: string;
  columnId: string;
  metric: ChallengeLeaderboardSortMetric;
  sortState: ChallengeLeaderboardSortState;
}) {
  const active = sortState.metric === metric;

  return (
    <TableHead
      data-column={columnId}
      className={sortableHeadClassName(align, className)}
      aria-sort={active ? sortAriaValue(sortState.dir) : "none"}
    >
      <SortableChallengeHeadLink align={align} metric={metric} sortState={sortState} />
    </TableHead>
  );
}

function SortableChallengeHeadLink({
  align = "left",
  metric,
  sortState,
}: {
  align?: "left" | "right";
  metric: ChallengeLeaderboardSortMetric;
  sortState: ChallengeLeaderboardSortState;
}) {
  const active = sortState.metric === metric;
  const nextDir: LeaderboardSortDirection = active
    ? sortState.dir === "desc"
      ? "asc"
      : "desc"
    : challengeSortDefaultDirections[metric];
  const Icon = active ? (sortState.dir === "desc" ? ArrowDown : ArrowUp) : ArrowUpDown;
  const label = challengeSortLabels[metric];

  return (
    <Link
      href={leaderboardTableSortHref({
        activeTab: "challenges",
        dir: nextDir,
        metric,
      })}
      prefetch={false}
      className={`focus-aaa inline-flex w-full items-center gap-1 rounded-md text-xs font-semibold text-muted-foreground outline-none transition-colors hover:text-foreground ${
        align === "right" ? "justify-end" : "justify-start"
      }`}
      aria-label={`Sort challenge leaderboards by ${label}, ${challengeSortDirectionCopy(metric, nextDir)}`}
    >
      {label}
      <Icon className={`size-3.5 ${active ? "text-primary" : "opacity-45"}`} aria-hidden />
    </Link>
  );
}

function leaderboardTableSortHref({
  activeTab,
  dir,
  filters,
  metric,
  period,
}: {
  activeTab: LeaderboardTab;
  dir: LeaderboardSortDirection;
  filters?: LeaderboardFilters;
  metric: PlayerLeaderboardSortMetric | ChallengeLeaderboardSortMetric;
  period?: LeaderboardPeriod;
}) {
  const params = new URLSearchParams();
  params.set("tab", activeTab);

  if (period === "monthly") {
    params.set("period", period);
  }

  if (filters?.provider && filters.provider !== "all") {
    params.set("provider", filters.provider);
  }

  if (filters?.verification && filters.verification !== "all") {
    params.set("verification", filters.verification);
  }

  params.set("sort", metric);
  params.set("dir", dir);

  return `/leaderboard?${params.toString()}`;
}

function sortPlayerLeaderboard(players: PlayerRow[], sortState: PlayerLeaderboardSortState) {
  const rankByUserId = new Map(players.map((player, index) => [player.userId, index + 1]));

  return [...players].sort((left, right) => {
    const result = comparePlayerLeaderboardValues(left, right, sortState, rankByUserId);

    if (result !== 0) {
      return result;
    }

    return compareLeaderboardNumbers(
      rankByUserId.get(left.userId) ?? 0,
      rankByUserId.get(right.userId) ?? 0,
      "asc",
    );
  });
}

function comparePlayerLeaderboardValues(
  left: PlayerRow,
  right: PlayerRow,
  sortState: PlayerLeaderboardSortState,
  rankByUserId: Map<string, number>,
) {
  switch (sortState.metric) {
    case "rank":
      return compareLeaderboardNumbers(
        rankByUserId.get(left.userId) ?? 0,
        rankByUserId.get(right.userId) ?? 0,
        sortState.dir,
      );
    case "player":
      return compareLeaderboardStrings(left.displayName, right.displayName, sortState.dir);
    case "total-xp":
      return compareLeaderboardNumbers(left.totalXp, right.totalXp, sortState.dir);
    case "monthly-xp":
      return compareLeaderboardNumbers(left.monthlyXp, right.monthlyXp, sortState.dir);
    case "monthly-shots":
      return compareLeaderboardNumbers(left.monthlyShots, right.monthlyShots, sortState.dir);
    case "best-round":
      return compareNullableLeaderboardNumbers(
        left.bestRoundScore,
        right.bestRoundScore,
        sortState.dir,
      );
    case "longest-drive":
      return compareNullableLeaderboardNumbers(
        left.longestDriveYd,
        right.longestDriveYd,
        sortState.dir,
      );
    case "source":
      return compareLeaderboardStrings(
        left.verificationLabel,
        right.verificationLabel,
        sortState.dir,
      );
  }
}

type ChallengeLeaderboardBoard = Awaited<
  ReturnType<typeof getLeaderboardData>
>["challengeBoards"][number];

function sortChallengeLeaderboardBoards(
  boards: ChallengeLeaderboardBoard[],
  sortState: ChallengeLeaderboardSortState,
) {
  return [...boards].sort((left, right) => {
    const result = compareChallengeLeaderboardValues(left, right, sortState);

    if (result !== 0) {
      return result;
    }

    return compareLeaderboardStrings(left.title, right.title, "asc");
  });
}

function compareChallengeLeaderboardValues(
  left: ChallengeLeaderboardBoard,
  right: ChallengeLeaderboardBoard,
  sortState: ChallengeLeaderboardSortState,
) {
  switch (sortState.metric) {
    case "challenge":
      return compareLeaderboardStrings(left.title, right.title, sortState.dir);
    case "template":
      return compareLeaderboardStrings(left.templateName, right.templateName, sortState.dir);
    case "participants":
      return compareLeaderboardNumbers(
        left.participantCount,
        right.participantCount,
        sortState.dir,
      );
    case "leader":
      return compareLeaderboardStrings(
        left.leader?.displayName ?? null,
        right.leader?.displayName ?? null,
        sortState.dir,
      );
    case "score":
      return compareNullableLeaderboardNumbers(
        challengeScoreValue(left),
        challengeScoreValue(right),
        sortState.dir,
      );
    case "source":
      return compareLeaderboardStrings(
        left.leader?.verificationLabel ?? null,
        right.leader?.verificationLabel ?? null,
        sortState.dir,
      );
  }
}

function challengeScoreValue(board: ChallengeLeaderboardBoard) {
  const match = board.leader?.scoreLabel.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function compareLeaderboardNumbers(left: number, right: number, dir: LeaderboardSortDirection) {
  return dir === "asc" ? left - right : right - left;
}

function compareNullableLeaderboardNumbers(
  left: number | null,
  right: number | null,
  dir: LeaderboardSortDirection,
) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return compareLeaderboardNumbers(left, right, dir);
}

function compareLeaderboardStrings(
  left: string | null,
  right: string | null,
  dir: LeaderboardSortDirection,
) {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;

  const result = left.localeCompare(right);
  return dir === "asc" ? result : -result;
}

function sortableHeadClassName(align: "left" | "right", className?: string) {
  return (
    [className, align === "right" ? "text-right" : null].filter(Boolean).join(" ") || undefined
  );
}

function sortAriaValue(dir: LeaderboardSortDirection) {
  return dir === "desc" ? "descending" : "ascending";
}

function playerSortDirectionCopy(
  metric: PlayerLeaderboardSortMetric,
  dir: LeaderboardSortDirection,
) {
  if (metric === "rank") {
    return dir === "asc" ? "top rank first" : "bottom rank first";
  }

  if (metric === "player" || metric === "source") {
    return dir === "asc" ? "A to Z" : "Z to A";
  }

  if (metric === "best-round") {
    return dir === "asc" ? "lowest score first" : "highest score first";
  }

  return dir === "desc" ? "high to low" : "low to high";
}

function challengeSortDirectionCopy(
  metric: ChallengeLeaderboardSortMetric,
  dir: LeaderboardSortDirection,
) {
  if (
    metric === "challenge" ||
    metric === "template" ||
    metric === "leader" ||
    metric === "source"
  ) {
    return dir === "asc" ? "A to Z" : "Z to A";
  }

  return dir === "desc" ? "high to low" : "low to high";
}

function isPlayerLeaderboardTab(activeTab: LeaderboardTab) {
  return activeTab === "friends" || activeTab === "monthly" || activeTab === "public";
}

function LeaderboardCompetitionHeader({
  activeTab,
  period,
  monthStart,
  playerCount,
}: {
  activeTab: LeaderboardTab;
  period: LeaderboardPeriod;
  monthStart: Date;
  playerCount: number;
}) {
  const scopeLabel = leaderboardScopeLabel(activeTab);

  return (
    <section className="relative overflow-hidden rounded-2xl border bg-card px-5 py-6 sm:px-7 sm:py-8">
      <div className="absolute inset-y-0 left-0 w-1 bg-primary" aria-hidden />
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            <Trophy className="size-4 text-primary" aria-hidden />
            Competition board
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Leaderboards</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Ranked golf results with visible participation and proof. Movement is shown only when
            ranking history exists.
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-5 border-l pl-5 text-right">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Period
            </dt>
            <dd className="mt-1 text-sm font-semibold">
              {period === "monthly" ? formatMonth(monthStart) : "All time"}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Scope
            </dt>
            <dd className="mt-1 text-sm font-semibold">{scopeLabel}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Field
            </dt>
            <dd className="mt-1 text-sm font-semibold">{playerCount}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

function MobileCompetitionLeaderboard({
  players,
  period,
}: {
  players: PlayerRow[];
  period: LeaderboardPeriod;
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card" aria-label="Player leaderboard">
      <div className="grid grid-cols-[2rem_minmax(0,1fr)_auto_2.25rem] gap-2 border-b bg-muted px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <span>Rank</span>
        <span>Golfer</span>
        <span className="text-right">Score</span>
        <span className="text-right">Move</span>
      </div>
      <div className="divide-y">
        {players.length > 0 ? (
          players.map((player, index) => {
            const rank = index + 1;
            const movement = rankMovementForPlayer(player);

            return (
              <div
                key={player.userId}
                className={`grid grid-cols-[2rem_minmax(0,1fr)_auto_2.25rem] items-center gap-2 px-3 py-3 ${leaderboardRowClassName(rank, player.isCurrentUser)}`}
              >
                <span className={rankNumberClassName(rank)}>{rank}</span>
                <div className="min-w-0">
                  <Link
                    href={player.isCurrentUser ? "/profile" : `/profile/${player.username}`}
                    prefetch={false}
                    className="block truncate text-sm font-semibold hover:underline"
                  >
                    {player.displayName}
                  </Link>
                  {player.isCurrentUser ? (
                    <span className="text-[11px] font-medium text-primary">You</span>
                  ) : null}
                </div>
                <span className="text-right text-sm font-semibold tabular-nums">
                  {integerFormatter.format(scoreForPeriod(player, period))}
                </span>
                <span
                  className="text-right text-xs text-muted-foreground tabular-nums"
                  title={movement ? undefined : "No prior rank snapshot"}
                >
                  {movement ?? "—"}
                </span>
              </div>
            );
          })
        ) : (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No opted-in golfers match this scope.
          </div>
        )}
      </div>
    </section>
  );
}

function MobileBoardLeaderboard({
  label,
  items,
}: {
  label: string;
  items: Array<{
    id: string;
    name: string;
    href?: string;
    score: string | number;
    detail: string;
  }>;
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card" aria-label={label}>
      <div className="grid grid-cols-[2rem_minmax(0,1fr)_auto_2.25rem] gap-2 border-b bg-muted px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <span>Rank</span>
        <span>Golfer</span>
        <span className="text-right">Score</span>
        <span className="text-right">Move</span>
      </div>
      <div className="divide-y">
        {items.length > 0 ? (
          items.map((item, index) => {
            const rank = index + 1;
            const name = item.href ? (
              <Link
                href={item.href}
                prefetch={false}
                className="block truncate text-sm font-semibold hover:underline"
              >
                {item.name}
              </Link>
            ) : (
              <span className="block truncate text-sm font-semibold">{item.name}</span>
            );

            return (
              <div
                key={item.id}
                className={`grid grid-cols-[2rem_minmax(0,1fr)_auto_2.25rem] items-center gap-2 px-3 py-3 ${leaderboardRowClassName(rank, false)}`}
              >
                <span className={rankNumberClassName(rank)}>{rank}</span>
                <div className="min-w-0">
                  {name}
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {item.detail}
                  </span>
                </div>
                <span className="text-right text-sm font-semibold tabular-nums">{item.score}</span>
                <span
                  className="text-right text-xs text-muted-foreground"
                  title="No prior rank snapshot"
                >
                  —
                </span>
              </div>
            );
          })
        ) : (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No visible results yet.
          </div>
        )}
      </div>
    </section>
  );
}

async function ChallengeBoards({
  boards,
  sortState,
}: {
  boards: Awaited<ReturnType<typeof getLeaderboardData>>["challengeBoards"];
  sortState: ChallengeLeaderboardSortState;
}) {
  const { DesktopTableWorkbenchControls } = await import("@/components/app/desktop-workbench");
  const sortedBoards = sortChallengeLeaderboardBoards(boards, sortState);

  return (
    <DataPanel>
      <SectionHeader
        title="Challenge leaderboards"
        description="Visible challenge boards with current leaders and verification labels."
        action={<Target className="size-5 text-primary" />}
      />
      <CardContent>
        <DesktopTableWorkbenchControls
          viewKey="leaderboard-challenges"
          scope="leaderboard"
          currentViewLabel="Challenge leaderboards"
          resultLabel={`${integerFormatter.format(boards.length)} boards`}
          columns={challengeLeaderboardColumns}
          suggestedViews={challengeLeaderboardSuggestedViews}
          exportTableId="leaderboard-challenges"
          exportFileName="forekinghell-challenge-leaderboards-view.csv"
          className="mb-3"
        />
        <DataTableFrame
          mainTable
          mainTableId="challenge-leaderboard-main-table"
          mainTableLabel="Challenge leaderboard table"
          stickyFirstColumn
        >
          <Table
            className="min-w-[840px]"
            data-workbench-scope="leaderboard"
            data-workbench-export-table="leaderboard-challenges"
            aria-describedby="challenge-leaderboard-table-summary"
          >
            <TableCaption id="challenge-leaderboard-table-summary" className="sr-only">
              Challenge leaderboard boards with template, participant count, leader, score and
              verification source.
            </TableCaption>
            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-muted">
              <TableRow>
                <SortableChallengeHead
                  columnId="challenge"
                  metric="challenge"
                  sortState={sortState}
                  className="sticky left-0 z-20 bg-muted shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
                />
                <SortableChallengeHead
                  columnId="template"
                  metric="template"
                  sortState={sortState}
                />
                <SortableChallengeHead
                  align="right"
                  columnId="participants"
                  metric="participants"
                  sortState={sortState}
                />
                <SortableChallengeHead
                  align="right"
                  columnId="leader"
                  metric="leader"
                  sortState={sortState}
                />
                <SortableChallengeHead
                  align="right"
                  columnId="score"
                  metric="score"
                  sortState={sortState}
                />
                <SortableChallengeHead
                  align="right"
                  columnId="source"
                  metric="source"
                  sortState={sortState}
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedBoards.map((board) => (
                <TableRow key={board.id} tabIndex={0} className="focus-aaa outline-none">
                  <TableCell
                    data-column="challenge"
                    className="sticky left-0 z-10 bg-card shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
                  >
                    <Link
                      href={`/challenges/${board.id}`}
                      prefetch={false}
                      className="font-medium hover:underline"
                    >
                      {board.title}
                    </Link>
                  </TableCell>
                  <TableCell data-column="template">{board.templateName}</TableCell>
                  <TableCell data-column="participants" className="text-right">
                    {board.participantCount}
                  </TableCell>
                  <TableCell data-column="leader" className="text-right">
                    {board.leader ? (
                      <Link
                        href={`/profile/${board.leader.username}`}
                        prefetch={false}
                        className="font-medium hover:underline"
                      >
                        {board.leader.displayName}
                      </Link>
                    ) : (
                      "--"
                    )}
                  </TableCell>
                  <TableCell data-column="score" className="text-right">
                    {board.leader?.scoreLabel ?? "--"}
                  </TableCell>
                  <TableCell data-column="source" className="text-right">
                    {board.leader?.verificationLabel ?? "--"}
                  </TableCell>
                </TableRow>
              ))}
              {sortedBoards.length === 0 ? (
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

function CourseChampionBoards({ boards }: { boards: CourseChampionBoard[] }) {
  return (
    <DataPanel>
      <SectionHeader
        title="Course champions"
        description="Course records ranked as one field, with scope, period and proof kept visible."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/course-records" prefetch={false}>
              Open records
            </Link>
          </Button>
        }
      />
      <CardContent>
        <DataTableFrame>
          <Table className="min-w-[760px]">
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Golfer</TableHead>
                <TableHead className="text-right">Result</TableHead>
                <TableHead className="text-right">Scope / period</TableHead>
                <TableHead className="text-right">Proof</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {boards.map((board, index) => {
                const rank = index + 1;

                return (
                  <TableRow key={board.id} className={leaderboardRowClassName(rank, false)}>
                    <TableCell>
                      <span className={rankNumberClassName(rank)}>{rank}</span>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/course-records/${board.id}`}
                        prefetch={false}
                        className="font-semibold hover:underline"
                      >
                        {board.courseName}
                      </Link>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {board.categoryName}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/profile/${board.champion.username}`}
                        prefetch={false}
                        className="font-medium hover:underline"
                      >
                        {board.champion.displayName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right text-lg font-semibold tabular-nums">
                      {board.scoreLabel}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {label(board.scope)} · {label(board.period)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={board.verificationTier === "gold" ? "default" : "outline"}>
                        {label(board.verificationTier)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {boards.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No course champions yet.
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

function TournamentBoards({ boards }: { boards: TournamentBoard[] }) {
  return (
    <DataPanel>
      <SectionHeader
        title="Tournament leaders"
        description="Event leaders presented as standings, with gross result and completed rounds."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/tournaments" prefetch={false}>
              Open events
            </Link>
          </Button>
        }
      />
      <CardContent>
        <DataTableFrame>
          <Table className="min-w-[680px]">
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Tournament</TableHead>
                <TableHead>Golfer</TableHead>
                <TableHead className="text-right">Result</TableHead>
                <TableHead className="text-right">Rounds</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {boards.map((board, index) => {
                const rank = index + 1;

                return (
                  <TableRow key={board.id} className={leaderboardRowClassName(rank, false)}>
                    <TableCell>
                      <span className={rankNumberClassName(rank)}>{rank}</span>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/tournaments/${board.id}`}
                        prefetch={false}
                        className="font-semibold hover:underline"
                      >
                        {board.title}
                      </Link>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {formatTournamentLabel(board.format)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/profile/${board.champion.username}`}
                        prefetch={false}
                        className="font-medium hover:underline"
                      >
                        {board.champion.displayName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right text-lg font-semibold tabular-nums">
                      {board.grossTotal}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">gross</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {board.roundsCompleted}
                    </TableCell>
                  </TableRow>
                );
              })}
              {boards.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No tournament standings yet.
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

function allowsLeaderboard(
  profile: {
    id: string;
    privacySettingsJson: unknown;
    leaderboardVisibility: string;
    publicProfile: boolean;
  },
  activeTab: LeaderboardTab,
) {
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

function isTourPlayerProfile(profile: {
  username?: string | null;
  visibilitySettingsJson?: unknown;
}) {
  const settings = profile.visibilitySettingsJson;

  return Boolean(
    (settings &&
      typeof settings === "object" &&
      ((settings as { tourPlayer?: unknown }).tourPlayer === true ||
        (settings as { profileKind?: unknown }).profileKind === "tour-player")) ||
    profile.username?.startsWith("tour-"),
  );
}

function sumXpByUser(rows: Array<{ userId: string; totalXp: number | string | null }>) {
  const totals = new Map<string, number>();

  for (const row of rows) {
    totals.set(row.userId, (totals.get(row.userId) ?? 0) + Number(row.totalXp ?? 0));
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

function scorecardTotal(scorecard: Array<{ score?: number | null }>) {
  const scores = scorecard
    .map((hole) => hole.score)
    .filter((score): score is number => typeof score === "number" && Number.isFinite(score));

  return scores.length > 0 ? scores.reduce((total, score) => total + score, 0) : null;
}

function scoreForPeriod(player: PlayerRow, period: LeaderboardPeriod) {
  return period === "monthly" ? player.monthlyXp : player.totalXp;
}

function leaderboardViewLabel(tab: LeaderboardTab, period: LeaderboardPeriod) {
  return `${period === "monthly" ? "Monthly" : "All-time"} ${tab === "public" ? "global" : "friends"} leaderboard`;
}

function rankMovementForPlayer(player: PlayerRow) {
  if (player.rankMovement === null) return null;
  if (player.rankMovement > 0) return `↑ ${player.rankMovement}`;
  if (player.rankMovement < 0) return `↓ ${Math.abs(player.rankMovement)}`;
  return "—";
}

function leaderboardRowClassName(rank: number, isCurrentUser: boolean) {
  if (isCurrentUser) {
    return "focus-aaa bg-primary/10 outline-none hover:bg-primary/15";
  }

  if (rank === 1) {
    return "focus-aaa bg-[var(--status-warning-surface)] outline-none hover:bg-[var(--status-warning-surface)]";
  }

  if (rank <= 3) {
    return "focus-aaa bg-muted/55 outline-none hover:bg-muted/75";
  }

  return "focus-aaa outline-none";
}

function rankNumberClassName(rank: number) {
  return rank <= 3
    ? "text-lg font-semibold tabular-nums text-foreground"
    : "text-sm font-medium tabular-nums text-muted-foreground";
}

function golferInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "G"
  );
}

function proofBadgeVariant(labelValue: string): "default" | "secondary" | "outline" {
  if (labelValue === "Unverified") return "outline";
  if (labelValue === "Manual") return "secondary";
  return "default";
}

function leaderboardScopeLabel(tab: LeaderboardTab) {
  switch (tab) {
    case "public":
      return "Global";
    case "courses":
      return "Course";
    case "challenges":
      return "Challenge";
    case "tournaments":
      return "Tournament";
    default:
      return "Friends";
  }
}

function verificationLabelForSource(source: string) {
  switch (source) {
    case "espn":
      return "ESPN";
    case "espn-pga":
      return "ESPN PGA";
    case "pga_tour":
      return "PGA Tour";
    case "rapsodo_cloud":
      return "Rapsodo Cloud";
    case "rapsodo":
      return "Rapsodo file";
    case "manual":
      return "Manual";
    default:
      return "Unverified";
  }
}

function effectiveLeaderboardSource(source: string, isTourPlayer: boolean) {
  if (!isTourPlayer) {
    return source;
  }

  if (source === "espn" || source === "espn-pga" || source === "pga_tour") {
    return source;
  }

  return "espn";
}

function formatMonth(value: Date) {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(value);
}

function parseTab(value: string | undefined): LeaderboardTab {
  return value === "monthly" ||
    value === "courses" ||
    value === "challenges" ||
    value === "tournaments" ||
    value === "public"
    ? value
    : "friends";
}

function parseLeaderboardPeriod(
  value: string | undefined,
  requestedTab: LeaderboardTab,
): LeaderboardPeriod {
  return value === "monthly" || requestedTab === "monthly" ? "monthly" : "all-time";
}

function parsePlayerLeaderboardSort(
  metricValue: string | undefined,
  dirValue: string | undefined,
): PlayerLeaderboardSortState {
  const metric = parsePlayerLeaderboardSortMetric(metricValue);

  return {
    metric,
    dir: parseLeaderboardSortDirection(dirValue, playerSortDefaultDirections[metric]),
  };
}

function parsePlayerLeaderboardSortMetric(value: string | undefined): PlayerLeaderboardSortMetric {
  if (
    value === "rank" ||
    value === "player" ||
    value === "total-xp" ||
    value === "monthly-xp" ||
    value === "monthly-shots" ||
    value === "best-round" ||
    value === "longest-drive" ||
    value === "source"
  ) {
    return value;
  }

  return "rank";
}

function parseChallengeLeaderboardSort(
  metricValue: string | undefined,
  dirValue: string | undefined,
): ChallengeLeaderboardSortState {
  const metric = parseChallengeLeaderboardSortMetric(metricValue);

  return {
    metric,
    dir: parseLeaderboardSortDirection(dirValue, challengeSortDefaultDirections[metric]),
  };
}

function parseChallengeLeaderboardSortMetric(
  value: string | undefined,
): ChallengeLeaderboardSortMetric {
  if (
    value === "challenge" ||
    value === "template" ||
    value === "participants" ||
    value === "leader" ||
    value === "score" ||
    value === "source"
  ) {
    return value;
  }

  return "challenge";
}

function parseLeaderboardSortDirection(
  value: string | undefined,
  fallback: LeaderboardSortDirection,
): LeaderboardSortDirection {
  return value === "asc" || value === "desc" ? value : fallback;
}

function parseLeaderboardFilters(
  params: Awaited<LeaderboardPageProps["searchParams"]>,
): LeaderboardFilters {
  return {
    provider:
      params?.provider === "espn" ||
      params?.provider === "rapsodo" ||
      params?.provider === "rapsodo_cloud" ||
      params?.provider === "manual"
        ? params.provider
        : "all",
    verification:
      params?.verification === "verified" || params?.verification === "manual"
        ? params.verification
        : "all",
  };
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function label(value: string) {
  if (value === "espn") {
    return "ESPN";
  }

  if (value === "espn-pga") {
    return "ESPN PGA";
  }

  if (value === "pga_tour") {
    return "PGA Tour";
  }

  return value
    .split("_")
    .map((part) => titleCase(part))
    .join(" ");
}

function formatTournamentLabel(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => titleCase(part))
    .join(" ");
}
