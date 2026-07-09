import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  Flag,
  Globe2,
  Medal,
  ShieldCheck,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import { and, desc, eq, gte, inArray, lt, or, sql } from "drizzle-orm";

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
import { DataFirstFlowPanel } from "@/components/product-polish";
import { LeaderboardClimbPanel } from "@/components/features/feature-panels";
import {
  BottomSheet,
  CompactLeaderboard,
  MobileAppShell,
  MobileRouteTabs,
  MobileStatusAction,
  MobileTabBar,
  MobileTopBar,
  NativeListSection,
} from "@/components/mobile-sports";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import {
  DesktopTableWorkbenchControls,
  DesktopWorkbenchLayout,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
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
import { getFeatureIdeasData } from "@/lib/feature-ideas";

export const dynamic = "force-dynamic";

type LeaderboardTab = "friends" | "monthly" | "courses" | "challenges" | "tournaments" | "public";

type LeaderboardPageProps = {
  searchParams?: Promise<{
    tab?: string;
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
  relationship: string;
  totalXp: number;
  monthlyXp: number;
  previousMonthlyXp: number;
  monthlyShots: number;
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
const numberFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

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
  { id: "player", label: "Player", locked: true },
  { id: "total-xp", label: "Total XP" },
  { id: "monthly-xp", label: "Monthly XP" },
  { id: "monthly-shots", label: "Monthly shots" },
  { id: "best-round", label: "Best round" },
  { id: "longest-drive", label: "Longest drive" },
  { id: "source", label: "Source" },
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
    href: "/leaderboard?tab=monthly",
    detail: "Rank by the current month with monthly shots and movement context.",
  },
  {
    title: "Verified leaderboard rows",
    href: "/leaderboard?tab=monthly&verification=verified",
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
  const activeTab = parseTab(params?.tab);
  const filters = parseLeaderboardFilters(params);
  const playerSort = parsePlayerLeaderboardSort(params?.sort, params?.dir);
  const challengeSort = parseChallengeLeaderboardSort(params?.sort, params?.dir);
  const [data, featureData] = await Promise.all([
    getLeaderboardData(activeTab, filters),
    getFeatureIdeasData(),
  ]);
  const leaderboardOrderSteps = [
    {
      title: "Your rank",
      detail: mobileYourRankLabel(data.players, activeTab),
      status: "ready" as const,
      href: "/profile",
    },
    {
      title: "Podium",
      detail: "Top three stay above the detailed table.",
      status: "ready" as const,
    },
    {
      title: "Top five",
      detail: "Show the board front page before filter controls.",
      status: "ready" as const,
    },
    {
      title: "Filters",
      detail: "Source and verification filters sit below the first readout.",
      status: "optional" as const,
    },
    {
      title: "Full table",
      detail: "The dense table stays below the fold on mobile.",
      href: "#full-leaderboard",
      status: "optional" as const,
    },
  ];

  return (
    <PageShell>
      <MobileAppShell>
        <MobileTopBar title="Leaderboards" />
        <MobileRouteTabs group="social" activeKey="leaderboard" />
        <MobileTabBar
          activeKey={activeTab}
          className="-mt-4"
          tabs={[
            { key: "friends", label: "Friends", href: "/leaderboard?tab=friends" },
            { key: "courses", label: "Courses", href: "/leaderboard?tab=courses" },
            { key: "challenges", label: "Challenges", href: "/leaderboard?tab=challenges" },
            { key: "tournaments", label: "Tournaments", href: "/leaderboard?tab=tournaments" },
            { key: "public", label: "Public", href: "/leaderboard?tab=public" },
          ]}
        />
        <MobileStatusAction
          label="Your rank"
          value={mobileYourRankLabel(data.players, activeTab)}
          detail="Best way to climb: Wedge Window or a verified course-record attempt."
          action={
            <BottomSheet
              label={
                <>
                  <Target className="size-4" /> Filters
                </>
              }
              title="Leaderboard filters"
              triggerClassName="bg-white text-[#050505] ring-1 ring-[#E5E7EB]"
            >
              <form className="grid gap-3" action="/leaderboard">
                <input type="hidden" name="tab" value={activeTab} />
                <input type="hidden" name="sort" value={playerSort.metric} />
                <input type="hidden" name="dir" value={playerSort.dir} />
                <label className="grid gap-1 text-sm font-medium">
                  Source
                  <select
                    name="provider"
                    defaultValue={filters.provider}
                    className="h-11 rounded-lg border bg-white px-3 text-sm"
                  >
                    <option value="all">All</option>
                    <option value="espn">ESPN</option>
                    <option value="rapsodo">Rapsodo file</option>
                    <option value="rapsodo_cloud">Rapsodo Cloud</option>
                    <option value="manual">Manual</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  Verification
                  <select
                    name="verification"
                    defaultValue={filters.verification}
                    className="h-11 rounded-lg border bg-white px-3 text-sm"
                  >
                    <option value="all">All</option>
                    <option value="verified">Verified only</option>
                    <option value="mixed">Mixed</option>
                    <option value="manual">Manual only</option>
                  </select>
                </label>
                <Button type="submit" className="rounded-full bg-[#0B7A3B] text-white">
                  Apply filters
                </Button>
              </form>
            </BottomSheet>
          }
        />
        <DataFirstFlowPanel
          title="Leaderboard order"
          description="Keep the mobile hierarchy predictable: your rank first, then the podium and the fuller table."
          steps={leaderboardOrderSteps}
          actionHref="/challenges"
          actionLabel="Ways to climb"
        />
        {activeTab === "courses" ? (
          <NativeListSection title="Course champions">
            <CompactLeaderboard
              current={
                data.courseChampionBoards[0]
                  ? `${data.courseChampionBoards[0].courseName} · ${data.courseChampionBoards[0].scoreLabel}`
                  : "No course champions yet"
              }
              items={data.courseChampionBoards.slice(0, 5).map((board, index) => ({
                rank: index + 1,
                name: board.champion.displayName,
                href: `/profile/${board.champion.username}`,
                value: board.scoreLabel,
                detail: board.courseName,
              }))}
              viewAllHref="/course-records"
            />
          </NativeListSection>
        ) : activeTab === "challenges" ? (
          <NativeListSection title="Challenge boards">
            <CompactLeaderboard
              current={data.challengeBoards[0]?.title ?? "No challenge results yet"}
              items={data.challengeBoards.slice(0, 5).map((board, index) => ({
                rank: index + 1,
                name: board.leader?.displayName ?? "Open",
                href: board.leader ? `/profile/${board.leader.username}` : undefined,
                value: board.leader?.scoreLabel ?? "--",
                detail: board.title,
              }))}
              viewAllHref="/challenges"
            />
          </NativeListSection>
        ) : activeTab === "tournaments" ? (
          <NativeListSection title="Tournament boards">
            <CompactLeaderboard
              current={data.tournamentBoards[0]?.title ?? "No tournament standings yet"}
              items={data.tournamentBoards.slice(0, 5).map((board, index) => ({
                rank: index + 1,
                name: board.champion.displayName,
                href: `/profile/${board.champion.username}`,
                value: board.grossTotal,
                detail: `${board.title} · ${board.roundsCompleted} rounds`,
              }))}
              viewAllHref="/tournaments"
            />
          </NativeListSection>
        ) : (
          <NativeListSection title="Podium">
            <CompactLeaderboard
              current={mobileCurrentUserSummary(data.players, activeTab)}
              items={data.players.slice(0, 5).map((player, index) => ({
                rank: index + 1,
                name: player.displayName,
                href: `/profile/${player.username}`,
                value: integerFormatter.format(scoreForTab(player, activeTab)),
                detail: activeTab === "monthly" ? "monthly XP" : player.relationship,
              }))}
              viewAllHref="#full-leaderboard"
            />
          </NativeListSection>
        )}
        <LeaderboardClimbPanel data={featureData} />
      </MobileAppShell>

      <DesktopWorkbenchLayout scope="leaderboard">
        <div className="hidden items-center justify-between gap-4 sm:flex">
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

        <div className="hidden sm:contents">
          <PageHeader
            eyebrow={<StatusPill tone="green">Leaderboard v2</StatusPill>}
            title="Leaderboards"
            description="Friends, monthly, challenge and public opt-in rankings. Coach/viewer/editor account sharing is not used for normal friend rankings."
            metrics={[
              {
                label: "Visible players",
                value: integerFormatter.format(data.players.length),
                detail: `${titleCase(activeTab)} scope`,
              },
              {
                label: "Friends",
                value: integerFormatter.format(data.friendCount),
                detail: "Accepted friendships only",
              },
              {
                label: "Monthly shots",
                value: integerFormatter.format(data.monthlyShotTotal),
                detail: formatMonth(data.monthStart),
              },
              {
                label: "Course champions",
                value: integerFormatter.format(data.courseChampionBoards.length),
                detail: "Verified record holders",
              },
            ]}
          />

          <MobileBentoSummary
            items={[
              {
                label: "Leader",
                value:
                  activeTab === "courses"
                    ? (data.courseChampionBoards[0]?.champion.displayName ?? "--")
                    : activeTab === "tournaments"
                      ? (data.tournamentBoards[0]?.champion.displayName ?? "--")
                      : (data.players[0]?.displayName ?? "--"),
                detail:
                  activeTab === "courses"
                    ? (data.courseChampionBoards[0]?.courseName ?? "No course champions yet.")
                    : activeTab === "tournaments"
                      ? (data.tournamentBoards[0]?.title ?? "No tournament leaders yet.")
                      : data.players[0]
                        ? `${integerFormatter.format(scoreForTab(data.players[0], activeTab))} ${activeTab === "monthly" ? "monthly XP" : "XP"}`
                        : "No visible players.",
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
                value: integerFormatter.format(
                  data.courseChampionBoards.length +
                    data.challengeBoards.length +
                    data.tournamentBoards.length,
                ),
                detail: "Records, challenges, events",
                tone: "slate",
              },
            ]}
          />

          <DataFirstFlowPanel
            title="Leaderboard order"
            description="Keep the first screen summary-led before filters and full tables."
            steps={leaderboardOrderSteps}
            actionHref="/challenges"
            actionLabel="Ways to climb"
          />

          <LeaderboardClimbPanel data={featureData} />

          <section className="hidden gap-4 sm:grid md:grid-cols-3">
            <MetricCard
              label="Monthly XP"
              value={data.monthlyLeader?.displayName ?? "--"}
              detail={
                data.monthlyLeader
                  ? `${integerFormatter.format(data.monthlyLeader.monthlyXp)} XP this month.`
                  : "No monthly XP yet."
              }
              icon={CalendarDays}
              tone="green"
            />
            <MetricCard
              label="Longest verified drive"
              value={data.longDriveLeader?.displayName ?? "--"}
              detail={
                data.longDriveLeader?.longestDriveYd
                  ? `${numberFormatter.format(data.longDriveLeader.longestDriveYd)} yd · ${data.longDriveLeader.verificationLabel}`
                  : "No driver shots yet."
              }
              icon={Medal}
              tone="amber"
            />
            <MetricCard
              label="Challenge leader"
              value={data.challengeBoards[0]?.leader?.displayName ?? "--"}
              detail={
                data.challengeBoards[0]?.leader
                  ? data.challengeBoards[0].title
                  : "No challenge results yet."
              }
              icon={Trophy}
              tone="sky"
            />
          </section>

          <div className="flex flex-wrap gap-2">
            <TabLink
              tab="friends"
              activeTab={activeTab}
              icon={<Users className="size-4" />}
              label="Friends"
            />
            <TabLink
              tab="monthly"
              activeTab={activeTab}
              icon={<CalendarDays className="size-4" />}
              label="Monthly"
            />
            <TabLink
              tab="courses"
              activeTab={activeTab}
              icon={<Medal className="size-4" />}
              label="Course Champions"
            />
            <TabLink
              tab="challenges"
              activeTab={activeTab}
              icon={<Trophy className="size-4" />}
              label="Challenges"
            />
            <TabLink
              tab="tournaments"
              activeTab={activeTab}
              icon={<Flag className="size-4" />}
              label="Tournaments"
            />
            <TabLink
              tab="public"
              activeTab={activeTab}
              icon={<Globe2 className="size-4" />}
              label="Public opt-in"
            />
          </div>

          {activeTab === "friends" || activeTab === "monthly" || activeTab === "public" ? (
            <section className="premium-card p-3">
              <form className="flex flex-wrap items-end gap-2" action="/leaderboard">
                <input type="hidden" name="tab" value={activeTab} />
                <label className="grid gap-1 text-xs font-medium">
                  <span>Source</span>
                  <select
                    name="provider"
                    defaultValue={filters.provider}
                    className="h-9 rounded-lg border bg-white px-2 text-sm"
                  >
                    <option value="all">All</option>
                    <option value="espn">ESPN</option>
                    <option value="rapsodo">Rapsodo file</option>
                    <option value="rapsodo_cloud">Rapsodo Cloud</option>
                    <option value="manual">Manual</option>
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-medium">
                  <span>Verification</span>
                  <select
                    name="verification"
                    defaultValue={filters.verification}
                    className="h-9 rounded-lg border bg-white px-2 text-sm"
                  >
                    <option value="all">All</option>
                    <option value="verified">Verified only</option>
                    <option value="mixed">Mixed</option>
                    <option value="manual">Manual only</option>
                  </select>
                </label>
                <input type="hidden" name="sort" value={playerSort.metric} />
                <input type="hidden" name="dir" value={playerSort.dir} />
                <Button type="submit" variant="outline" size="sm">
                  Apply filters
                </Button>
                <Badge variant="outline" className="px-3 py-1.5">
                  Scope: {titleCase(activeTab)}
                </Badge>
                <Badge variant="outline" className="px-3 py-1.5">
                  Month: {formatMonth(data.monthStart)}
                </Badge>
              </form>
            </section>
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
              monthStart={data.monthStart}
              filters={filters}
              sortState={playerSort}
            />
          )}
        </div>
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

type LeaderboardProvider = "all" | "espn" | "rapsodo" | "rapsodo_cloud" | "manual";

type LeaderboardFilters = {
  provider: LeaderboardProvider;
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
  const [xpRows, monthlyXpRows, previousMonthlyXpRows, rawShotRows, roundRows] =
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
              userId: xpLedger.userId,
              totalXp: sql<number>`coalesce(sum(${xpLedger.amount}), 0)::int`,
            })
            .from(xpLedger)
            .where(
              and(
                inArray(xpLedger.userId, visibleIds),
                gte(xpLedger.createdAt, previousMonthStart),
                lt(xpLedger.createdAt, monthStart),
              ),
            )
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
      : [[], [], [], [], []];
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
  const previousMonthlyXpByUser = sumXpByUser(previousMonthlyXpRows);
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
        displayName: profile.displayName ?? profile.name ?? profile.email ?? "LM World Tour player",
        username: profile.username,
        isCurrentUser: profile.id === userId,
        relationship:
          profile.id === userId ? "You" : friendIdSet.has(profile.id) ? "Friend" : "Public opt-in",
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
    friendCount: friendIds.length,
    monthlyShotTotal: players.reduce((total, player) => total + player.monthlyShots, 0),
    players,
    monthlyLeader: maxPlayer(players, (player) => player.monthlyXp),
    longDriveLeader: maxPlayer(players, (player) => player.longestDriveYd ?? 0),
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

function PlayerLeaderboard({
  players,
  activeTab,
  monthStart,
  filters,
  sortState,
}: {
  players: PlayerRow[];
  activeTab: LeaderboardTab;
  monthStart: Date;
  filters: LeaderboardFilters;
  sortState: PlayerLeaderboardSortState;
}) {
  const currentUserIndex = players.findIndex((player) => player.isCurrentUser);
  const currentUser = currentUserIndex >= 0 ? players[currentUserIndex] : null;
  const podium = players.slice(0, 3);
  const rankByUserId = new Map(players.map((player, index) => [player.userId, index + 1]));
  const tablePlayers = sortPlayerLeaderboard(players, sortState);

  return (
    <section className="grid gap-4">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <article className="premium-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Podium</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Top three in the active leaderboard scope.
              </p>
            </div>
            <Badge variant="outline">{formatMonth(monthStart)}</Badge>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {podium.length === 0 ? (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground md:col-span-3">
                No opted-in players yet.
              </p>
            ) : (
              podium.map((player, index) => (
                <LeaderboardPodiumCard
                  key={player.userId}
                  player={player}
                  rank={index + 1}
                  activeTab={activeTab}
                />
              ))
            )}
          </div>
        </article>

        <article className="premium-card p-4">
          <p className="text-sm font-semibold">Your rank</p>
          {currentUser ? (
            <div className="mt-3 rounded-lg bg-[#F5F6F4] p-4">
              <Badge variant="secondary">#{currentUserIndex + 1}</Badge>
              <p className="mt-3 text-2xl font-semibold tracking-normal">
                {integerFormatter.format(scoreForTab(currentUser, activeTab))} XP
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{movementLabel(currentUser)}</p>
              {currentUserIndex === 3 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Best route to climb: enter a challenge board with verified attempts.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              Enable leaderboard visibility in your profile.
            </p>
          )}
        </article>
      </section>

      <DataPanel id="full-leaderboard">
        <SectionHeader
          title={
            activeTab === "public"
              ? "Public opt-in leaderboard"
              : activeTab === "monthly"
                ? "Monthly leaderboard"
                : "Friend leaderboard"
          }
          description={`Ranks include opted-in players. Source filter: ${label(filters.provider)}. Verification filter: ${label(filters.verification)}.`}
          action={<Badge variant="outline">{formatMonth(monthStart)}</Badge>}
        />
        <CardContent>
          <DesktopTableWorkbenchControls
            viewKey={`leaderboard-${activeTab}`}
            scope="leaderboard"
            currentViewLabel={leaderboardViewLabel(activeTab)}
            resultLabel={`${integerFormatter.format(players.length)} players`}
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
              className="min-w-[920px]"
              data-workbench-scope="leaderboard"
              data-workbench-export-table="leaderboard-players"
              aria-describedby="leaderboard-player-table-summary"
            >
              <TableCaption id="leaderboard-player-table-summary" className="sr-only">
                Leaderboard rows with rank, player, total XP, monthly XP, monthly shots, best round,
                longest drive and source verification.
              </TableCaption>
              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
                <TableRow>
                  <SortablePlayerHead
                    activeTab={activeTab}
                    columnId="rank"
                    filters={filters}
                    metric="rank"
                    sortState={sortState}
                    className="sticky left-0 z-20 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                  />
                  <SortablePlayerHead
                    activeTab={activeTab}
                    columnId="player"
                    filters={filters}
                    metric="player"
                    sortState={sortState}
                  />
                  <SortablePlayerHead
                    activeTab={activeTab}
                    align="right"
                    columnId="total-xp"
                    filters={filters}
                    metric="total-xp"
                    sortState={sortState}
                  />
                  <SortablePlayerHead
                    activeTab={activeTab}
                    align="right"
                    columnId="monthly-xp"
                    filters={filters}
                    metric="monthly-xp"
                    sortState={sortState}
                  />
                  <SortablePlayerHead
                    activeTab={activeTab}
                    align="right"
                    columnId="monthly-shots"
                    filters={filters}
                    metric="monthly-shots"
                    sortState={sortState}
                  />
                  <SortablePlayerHead
                    activeTab={activeTab}
                    align="right"
                    columnId="best-round"
                    filters={filters}
                    metric="best-round"
                    sortState={sortState}
                  />
                  <SortablePlayerHead
                    activeTab={activeTab}
                    align="right"
                    columnId="longest-drive"
                    filters={filters}
                    metric="longest-drive"
                    sortState={sortState}
                  />
                  <SortablePlayerHead
                    activeTab={activeTab}
                    align="right"
                    columnId="source"
                    filters={filters}
                    metric="source"
                    sortState={sortState}
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tablePlayers.map((player) => {
                  const rank = rankByUserId.get(player.userId) ?? 0;

                  return (
                    <TableRow key={player.userId} tabIndex={0} className="focus-aaa outline-none">
                      <TableCell
                        data-column="rank"
                        className="sticky left-0 z-10 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                      >
                        <Badge variant={rank === 1 ? "default" : "outline"}>
                          {rank > 0 ? rank : "--"}
                        </Badge>
                      </TableCell>
                      <TableCell data-column="player">
                        <div>
                          <Link
                            href={`/profile/${player.username}`}
                            prefetch={false}
                            className="font-medium hover:underline"
                          >
                            {player.displayName}
                          </Link>
                          <p className="text-xs text-muted-foreground">{player.relationship}</p>
                        </div>
                      </TableCell>
                      <TableCell data-column="total-xp" className="text-right">
                        {integerFormatter.format(player.totalXp)}
                      </TableCell>
                      <TableCell data-column="monthly-xp" className="text-right">
                        {integerFormatter.format(player.monthlyXp)}
                      </TableCell>
                      <TableCell data-column="monthly-shots" className="text-right">
                        {integerFormatter.format(player.monthlyShots)}
                      </TableCell>
                      <TableCell data-column="best-round" className="text-right">
                        {player.bestRoundScore ?? "--"}
                      </TableCell>
                      <TableCell data-column="longest-drive" className="text-right">
                        {player.longestDriveYd
                          ? `${numberFormatter.format(player.longestDriveYd)} yd`
                          : "--"}
                      </TableCell>
                      <TableCell data-column="source" className="text-right">
                        {player.verificationLabel}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {tablePlayers.length === 0 ? (
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

function SortablePlayerHead({
  activeTab,
  align = "left",
  className,
  columnId,
  filters,
  metric,
  sortState,
}: {
  activeTab: LeaderboardTab;
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
  align = "left",
  filters,
  metric,
  sortState,
}: {
  activeTab: LeaderboardTab;
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
      })}
      prefetch={false}
      className={`focus-aaa inline-flex w-full items-center gap-1 rounded-md text-xs font-semibold text-muted-foreground outline-none transition-colors hover:text-foreground ${
        align === "right" ? "justify-end" : "justify-start"
      }`}
      aria-label={`Sort leaderboard players by ${label}, ${playerSortDirectionCopy(metric, nextDir)}`}
    >
      {label}
      <Icon className={`size-3.5 ${active ? "text-emerald-700" : "opacity-45"}`} aria-hidden />
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
      <Icon className={`size-3.5 ${active ? "text-emerald-700" : "opacity-45"}`} aria-hidden />
    </Link>
  );
}

function leaderboardTableSortHref({
  activeTab,
  dir,
  filters,
  metric,
}: {
  activeTab: LeaderboardTab;
  dir: LeaderboardSortDirection;
  filters?: LeaderboardFilters;
  metric: PlayerLeaderboardSortMetric | ChallengeLeaderboardSortMetric;
}) {
  const params = new URLSearchParams();
  params.set("tab", activeTab);

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

function mobileYourRankLabel(players: PlayerRow[], activeTab: LeaderboardTab) {
  const index = players.findIndex((player) => player.isCurrentUser);

  if (index < 0) {
    return "Hidden";
  }

  return `#${index + 1} this ${activeTab === "monthly" ? "month" : "board"}`;
}

function mobileCurrentUserSummary(players: PlayerRow[], activeTab: LeaderboardTab) {
  const index = players.findIndex((player) => player.isCurrentUser);
  const player = index >= 0 ? players[index] : null;

  if (!player) {
    return "Enable leaderboard visibility in You";
  }

  return `You are #${index + 1} · ${integerFormatter.format(scoreForTab(player, activeTab))} XP`;
}

function LeaderboardPodiumCard({
  player,
  rank,
  activeTab,
}: {
  player: PlayerRow;
  rank: number;
  activeTab: LeaderboardTab;
}) {
  return (
    <article
      className={
        rank === 1
          ? "rounded-lg border border-amber-200 bg-amber-50 p-4"
          : "rounded-lg border bg-[#F5F6F4] p-4"
      }
    >
      <Badge variant={rank === 1 ? "default" : "outline"}>#{rank}</Badge>
      <Link
        href={`/profile/${player.username}`}
        prefetch={false}
        className="mt-3 block text-lg font-semibold tracking-normal hover:underline"
      >
        {player.displayName}
      </Link>
      <p className="mt-1 text-2xl font-semibold tracking-normal">
        {integerFormatter.format(scoreForTab(player, activeTab))}
      </p>
      <p className="text-sm text-muted-foreground">
        {activeTab === "monthly" ? "monthly XP" : "total XP"}
      </p>
    </article>
  );
}

function ChallengeBoards({
  boards,
  sortState,
}: {
  boards: Awaited<ReturnType<typeof getLeaderboardData>>["challengeBoards"];
  sortState: ChallengeLeaderboardSortState;
}) {
  const sortedBoards = sortChallengeLeaderboardBoards(boards, sortState);

  return (
    <DataPanel>
      <SectionHeader
        title="Challenge leaderboards"
        description="Visible challenge boards with current leaders and verification labels."
        action={<Target className="size-5 text-emerald-600" />}
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
            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
              <TableRow>
                <SortableChallengeHead
                  columnId="challenge"
                  metric="challenge"
                  sortState={sortState}
                  className="sticky left-0 z-20 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
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
                    className="sticky left-0 z-10 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
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
  const champion = boards[0] ?? null;

  return (
    <section className="grid gap-4">
      <article className="premium-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Course Champions</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Verified and manual boards stay labelled by scope and proof tier.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/course-records" prefetch={false}>
              Open records
            </Link>
          </Button>
        </div>
        {champion ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <Badge>Current champion</Badge>
            <Link
              href={`/profile/${champion.champion.username}`}
              prefetch={false}
              className="mt-3 block text-2xl font-semibold tracking-normal hover:underline"
            >
              {champion.champion.displayName}
            </Link>
            <p className="mt-1 text-sm text-muted-foreground">
              {champion.courseName} · {champion.categoryName} · {champion.scoreLabel}
            </p>
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            No course champions yet.
          </p>
        )}
      </article>

      <div className="grid gap-3 md:grid-cols-2">
        {boards.map((board) => (
          <Link
            key={board.id}
            href={`/course-records/${board.id}`}
            prefetch={false}
            className="premium-card p-4 transition hover:border-emerald-300"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{board.courseName}</p>
                <p className="mt-1 text-sm text-muted-foreground">{board.categoryName}</p>
              </div>
              <Badge variant={board.verificationTier === "gold" ? "secondary" : "outline"}>
                {label(board.verificationTier)}
              </Badge>
            </div>
            <p className="mt-4 text-xl font-semibold tracking-normal">
              {board.champion.displayName}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {board.scoreLabel} · {label(board.scope)} · {label(board.period)}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function TournamentBoards({ boards }: { boards: TournamentBoard[] }) {
  const leader = boards[0] ?? null;

  return (
    <section className="grid gap-4">
      <article className="premium-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Tournament Leaders</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Major-style events rank gross first, with net totals as tiebreak context.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/tournaments" prefetch={false}>
              Open events
            </Link>
          </Button>
        </div>
        {leader ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <Badge>Event leader</Badge>
            <Link
              href={`/profile/${leader.champion.username}`}
              prefetch={false}
              className="mt-3 block text-2xl font-semibold tracking-normal hover:underline"
            >
              {leader.champion.displayName}
            </Link>
            <p className="mt-1 text-sm text-muted-foreground">
              {leader.title} · {leader.grossTotal} through {leader.roundsCompleted}
            </p>
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            No tournament standings yet.
          </p>
        )}
      </article>

      <div className="grid gap-3 md:grid-cols-2">
        {boards.map((board) => (
          <Link
            key={board.id}
            href={`/tournaments/${board.id}`}
            prefetch={false}
            className="premium-card p-4 transition hover:border-emerald-300"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{board.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatTournamentLabel(board.format)}
                </p>
              </div>
              <Badge variant="outline">{board.roundsCompleted} rounds</Badge>
            </div>
            <p className="mt-4 text-xl font-semibold tracking-normal">
              {board.champion.displayName}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{board.grossTotal} gross total</p>
          </Link>
        ))}
      </div>
    </section>
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

function leaderboardViewLabel(tab: LeaderboardTab) {
  if (tab === "monthly") {
    return "Monthly leaderboard";
  }

  if (tab === "public") {
    return "Public opt-in leaderboard";
  }

  return "Friend leaderboard";
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
      params?.verification === "verified" ||
      params?.verification === "mixed" ||
      params?.verification === "manual"
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
