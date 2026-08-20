import { and, asc, desc, eq, inArray } from "drizzle-orm";

import {
  clubs,
  sessions,
  shots,
  stockYardages,
  teeSets,
  tournamentStandings,
  tournamentSubmissions,
  tournaments,
  userProfiles,
} from "@/db/schema";
import { getDb } from "@/db/client";
import { clubSortValue, formatClubType, isTrackedClubType } from "@/lib/club-format";
import { requireCurrentUserId } from "@/lib/current-user";
import {
  calculateHandicapSummary,
  calculateRoundDifferential,
  handicapBandFromValue,
  normaliseHandicapRoundInput,
} from "@/lib/round-handicap";
import { isShotEvidenceEligible, type ShotReviewStatus } from "@/lib/shot-review";
import { selectStockYardageShots } from "@/lib/stock-yardage";
import { getBlockedUserIds, getFriendIds } from "@/lib/social";

export type CompareFocusMode =
  | "today"
  | "latest-session"
  | "session"
  | "last-7"
  | "last-30"
  | "custom";
export type CompareBaselineMode =
  | "before-focus"
  | "all-time"
  | "previous-session"
  | "previous-30"
  | "custom";
export type CompareConditionMode = "same" | "indoor-outdoor" | "practice-round";

export type CompareFilters = {
  focus: CompareFocusMode;
  baseline: CompareBaselineMode;
  sessionId: string;
  baselineSessionId: string;
  clubId: string;
  clubAId: string;
  clubBId: string;
  from: string;
  to: string;
  baselineFrom: string;
  baselineTo: string;
  condition: CompareConditionMode;
};

export type CompareSessionOption = {
  id: string;
  label: string;
  dateLabel: string;
  dateInput: string;
  type: string;
  shotCount: number;
};

export type CompareClubOption = {
  id: string;
  type: string;
  label: string;
  shotCount: number;
};

export type CompareShot = {
  id: string;
  sessionId: string;
  sessionDate: Date;
  sessionCreatedAt: Date;
  sessionType: string;
  playContext?: string;
  sessionLabel: string;
  clubId: string;
  clubType: string;
  shotAt: Date;
  shotNumber: number | null;
  carryYd: number | null;
  totalYd: number | null;
  sideCarryYd: number | null;
  ballSpeedMph: number | null;
  clubSpeedMph: number | null;
  launchAngleDeg: number | null;
  launchDirectionDeg: number | null;
  apexFt: number | null;
  attackAngleDeg: number | null;
  clubPathDeg: number | null;
  descentAngleDeg: number | null;
  smashFactor: number | null;
  spinRate: number | null;
  spinAxis: number | null;
  shotCategory: string | null;
  qualityTag: string | null;
  reviewStatus?: ShotReviewStatus | null;
  clubDataEstType: string | null;
  courseHoleNumber: number | null;
};

export type CompareSampleSummary = {
  label: string;
  detail: string;
  rawShots: number;
  stockShots: number;
  sessions: number;
  clubs: number;
  carryMedianYd: number | null;
  carryAverageYd: number | null;
  totalMedianYd: number | null;
  ballSpeedAverageMph: number | null;
  launchAverageDeg: number | null;
  absoluteOfflineAverageYd: number | null;
  shotConeWidthYd: number | null;
  playableRate: number | null;
  bigMissRate: number | null;
  leftMissRate: number | null;
  rightMissRate: number | null;
  primaryMiss: "Left" | "Right" | "Balanced" | "Unknown";
  dispersion: DispersionPoint[];
  sessionBreakdown: Array<{
    id: string;
    label: string;
    dateLabel: string;
    shotCount: number;
  }>;
};

export type CompareDelta = {
  carryDeltaYd: number | null;
  ballSpeedDeltaMph: number | null;
  launchDeltaDeg: number | null;
  offlineDeltaYd: number | null;
  coneDeltaYd: number | null;
  playableRateDelta: number | null;
  bigMissRateDelta: number | null;
};

export type CompareClubRow = {
  clubId: string;
  clubType: string;
  label: string;
  focus: CompareSampleSummary;
  baseline: CompareSampleSummary;
  delta: CompareDelta;
  benefitScore: number;
};

export type CompareData = {
  filters: CompareFilters;
  sessions: CompareSessionOption[];
  clubs: CompareClubOption[];
  focus: CompareSampleSummary;
  baseline: CompareSampleSummary;
  delta: CompareDelta;
  benefit: {
    score: number;
    verdict: "Beneficial" | "Useful" | "Mixed" | "Review";
    summary: string;
    positives: string[];
    warnings: string[];
  };
  clubRows: CompareClubRow[];
  clubComparison: {
    first: CompareClubRow | null;
    second: CompareClubRow | null;
  };
};

export type ClubCompareFilters = {
  clubAId: string;
  clubBId: string;
};

export type ClubCompareClubOption = CompareClubOption & {
  active: boolean;
};

export type ClubCompareSide = CompareSampleSummary & {
  clubId: string;
  clubType: string;
  active: boolean;
  dateRange: string;
};

export type ProgressPeriodMode = "week" | "month";

export type ProgressBaselineMode = "previous-week" | "previous-month";

export type ProgressComparison = {
  mode: ProgressBaselineMode;
  label: string;
  detail: string;
  focus: CompareSampleSummary;
  baseline: CompareSampleSummary;
  delta: CompareDelta;
  benefit: CompareData["benefit"];
  clubRows: CompareClubRow[];
};

export type ProgressPeriod = {
  key: string;
  mode: ProgressPeriodMode;
  label: string;
  detail: string;
  summary: CompareSampleSummary;
  deltaFromPrevious: CompareDelta;
  benefit: CompareData["benefit"];
};

export type ProgressCompareData = {
  latestSession: CompareSessionOption | null;
  previousWeek: ProgressComparison;
  previousMonth: ProgressComparison;
  weeklyPeriods: ProgressPeriod[];
  monthlyPeriods: ProgressPeriod[];
};

export type ClubCompareData = {
  filters: ClubCompareFilters;
  clubs: ClubCompareClubOption[];
  clubSides: ClubCompareSide[];
  clubA: ClubCompareSide | null;
  clubB: ClubCompareSide | null;
  delta: CompareDelta;
  progress: ProgressCompareData;
};

export type PlayerCompareFilters = {
  playerAId: string;
  playerBId: string;
};

export type PlayerCompareOption = {
  userId: string;
  username: string;
  displayName: string;
  label: string;
  handicapBand: string | null;
  handicapEstimate: number | null;
  worldRank: number | null;
};

export type PlayerTournamentScore = {
  tournamentTitle: string;
  roundNumber: number;
  grossScore: number;
  netScore: number | null;
  submittedAt: Date;
};

export type PlayerCompareSide = CompareSampleSummary & {
  userId: string;
  username: string;
  displayName: string;
  handicapBand: string | null;
  homeCourse: string | null;
  launchMonitor: string | null;
  worldRank: number | null;
  handicapEstimate: number | null;
  rounds: number;
  bestScore: number | null;
  scoringAverage: number | null;
  latestScore: number | null;
  driverCarryYd: number | null;
  sevenIronCarryYd: number | null;
  tournamentRank: number | null;
  tournamentGrossTotal: number | null;
  tournamentNetTotal: number | null;
  tournamentRoundsCompleted: number | null;
  recentTournamentScores: PlayerTournamentScore[];
};

export type PlayerCompareDelta = {
  handicapEstimateDelta: number | null;
  bestScoreDelta: number | null;
  scoringAverageDelta: number | null;
  latestScoreDelta: number | null;
  driverCarryDeltaYd: number | null;
  sevenIronCarryDeltaYd: number | null;
  offlineDeltaYd: number | null;
  playableRateDelta: number | null;
  tournamentGrossDelta: number | null;
};

export type PlayerCompareData = {
  filters: PlayerCompareFilters;
  players: PlayerCompareOption[];
  playerSides: PlayerCompareSide[];
  playerA: PlayerCompareSide | null;
  playerB: PlayerCompareSide | null;
  delta: PlayerCompareDelta;
};

export type DispersionPoint = {
  id: string;
  clubType: string;
  carryYd: number;
  sideCarryYd: number;
  label: string;
};

type Selection = {
  label: string;
  detail: string;
  shots: CompareShot[];
  start: Date | null;
  end: Date | null;
};

type PlayerProfileRow = typeof userProfiles.$inferSelect;
type PlayerSessionRow = {
  id: string;
  userId: string;
  type: string;
  date: Date;
  courseName: string | null;
  location: string | null;
  fileName: string | null;
  scorecardJson: Array<{
    score?: number | null;
    netScore?: number | null;
    par?: number | null;
  }> | null;
  courseRating: number | null;
  slopeRating: number | null;
};
type PlayerStockRow = {
  userId: string;
  clubType: string;
  calculatedAt: Date;
  carryMedianYd: number | null;
  totalMedianYd: number | null;
};
type PlayerTournamentStandingRow = {
  userId: string;
  rank: number | null;
  grossTotal: number;
  netTotal: number | null;
  roundsCompleted: number;
  calculatedAt: Date;
  tournamentTitle: string;
};
type PlayerTournamentSubmissionRow = PlayerTournamentScore & {
  userId: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const monthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "numeric",
});

export async function getCompareData(filters: CompareFilters): Promise<CompareData> {
  const db = getDb();
  const userId = await requireCurrentUserId();

  const [clubRows, shotRows] = await Promise.all([
    db
      .select({
        id: clubs.id,
        type: clubs.type,
        brand: clubs.brand,
        model: clubs.model,
      })
      .from(clubs)
      .where(eq(clubs.userId, userId))
      .orderBy(asc(clubs.type), asc(clubs.brand), asc(clubs.model)),
    db
      .select({
        id: shots.id,
        sessionId: shots.sessionId,
        sessionDate: sessions.date,
        sessionCreatedAt: sessions.createdAt,
        sessionType: sessions.type,
        playContext: sessions.playContext,
        sessionFileName: sessions.fileName,
        sessionCourseName: sessions.courseName,
        sessionLocation: sessions.location,
        clubId: shots.clubId,
        clubType: shots.clubType,
        shotAt: shots.shotAt,
        shotNumber: shots.shotNumber,
        carryYd: shots.carryYd,
        totalYd: shots.totalYd,
        sideCarryYd: shots.sideCarryYd,
        ballSpeedMph: shots.ballSpeedMph,
        clubSpeedMph: shots.clubSpeedMph,
        launchAngleDeg: shots.launchAngleDeg,
        launchDirectionDeg: shots.launchDirectionDeg,
        apexFt: shots.apexFt,
        attackAngleDeg: shots.attackAngleDeg,
        clubPathDeg: shots.clubPathDeg,
        descentAngleDeg: shots.descentAngleDeg,
        smashFactor: shots.smashFactor,
        spinRate: shots.spinRate,
        spinAxis: shots.spinAxis,
        shotCategory: shots.shotCategory,
        qualityTag: shots.qualityTag,
        reviewStatus: shots.reviewStatus,
        clubDataEstType: shots.clubDataEstType,
        courseHoleNumber: shots.courseHoleNumber,
      })
      .from(shots)
      .innerJoin(sessions, eq(shots.sessionId, sessions.id))
      .where(and(eq(shots.userId, userId), inArray(shots.reviewStatus, ["included", "restored"])))
      .orderBy(desc(shots.shotAt), desc(shots.shotNumber)),
  ]);

  const trackedClubs = clubRows
    .filter((club) => isTrackedClubType(club.type))
    .sort((left, right) => clubSortValue(left.type) - clubSortValue(right.type));
  const clubLabels = new Map(
    trackedClubs.map((club) => [
      club.id,
      [formatClubType(club.type), club.brand, club.model].filter(Boolean).join(" - "),
    ]),
  );
  const allShots: CompareShot[] = shotRows
    .filter((shot) => isTrackedClubType(shot.clubType) && isShotEvidenceEligible(shot))
    .map((shot) => ({
      ...shot,
      sessionLabel:
        shot.sessionCourseName ??
        shot.sessionFileName ??
        shot.sessionLocation ??
        `${formatSessionType(shot.sessionType)} session`,
    }));

  const scopedShots = filters.clubId
    ? allShots.filter((shot) => shot.clubId === filters.clubId)
    : allShots;
  const sessionOptions = buildSessionOptions(allShots);
  const clubsForFilter = trackedClubs.map((club) => ({
    id: club.id,
    type: club.type,
    label: clubLabels.get(club.id) ?? formatClubType(club.type),
    shotCount: allShots.filter((shot) => shot.clubId === club.id).length,
  }));
  const conditioned = conditionSelections(scopedShots, filters.condition);
  const focusSelection = conditioned
    ? selectionFromCondition(conditioned.focusLabel, conditioned.focusShots)
    : resolveFocusSelection(scopedShots, filters, sessionOptions);
  const baselineSelection = conditioned
    ? selectionFromCondition(conditioned.baselineLabel, conditioned.baselineShots)
    : resolveBaselineSelection(scopedShots, filters, focusSelection, sessionOptions);
  const focus = summarizeSelection(focusSelection);
  const baseline = summarizeSelection(baselineSelection);
  const delta = buildDelta(focus, baseline);
  const clubRowsForScope = buildClubRows({
    clubs: clubsForFilter,
    focusShots: focusSelection.shots,
    baselineShots: baselineSelection.shots,
  });
  const requestedClubA = clubRowsForScope.find((row) => row.clubId === filters.clubAId) ?? null;
  const requestedClubB = clubRowsForScope.find((row) => row.clubId === filters.clubBId) ?? null;

  return {
    filters,
    sessions: sessionOptions,
    clubs: clubsForFilter,
    focus,
    baseline,
    delta,
    benefit: buildBenefit(focus, baseline, delta),
    clubRows: clubRowsForScope,
    clubComparison: {
      first: requestedClubA ?? clubRowsForScope[0] ?? null,
      second:
        requestedClubB ??
        clubRowsForScope.find(
          (row) => row.clubId !== (requestedClubA ?? clubRowsForScope[0])?.clubId,
        ) ??
        null,
    },
  };
}

export async function getClubCompareData(filters: ClubCompareFilters): Promise<ClubCompareData> {
  const db = getDb();
  const userId = await requireCurrentUserId();

  const [clubRows, shotRows] = await Promise.all([
    db
      .select({
        id: clubs.id,
        type: clubs.type,
        brand: clubs.brand,
        model: clubs.model,
        active: clubs.active,
      })
      .from(clubs)
      .where(eq(clubs.userId, userId))
      .orderBy(asc(clubs.type), asc(clubs.brand), asc(clubs.model)),
    db
      .select({
        id: shots.id,
        sessionId: shots.sessionId,
        sessionDate: sessions.date,
        sessionCreatedAt: sessions.createdAt,
        sessionType: sessions.type,
        playContext: sessions.playContext,
        sessionFileName: sessions.fileName,
        sessionCourseName: sessions.courseName,
        sessionLocation: sessions.location,
        clubId: shots.clubId,
        clubType: shots.clubType,
        shotAt: shots.shotAt,
        shotNumber: shots.shotNumber,
        carryYd: shots.carryYd,
        totalYd: shots.totalYd,
        sideCarryYd: shots.sideCarryYd,
        ballSpeedMph: shots.ballSpeedMph,
        clubSpeedMph: shots.clubSpeedMph,
        launchAngleDeg: shots.launchAngleDeg,
        launchDirectionDeg: shots.launchDirectionDeg,
        apexFt: shots.apexFt,
        attackAngleDeg: shots.attackAngleDeg,
        clubPathDeg: shots.clubPathDeg,
        descentAngleDeg: shots.descentAngleDeg,
        smashFactor: shots.smashFactor,
        spinRate: shots.spinRate,
        spinAxis: shots.spinAxis,
        shotCategory: shots.shotCategory,
        qualityTag: shots.qualityTag,
        reviewStatus: shots.reviewStatus,
        clubDataEstType: shots.clubDataEstType,
        courseHoleNumber: shots.courseHoleNumber,
      })
      .from(shots)
      .innerJoin(sessions, eq(shots.sessionId, sessions.id))
      .where(and(eq(shots.userId, userId), inArray(shots.reviewStatus, ["included", "restored"])))
      .orderBy(desc(shots.shotAt), desc(shots.shotNumber)),
  ]);

  const allShots: CompareShot[] = shotRows
    .filter((shot) => isTrackedClubType(shot.clubType) && isShotEvidenceEligible(shot))
    .map((shot) => ({
      ...shot,
      sessionLabel:
        shot.sessionCourseName ??
        shot.sessionFileName ??
        shot.sessionLocation ??
        `${formatSessionType(shot.sessionType)} session`,
    }));
  const trackedClubs = clubRows
    .filter((club) => isTrackedClubType(club.type))
    .sort(
      (left, right) =>
        clubSortValue(left.type) - clubSortValue(right.type) ||
        Number(right.active) - Number(left.active) ||
        formatCompareClubLabel(left).localeCompare(formatCompareClubLabel(right)),
    );
  const shotCountByClubId = new Map<string, number>();

  for (const shot of allShots) {
    shotCountByClubId.set(shot.clubId, (shotCountByClubId.get(shot.clubId) ?? 0) + 1);
  }

  const clubOptions: ClubCompareClubOption[] = trackedClubs.map((club) => ({
    id: club.id,
    type: club.type,
    label: formatCompareClubLabel(club),
    shotCount: shotCountByClubId.get(club.id) ?? 0,
    active: club.active,
  }));
  const clubsWithShots = clubOptions.filter((club) => club.shotCount > 0);
  const clubSides = clubOptions.map((club) =>
    buildClubCompareSide(
      club,
      allShots.filter((shot) => shot.clubId === club.id),
    ),
  );
  const selectedA =
    clubOptions.find((club) => club.id === filters.clubAId) ??
    clubsWithShots[0] ??
    clubOptions[0] ??
    null;
  const selectedB =
    clubOptions.find((club) => club.id === filters.clubBId && club.id !== selectedA?.id) ??
    clubsWithShots.find((club) => club.id !== selectedA?.id) ??
    clubOptions.find((club) => club.id !== selectedA?.id) ??
    null;
  const clubA = clubSides.find((club) => club.clubId === selectedA?.id) ?? null;
  const clubB = clubSides.find((club) => club.clubId === selectedB?.id) ?? null;

  return {
    filters: {
      clubAId: selectedA?.id ?? "",
      clubBId: selectedB?.id ?? "",
    },
    clubs: clubOptions,
    clubSides,
    clubA,
    clubB,
    delta: clubA && clubB ? buildDelta(clubA, clubB) : emptyDelta(),
    progress: buildProgressCompareData({ clubs: clubOptions, shots: allShots }),
  };
}

export async function getPlayerCompareData(
  filters: PlayerCompareFilters,
): Promise<PlayerCompareData> {
  const db = getDb();
  const viewerUserId = await requireCurrentUserId();
  const [publicProfiles, viewerProfiles, friendIds, blockedIds] = await Promise.all([
    db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.publicProfile, true))
      .orderBy(asc(userProfiles.displayName))
      .limit(100),
    db.select().from(userProfiles).where(eq(userProfiles.userId, viewerUserId)).limit(1),
    getFriendIds(viewerUserId),
    getBlockedUserIds(viewerUserId),
  ]);
  const profileRows = [
    ...new Map(
      [...viewerProfiles, ...publicProfiles]
        .filter((profile) =>
          canUseProfileForPlayerCompare({
            profile,
            viewerUserId,
            friendIds: new Set(friendIds),
            blockedIds,
          }),
        )
        .map((profile) => [profile.userId, profile] as const),
    ).values(),
  ].sort((left, right) => left.displayName.localeCompare(right.displayName));

  const players = profileRows
    .map((profile) => ({
      userId: profile.userId,
      username: profile.username,
      displayName: profile.displayName,
      label: `${profile.displayName} (@${profile.username})`,
      handicapBand: profile.handicapBand,
      handicapEstimate: null,
      worldRank: profileWorldRank(profile.pbShowcaseJson),
    }))
    .sort((left, right) => {
      const rankDelta =
        (left.worldRank ?? Number.POSITIVE_INFINITY) -
        (right.worldRank ?? Number.POSITIVE_INFINITY);
      return rankDelta || left.displayName.localeCompare(right.displayName);
    });
  const selectedA =
    players.find((player) => player.userId === filters.playerAId) ?? players[0] ?? null;
  const selectedB =
    players.find(
      (player) => player.userId === filters.playerBId && player.userId !== selectedA?.userId,
    ) ??
    players.find((player) => player.userId !== selectedA?.userId) ??
    null;
  const playerIds = players.map((player) => player.userId);

  if (playerIds.length === 0) {
    return {
      filters: { playerAId: "", playerBId: "" },
      players,
      playerSides: [],
      playerA: null,
      playerB: null,
      delta: emptyPlayerDelta(),
    };
  }

  const [shotRows, sessionRows, stockRows, tournamentRows, submissionRows] = await Promise.all([
    db
      .select({
        id: shots.id,
        userId: shots.userId,
        sessionId: shots.sessionId,
        sessionDate: sessions.date,
        sessionCreatedAt: sessions.createdAt,
        sessionType: sessions.type,
        playContext: sessions.playContext,
        sessionFileName: sessions.fileName,
        sessionCourseName: sessions.courseName,
        sessionLocation: sessions.location,
        clubId: shots.clubId,
        clubType: shots.clubType,
        shotAt: shots.shotAt,
        shotNumber: shots.shotNumber,
        carryYd: shots.carryYd,
        totalYd: shots.totalYd,
        sideCarryYd: shots.sideCarryYd,
        ballSpeedMph: shots.ballSpeedMph,
        clubSpeedMph: shots.clubSpeedMph,
        launchAngleDeg: shots.launchAngleDeg,
        launchDirectionDeg: shots.launchDirectionDeg,
        apexFt: shots.apexFt,
        attackAngleDeg: shots.attackAngleDeg,
        clubPathDeg: shots.clubPathDeg,
        descentAngleDeg: shots.descentAngleDeg,
        smashFactor: shots.smashFactor,
        spinRate: shots.spinRate,
        spinAxis: shots.spinAxis,
        shotCategory: shots.shotCategory,
        qualityTag: shots.qualityTag,
        reviewStatus: shots.reviewStatus,
        clubDataEstType: shots.clubDataEstType,
        courseHoleNumber: shots.courseHoleNumber,
      })
      .from(shots)
      .innerJoin(sessions, eq(shots.sessionId, sessions.id))
      .where(
        and(
          inArray(shots.userId, playerIds),
          inArray(shots.reviewStatus, ["included", "restored"]),
        ),
      )
      .orderBy(desc(shots.shotAt), desc(shots.shotNumber)),
    db
      .select({
        id: sessions.id,
        userId: sessions.userId,
        type: sessions.type,
        date: sessions.date,
        courseName: sessions.courseName,
        location: sessions.location,
        fileName: sessions.fileName,
        scorecardJson: sessions.scorecardJson,
        courseRating: teeSets.courseRating,
        slopeRating: teeSets.slopeRating,
      })
      .from(sessions)
      .leftJoin(teeSets, eq(sessions.teeSetId, teeSets.id))
      .where(inArray(sessions.userId, playerIds))
      .orderBy(desc(sessions.date)),
    db
      .select({
        userId: stockYardages.userId,
        clubType: clubs.type,
        calculatedAt: stockYardages.calculatedAt,
        carryMedianYd: stockYardages.carryMedianYd,
        totalMedianYd: stockYardages.totalMedianYd,
      })
      .from(stockYardages)
      .innerJoin(clubs, eq(stockYardages.clubId, clubs.id))
      .where(inArray(stockYardages.userId, playerIds))
      .orderBy(desc(stockYardages.calculatedAt)),
    db
      .select({
        userId: tournamentStandings.userId,
        rank: tournamentStandings.rank,
        grossTotal: tournamentStandings.grossTotal,
        netTotal: tournamentStandings.netTotal,
        roundsCompleted: tournamentStandings.roundsCompleted,
        calculatedAt: tournamentStandings.calculatedAt,
        tournamentTitle: tournaments.title,
      })
      .from(tournamentStandings)
      .innerJoin(tournaments, eq(tournamentStandings.tournamentId, tournaments.id))
      .where(eq(tournamentStandings.userId, viewerUserId))
      .orderBy(desc(tournamentStandings.calculatedAt)),
    db
      .select({
        userId: tournamentSubmissions.userId,
        tournamentTitle: tournaments.title,
        roundNumber: tournamentSubmissions.roundNumber,
        grossScore: tournamentSubmissions.grossScore,
        netScore: tournamentSubmissions.netScore,
        submittedAt: tournamentSubmissions.submittedAt,
      })
      .from(tournamentSubmissions)
      .innerJoin(tournaments, eq(tournamentSubmissions.tournamentId, tournaments.id))
      .where(eq(tournamentSubmissions.userId, viewerUserId))
      .orderBy(desc(tournamentSubmissions.submittedAt)),
  ]);

  const shotRowsByUser = groupBy(
    shotRows
      .filter((shot) => isTrackedClubType(shot.clubType) && isShotEvidenceEligible(shot))
      .map((shot) => ({
        ...shot,
        sessionLabel:
          shot.sessionCourseName ??
          shot.sessionFileName ??
          shot.sessionLocation ??
          `${formatSessionType(shot.sessionType)} session`,
      })),
    (shot) => shot.userId,
  );
  const sessionsByUser = groupBy(sessionRows, (session) => session.userId);
  const stockByUser = groupBy(stockRows, (stock) => stock.userId);
  const tournamentsByUser = groupBy(tournamentRows, (standing) => standing.userId);
  const submissionsByUser = groupBy(submissionRows, (submission) => submission.userId);

  const profileByUserId = new Map(profileRows.map((profile) => [profile.userId, profile]));
  const playerSides = players.map((player) => {
    const isViewer = player.userId === viewerUserId;

    return buildPlayerCompareSide({
      profile: profileByUserId.get(player.userId),
      option: player,
      shots: shotRowsByUser.get(player.userId) ?? [],
      sessions: sessionsByUser.get(player.userId) ?? [],
      stockRows: stockByUser.get(player.userId) ?? [],
      tournamentRows: isViewer ? (tournamentsByUser.get(player.userId) ?? []) : [],
      submissionRows: isViewer ? (submissionsByUser.get(player.userId) ?? []) : [],
    });
  });
  const playerA = playerSides.find((player) => player.userId === selectedA?.userId) ?? null;
  const playerB = playerSides.find((player) => player.userId === selectedB?.userId) ?? null;

  const playersWithEstimates = players.map((player) => {
    const side = playerSides.find((candidate) => candidate.userId === player.userId);

    return {
      ...player,
      handicapEstimate: side?.handicapEstimate ?? player.handicapEstimate,
    };
  });

  return {
    filters: {
      playerAId: selectedA?.userId ?? "",
      playerBId: selectedB?.userId ?? "",
    },
    players: playersWithEstimates,
    playerSides,
    playerA,
    playerB,
    delta: playerA && playerB ? buildPlayerDelta(playerA, playerB) : emptyPlayerDelta(),
  };
}

type PlayerCompareProfile = typeof userProfiles.$inferSelect;

export function canUseProfileForPlayerCompare(input: {
  profile: PlayerCompareProfile;
  viewerUserId: string;
  friendIds: ReadonlySet<string>;
  blockedIds: ReadonlySet<string>;
}) {
  if (input.profile.userId === input.viewerUserId) {
    return true;
  }

  if (input.blockedIds.has(input.profile.userId) || !input.profile.publicProfile) {
    return false;
  }

  const settings = input.profile.visibilitySettingsJson ?? {};

  if (settings.allowCompare !== true) {
    return false;
  }

  const isFriend = input.friendIds.has(input.profile.userId);
  return (["exactShots", "rounds", "bag", "handicap"] as const).every((field) => {
    const visibility = settings[field] ?? "private";
    return visibility === "public" || (isFriend && visibility === "friends");
  });
}

export function defaultCompareFilters(): CompareFilters {
  return {
    focus: "today",
    baseline: "before-focus",
    sessionId: "",
    baselineSessionId: "",
    clubId: "",
    clubAId: "",
    clubBId: "",
    from: "",
    to: "",
    baselineFrom: "",
    baselineTo: "",
    condition: "same",
  };
}

function conditionSelections(shots: CompareShot[], condition: CompareConditionMode) {
  if (condition === "indoor-outdoor") {
    return {
      focusLabel: "Outdoor and on-course",
      baselineLabel: "Indoor",
      focusShots: shots.filter(
        (shot) => shot.playContext === "outdoor" || shot.playContext === "on_course",
      ),
      baselineShots: shots.filter(
        (shot) => shot.playContext === "indoor" || shot.playContext === "practice_bay",
      ),
    };
  }
  if (condition === "practice-round") {
    return {
      focusLabel: "Round performance",
      baselineLabel: "Practice performance",
      focusShots: shots.filter((shot) => shot.playContext === "on_course"),
      baselineShots: shots.filter(
        (shot) =>
          shot.playContext === "indoor" ||
          shot.playContext === "outdoor" ||
          shot.playContext === "practice_bay",
      ),
    };
  }
  return null;
}

function selectionFromCondition(label: string, shots: CompareShot[]): Selection {
  return {
    label,
    detail: `${shots.length} measured shots across ${new Set(shots.map((shot) => shot.sessionId)).size} sessions`,
    shots,
    start: minDate(shots.map((shot) => shot.shotAt)),
    end: maxDate(shots.map((shot) => shot.shotAt)),
  };
}

export function defaultClubCompareFilters(): ClubCompareFilters {
  return {
    clubAId: "",
    clubBId: "",
  };
}

export function defaultPlayerCompareFilters(): PlayerCompareFilters {
  return {
    playerAId: "",
    playerBId: "",
  };
}

function buildSessionOptions(shots: CompareShot[]): CompareSessionOption[] {
  const counts = new Map<string, { shot: CompareShot; count: number }>();

  for (const shot of shots) {
    const current = counts.get(shot.sessionId);
    counts.set(shot.sessionId, {
      shot,
      count: (current?.count ?? 0) + 1,
    });
  }

  return [...counts.values()]
    .map(({ shot, count }) => ({
      id: shot.sessionId,
      label: shot.sessionLabel,
      dateLabel: formatDate(shot.sessionDate),
      dateInput: dateInputValue(shot.sessionDate),
      type: shot.sessionType,
      shotCount: count,
    }))
    .sort((left, right) => right.dateInput.localeCompare(left.dateInput));
}

function resolveFocusSelection(
  shots: CompareShot[],
  filters: CompareFilters,
  sessions: CompareSessionOption[],
): Selection {
  if (shots.length === 0) {
    return emptySelection("Focus sample", "No shots match the current filters.");
  }

  const latestShotDate = maxDate(shots.map((shot) => shot.sessionDate)) ?? new Date();

  if (filters.focus === "session") {
    const sessionId = filters.sessionId || sessions[0]?.id;
    const sessionShots = shots.filter((shot) => shot.sessionId === sessionId);
    const session = sessions.find((item) => item.id === sessionId);
    return {
      label: session ? session.label : "Selected session",
      detail: session
        ? `${session.dateLabel} - ${formatSessionType(session.type)}`
        : "Session comparison",
      shots: sessionShots,
      start: minDate(sessionShots.map((shot) => shot.shotAt)),
      end: maxDate(sessionShots.map((shot) => shot.shotAt)),
    };
  }

  if (filters.focus === "latest-session") {
    const session = sessions[0];
    const sessionShots = session ? shots.filter((shot) => shot.sessionId === session.id) : [];
    return {
      label: session?.label ?? "Latest session",
      detail: session
        ? `${session.dateLabel} - ${formatSessionType(session.type)}`
        : "Latest imported session",
      shots: sessionShots,
      start: minDate(sessionShots.map((shot) => shot.shotAt)),
      end: maxDate(sessionShots.map((shot) => shot.shotAt)),
    };
  }

  if (filters.focus === "last-7" || filters.focus === "last-30") {
    const days = filters.focus === "last-7" ? 7 : 30;
    const end = endOfLocalDay(latestShotDate);
    const start = startOfLocalDay(new Date(end.getTime() - (days - 1) * DAY_MS));
    return {
      label: `Last ${days} days`,
      detail: `${formatDate(start)} to ${formatDate(end)}`,
      shots: shots.filter((shot) => isBetween(shot.sessionDate, start, end)),
      start,
      end,
    };
  }

  if (filters.focus === "custom") {
    const start = parseDateInput(filters.from) ?? startOfLocalDay(latestShotDate);
    const end = parseDateInput(filters.to, true) ?? endOfLocalDay(latestShotDate);
    return {
      label: "Custom focus",
      detail: `${formatDate(start)} to ${formatDate(end)}`,
      shots: shots.filter((shot) => isBetween(shot.sessionDate, start, end)),
      start,
      end,
    };
  }

  const currentDay = startOfLocalDay(new Date());
  const currentDayEnd = endOfLocalDay(currentDay);
  const currentDayShots = shots.filter((shot) =>
    isBetween(shot.sessionDate, currentDay, currentDayEnd),
  );

  if (currentDayShots.length > 0) {
    return {
      label: "Today",
      detail: formatDate(currentDay),
      shots: currentDayShots,
      start: currentDay,
      end: currentDayEnd,
    };
  }

  const latestSessionShots = latestImportedSessionShots(shots);
  const latestShot = latestSessionShots[0];

  return {
    label: latestShot
      ? `Latest imported session: ${latestShot.sessionLabel}`
      : "Latest imported session",
    detail: latestShot
      ? `${formatDate(latestShot.sessionDate)} - ${formatSessionType(latestShot.sessionType)}`
      : "No imported session found",
    shots: latestSessionShots,
    start: minDate(latestSessionShots.map((shot) => shot.shotAt)),
    end: maxDate(latestSessionShots.map((shot) => shot.shotAt)),
  };
}

function resolveBaselineSelection(
  shots: CompareShot[],
  filters: CompareFilters,
  focus: Selection,
  sessions: CompareSessionOption[],
): Selection {
  if (shots.length === 0) {
    return emptySelection("Baseline", "No shots match the current filters.");
  }

  const focusIds = new Set(focus.shots.map((shot) => shot.id));
  const focusStart = focus.start ?? minDate(focus.shots.map((shot) => shot.shotAt));

  if (filters.baseline === "all-time") {
    return {
      label: "All time",
      detail: "All tracked shots outside the focus sample",
      shots: shots.filter((shot) => !focusIds.has(shot.id)),
      start: minDate(shots.map((shot) => shot.shotAt)),
      end: maxDate(shots.map((shot) => shot.shotAt)),
    };
  }

  if (filters.baseline === "previous-session") {
    const focusStartValue = focusStart?.getTime() ?? Number.POSITIVE_INFINITY;
    const previousSession = sessions.find((session) => {
      const sessionDate = parseDateInput(session.dateInput);
      return sessionDate ? sessionDate.getTime() < focusStartValue : false;
    });
    const sessionId = filters.baselineSessionId || previousSession?.id;
    const sessionShots = sessionId ? shots.filter((shot) => shot.sessionId === sessionId) : [];
    const session = sessions.find((item) => item.id === sessionId);

    return {
      label: session ? session.label : "Previous session",
      detail: session
        ? `${session.dateLabel} - ${formatSessionType(session.type)}`
        : "No previous session found",
      shots: sessionShots,
      start: minDate(sessionShots.map((shot) => shot.shotAt)),
      end: maxDate(sessionShots.map((shot) => shot.shotAt)),
    };
  }

  if (filters.baseline === "previous-30") {
    const end = focusStart ? new Date(focusStart.getTime() - 1) : endOfLocalDay(new Date());
    const start = startOfLocalDay(new Date(end.getTime() - 29 * DAY_MS));

    return {
      label: "Previous 30 days",
      detail: `${formatDate(start)} to ${formatDate(end)}`,
      shots: shots.filter((shot) => isBetween(shot.sessionDate, start, end)),
      start,
      end,
    };
  }

  if (filters.baseline === "custom") {
    const latestShotDate = maxDate(shots.map((shot) => shot.sessionDate)) ?? new Date();
    const start = parseDateInput(filters.baselineFrom) ?? startOfLocalDay(latestShotDate);
    const end = parseDateInput(filters.baselineTo, true) ?? endOfLocalDay(latestShotDate);
    return {
      label: "Custom baseline",
      detail: `${formatDate(start)} to ${formatDate(end)}`,
      shots: shots.filter(
        (shot) => isBetween(shot.sessionDate, start, end) && !focusIds.has(shot.id),
      ),
      start,
      end,
    };
  }

  const baselineShots = focusStart
    ? shots.filter((shot) => shot.shotAt.getTime() < focusStart.getTime())
    : shots.filter((shot) => !focusIds.has(shot.id));

  return {
    label: "All time before focus",
    detail: focusStart
      ? `Before ${formatDate(focusStart)}`
      : "All tracked shots outside the focus sample",
    shots: baselineShots,
    start: minDate(baselineShots.map((shot) => shot.shotAt)),
    end: maxDate(baselineShots.map((shot) => shot.shotAt)),
  };
}

function summarizeSelection(selection: Selection): CompareSampleSummary {
  const evidenceShots = selection.shots.filter(isShotEvidenceEligible);
  const stockShots = selectComparableShots(evidenceShots);
  const sessionIds = new Set(evidenceShots.map((shot) => shot.sessionId));
  const clubIds = new Set(evidenceShots.map((shot) => shot.clubId));
  const carryValues = stockShots.map((shot) => shot.carryYd).filter(isNumber);
  const totalValues = stockShots.map((shot) => shot.totalYd).filter(isNumber);
  const sideValues = stockShots.map((shot) => shot.sideCarryYd).filter(isNumber);
  const ballSpeedValues = stockShots.map((shot) => shot.ballSpeedMph).filter(isNumber);
  const launchValues = stockShots.map((shot) => shot.launchAngleDeg).filter(isNumber);
  const stockCarryByClub = medianCarryByClub(stockShots);

  return {
    label: selection.label,
    detail: selection.detail,
    rawShots: evidenceShots.length,
    stockShots: stockShots.length,
    sessions: sessionIds.size,
    clubs: clubIds.size,
    carryMedianYd: roundOne(percentile(carryValues, 0.5)),
    carryAverageYd: roundOne(mean(carryValues)),
    totalMedianYd: roundOne(percentile(totalValues, 0.5)),
    ballSpeedAverageMph: roundOne(mean(ballSpeedValues)),
    launchAverageDeg: roundOne(mean(launchValues)),
    absoluteOfflineAverageYd: roundOne(mean(sideValues.map(Math.abs))),
    shotConeWidthYd: shotConeWidth(sideValues),
    playableRate: rate(stockShots, (shot) => {
      const side = shot.sideCarryYd;
      const carry = shot.carryYd;
      const stockCarry = stockCarryByClub.get(shot.clubId);

      return (
        isNumber(side) &&
        Math.abs(side) <= playableLimit(shot.clubType) &&
        (!isNumber(carry) || !isNumber(stockCarry) || carry >= stockCarry * 0.85)
      );
    }),
    bigMissRate: rate(
      stockShots,
      (shot) =>
        isNumber(shot.sideCarryYd) && Math.abs(shot.sideCarryYd) > bigMissLimit(shot.clubType),
    ),
    leftMissRate: rate(stockShots, (shot) => isNumber(shot.sideCarryYd) && shot.sideCarryYd < -5),
    rightMissRate: rate(stockShots, (shot) => isNumber(shot.sideCarryYd) && shot.sideCarryYd > 5),
    primaryMiss: primaryMiss(sideValues),
    dispersion: stockShots
      .filter(
        (shot): shot is CompareShot & { carryYd: number; sideCarryYd: number } =>
          isNumber(shot.carryYd) && isNumber(shot.sideCarryYd),
      )
      .slice(0, 180)
      .map((shot) => ({
        id: shot.id,
        clubType: shot.clubType,
        carryYd: shot.carryYd,
        sideCarryYd: shot.sideCarryYd,
        label: `${formatClubType(shot.clubType)} ${formatDate(shot.shotAt)}`,
      })),
    sessionBreakdown: sessionBreakdown(evidenceShots),
  };
}

function selectComparableShots(shots: CompareShot[]) {
  const byClub = groupBy(shots, (shot) => shot.clubId);
  const selected: CompareShot[] = [];

  for (const clubShots of byClub.values()) {
    const clubType = clubShots[0]?.clubType;
    selected.push(
      ...selectStockYardageShots(clubShots, clubShots.length, { clubType }).filteredShots,
    );
  }

  return selected.sort((left, right) => right.shotAt.getTime() - left.shotAt.getTime());
}

function buildClubRows({
  clubs,
  focusShots,
  baselineShots,
}: {
  clubs: CompareClubOption[];
  focusShots: CompareShot[];
  baselineShots: CompareShot[];
}): CompareClubRow[] {
  return clubs
    .map((club) => {
      const focus = summarizeSelection({
        label: formatClubType(club.type),
        detail: "Focus sample",
        shots: focusShots.filter((shot) => shot.clubId === club.id),
        start: null,
        end: null,
      });
      const baseline = summarizeSelection({
        label: formatClubType(club.type),
        detail: "Baseline sample",
        shots: baselineShots.filter((shot) => shot.clubId === club.id),
        start: null,
        end: null,
      });
      const delta = buildDelta(focus, baseline);

      return {
        clubId: club.id,
        clubType: club.type,
        label: club.label,
        focus,
        baseline,
        delta,
        benefitScore: benefitScore(focus, baseline, delta),
      };
    })
    .filter((row) => row.focus.rawShots > 0 || row.baseline.rawShots > 0)
    .sort((left, right) => {
      if (right.focus.stockShots !== left.focus.stockShots) {
        return right.focus.stockShots - left.focus.stockShots;
      }

      return clubSortValue(left.clubType) - clubSortValue(right.clubType);
    });
}

function buildDelta(focus: CompareSampleSummary, baseline: CompareSampleSummary): CompareDelta {
  return {
    carryDeltaYd: diff(focus.carryMedianYd, baseline.carryMedianYd),
    ballSpeedDeltaMph: diff(focus.ballSpeedAverageMph, baseline.ballSpeedAverageMph),
    launchDeltaDeg: diff(focus.launchAverageDeg, baseline.launchAverageDeg),
    offlineDeltaYd: diff(focus.absoluteOfflineAverageYd, baseline.absoluteOfflineAverageYd),
    coneDeltaYd: diff(focus.shotConeWidthYd, baseline.shotConeWidthYd),
    playableRateDelta: diff(focus.playableRate, baseline.playableRate),
    bigMissRateDelta: diff(focus.bigMissRate, baseline.bigMissRate),
  };
}

function emptyDelta(): CompareDelta {
  return {
    carryDeltaYd: null,
    ballSpeedDeltaMph: null,
    launchDeltaDeg: null,
    offlineDeltaYd: null,
    coneDeltaYd: null,
    playableRateDelta: null,
    bigMissRateDelta: null,
  };
}

function buildClubCompareSide(
  club: ClubCompareClubOption,
  clubShots: CompareShot[],
): ClubCompareSide {
  const start = minDate(clubShots.map((shot) => shot.shotAt));
  const end = maxDate(clubShots.map((shot) => shot.shotAt));
  const summary = summarizeSelection({
    label: club.label,
    detail: dateRangeLabel(start, end),
    shots: clubShots,
    start,
    end,
  });

  return {
    ...summary,
    clubId: club.id,
    clubType: club.type,
    active: club.active,
    dateRange: dateRangeLabel(start, end),
  };
}

export function buildProgressCompareData({
  clubs,
  shots,
}: {
  clubs: CompareClubOption[];
  shots: CompareShot[];
}): ProgressCompareData {
  const trackedShots = shots.filter(
    (shot) => isTrackedClubType(shot.clubType) && isShotEvidenceEligible(shot),
  );
  const latestSessionShots = latestImportedSessionShots(trackedShots);
  const latestShot = latestSessionShots[0];
  const latestSession = latestShot
    ? {
        id: latestShot.sessionId,
        label: latestShot.sessionLabel,
        dateLabel: formatDate(latestShot.sessionDate),
        dateInput: dateInputValue(latestShot.sessionDate),
        type: latestShot.sessionType,
        shotCount: latestSessionShots.length,
      }
    : null;

  return {
    latestSession,
    previousWeek: buildRecentProgressComparison({
      mode: "previous-week",
      label: "Previous 7 days",
      days: 7,
      clubs,
      shots: trackedShots,
      latestShot,
    }),
    previousMonth: buildRecentProgressComparison({
      mode: "previous-month",
      label: "Previous 30 days",
      days: 30,
      clubs,
      shots: trackedShots,
      latestShot,
    }),
    weeklyPeriods: buildProgressPeriods(trackedShots, "week", 8),
    monthlyPeriods: buildProgressPeriods(trackedShots, "month", 6),
  };
}

function buildRecentProgressComparison({
  mode,
  label,
  days,
  clubs,
  shots,
  latestShot,
}: {
  mode: ProgressBaselineMode;
  label: string;
  days: number;
  clubs: CompareClubOption[];
  shots: CompareShot[];
  latestShot: CompareShot | undefined;
}): ProgressComparison {
  if (!latestShot) {
    return emptyProgressComparison(mode, label, "Import a session to compare progress.");
  }

  const focusEnd = endOfLocalDay(latestShot.sessionDate);
  const focusStart = startOfLocalDay(new Date(focusEnd.getTime() - 6 * DAY_MS));
  const focusShots = shots.filter((shot) => isBetween(shot.sessionDate, focusStart, focusEnd));
  const baselineWindow = findPreviousProgressWindow({
    shots,
    focusStart,
    days,
  });
  const baselineLabel = baselineWindow.shifted
    ? mode === "previous-week"
      ? "Previous practice week"
      : "Previous practice month"
    : label;
  const focusSelection: Selection = {
    label: "Last 7 days",
    detail: `${formatDate(focusStart)} to ${formatDate(focusEnd)}`,
    shots: focusShots,
    start: focusStart,
    end: focusEnd,
  };
  const baselineSelection: Selection = {
    label: baselineLabel,
    detail: `${formatDate(baselineWindow.start)} to ${formatDate(baselineWindow.end)}`,
    shots: baselineWindow.shots,
    start: baselineWindow.start,
    end: baselineWindow.end,
  };
  const focus = summarizeSelection(focusSelection);
  const baseline = summarizeSelection(baselineSelection);
  const delta = buildDelta(focus, baseline);
  const focusClubIds = new Set(focusShots.map((shot) => shot.clubId));
  const focusClubs = clubs.filter((club) => focusClubIds.has(club.id));
  const clubRows = buildClubRows({
    clubs: focusClubs,
    focusShots,
    baselineShots: baselineWindow.shots,
  }).sort((left, right) => clubSortValue(left.clubType) - clubSortValue(right.clubType));

  return {
    mode,
    label: baselineLabel,
    detail: baselineSelection.detail,
    focus,
    baseline,
    delta,
    benefit: buildBenefit(focus, baseline, delta),
    clubRows,
  };
}

function findPreviousProgressWindow({
  shots,
  focusStart,
  days,
}: {
  shots: CompareShot[];
  focusStart: Date;
  days: number;
}) {
  const earliestShotDate = minDate(shots.map((shot) => shot.sessionDate));
  let end = new Date(focusStart.getTime() - 1);
  let start = startOfLocalDay(new Date(end.getTime() - (days - 1) * DAY_MS));
  const exactWindow = progressWindow(shots, start, end, false);

  if (hasStockShots(exactWindow.shots) || !earliestShotDate) {
    return exactWindow;
  }

  const earliestStart = startOfLocalDay(earliestShotDate);

  while (start.getTime() > earliestStart.getTime()) {
    end = new Date(end.getTime() - DAY_MS);
    start = startOfLocalDay(new Date(end.getTime() - (days - 1) * DAY_MS));

    const candidate = progressWindow(shots, start, end, true);

    if (hasStockShots(candidate.shots)) {
      return candidate;
    }
  }

  return exactWindow;
}

function progressWindow(shots: CompareShot[], start: Date, end: Date, shifted: boolean) {
  return {
    start,
    end,
    shots: shots.filter((shot) => isBetween(shot.sessionDate, start, end)),
    shifted,
  };
}

function hasStockShots(shots: CompareShot[]) {
  return selectComparableShots(shots).length > 0;
}

function emptyProgressComparison(
  mode: ProgressBaselineMode,
  label: string,
  detail: string,
): ProgressComparison {
  const focus = summarizeSelection(emptySelection("Last 7 days", "No imported session found."));
  const baseline = summarizeSelection(emptySelection(label, detail));
  const delta = emptyDelta();

  return {
    mode,
    label,
    detail,
    focus,
    baseline,
    delta,
    benefit: buildBenefit(focus, baseline, delta),
    clubRows: [],
  };
}

function buildProgressPeriods(
  shots: CompareShot[],
  mode: ProgressPeriodMode,
  limit: number,
): ProgressPeriod[] {
  const periodMap = new Map<
    string,
    {
      key: string;
      label: string;
      detail: string;
      start: Date;
      end: Date;
      shots: CompareShot[];
    }
  >();

  for (const shot of shots) {
    const start =
      mode === "week" ? startOfLocalWeek(shot.sessionDate) : startOfLocalMonth(shot.sessionDate);
    const end = mode === "week" ? endOfLocalWeek(start) : endOfLocalMonth(start);
    const key = dateInputValue(start);
    const current = periodMap.get(key) ?? {
      key,
      label: progressPeriodLabel(mode, start),
      detail: `${formatDate(start)} to ${formatDate(end)}`,
      start,
      end,
      shots: [],
    };

    current.shots.push(shot);
    periodMap.set(key, current);
  }

  const chronological = [...periodMap.values()]
    .sort((left, right) => left.start.getTime() - right.start.getTime())
    .map((period) => {
      const summary = summarizeSelection({
        label: period.label,
        detail: period.detail,
        shots: period.shots,
        start: period.start,
        end: period.end,
      });

      return { ...period, summary };
    });

  return chronological
    .map((period, index) => {
      const previous = chronological[index - 1];
      const previousSummary =
        previous?.summary ??
        summarizeSelection(emptySelection("Previous period", "No earlier data."));
      const delta = previous ? buildDelta(period.summary, previous.summary) : emptyDelta();

      return {
        key: period.key,
        mode,
        label: period.label,
        detail: period.detail,
        summary: period.summary,
        deltaFromPrevious: delta,
        benefit: buildBenefit(period.summary, previousSummary, delta),
      };
    })
    .slice(-limit)
    .reverse();
}

function progressPeriodLabel(mode: ProgressPeriodMode, start: Date) {
  return mode === "week" ? `Week of ${formatDate(start)}` : monthFormatter.format(start);
}

function buildPlayerCompareSide({
  profile,
  option,
  shots,
  sessions: playerSessions,
  stockRows,
  tournamentRows,
  submissionRows,
}: {
  profile: PlayerProfileRow | undefined;
  option: PlayerCompareOption;
  shots: CompareShot[];
  sessions: PlayerSessionRow[];
  stockRows: PlayerStockRow[];
  tournamentRows: PlayerTournamentStandingRow[];
  submissionRows: PlayerTournamentSubmissionRow[];
}): PlayerCompareSide {
  const start = minDate(shots.map((shot) => shot.shotAt));
  const end = maxDate(shots.map((shot) => shot.shotAt));
  const summary = summarizeSelection({
    label: option.displayName,
    detail: dateRangeLabel(start, end),
    shots,
    start,
    end,
  });
  const scoreRows = playerSessions
    .map((session) => normalisedScorecardRound(session))
    .filter((row): row is NormalisedScorecardRound => row !== null);
  const scores = scoreRows.map((row) => row.score);
  const latestScore =
    [...scoreRows].sort((left, right) => right.date.getTime() - left.date.getTime())[0]?.score ??
    null;
  const handicapEstimate = calculateHandicapSummary(
    scoreRows.map((row) => row.handicapDifferential),
  ).value;
  const generatedHandicapBand = handicapBandFromValue(handicapEstimate);
  const latestStanding = [...tournamentRows].sort(
    (left, right) => right.calculatedAt.getTime() - left.calculatedAt.getTime(),
  )[0];

  return {
    ...summary,
    userId: option.userId,
    username: option.username,
    displayName: option.displayName,
    handicapBand: generatedHandicapBand ?? option.handicapBand,
    homeCourse: profile?.homeCourse ?? null,
    launchMonitor: profile?.primaryLaunchMonitor ?? null,
    worldRank: option.worldRank,
    handicapEstimate,
    rounds: scores.length,
    bestScore: scores.length > 0 ? Math.min(...scores) : null,
    scoringAverage: roundOne(mean(scores)),
    latestScore,
    driverCarryYd: latestStockCarry(stockRows, "driver"),
    sevenIronCarryYd: latestStockCarry(stockRows, "7i"),
    tournamentRank: latestStanding?.rank ?? null,
    tournamentGrossTotal: latestStanding?.grossTotal ?? null,
    tournamentNetTotal: latestStanding?.netTotal ?? null,
    tournamentRoundsCompleted: latestStanding?.roundsCompleted ?? null,
    recentTournamentScores: submissionRows
      .sort((left, right) => right.submittedAt.getTime() - left.submittedAt.getTime())
      .slice(0, 4)
      .map((row) => ({
        tournamentTitle: row.tournamentTitle,
        roundNumber: row.roundNumber,
        grossScore: row.grossScore,
        netScore: row.netScore,
        submittedAt: row.submittedAt,
      })),
  };
}

function buildPlayerDelta(
  playerA: PlayerCompareSide,
  playerB: PlayerCompareSide,
): PlayerCompareDelta {
  return {
    handicapEstimateDelta: diff(playerA.handicapEstimate, playerB.handicapEstimate),
    bestScoreDelta: diff(playerA.bestScore, playerB.bestScore),
    scoringAverageDelta: diff(playerA.scoringAverage, playerB.scoringAverage),
    latestScoreDelta: diff(playerA.latestScore, playerB.latestScore),
    driverCarryDeltaYd: diff(playerA.driverCarryYd, playerB.driverCarryYd),
    sevenIronCarryDeltaYd: diff(playerA.sevenIronCarryYd, playerB.sevenIronCarryYd),
    offlineDeltaYd: diff(playerA.absoluteOfflineAverageYd, playerB.absoluteOfflineAverageYd),
    playableRateDelta: diff(playerA.playableRate, playerB.playableRate),
    tournamentGrossDelta: diff(playerA.tournamentGrossTotal, playerB.tournamentGrossTotal),
  };
}

function emptyPlayerDelta(): PlayerCompareDelta {
  return {
    handicapEstimateDelta: null,
    bestScoreDelta: null,
    scoringAverageDelta: null,
    latestScoreDelta: null,
    driverCarryDeltaYd: null,
    sevenIronCarryDeltaYd: null,
    offlineDeltaYd: null,
    playableRateDelta: null,
    tournamentGrossDelta: null,
  };
}

function profileWorldRank(showcase: Array<Record<string, unknown>>) {
  const ranking = showcase.find((item) => item.label === "Ranking")?.value;
  const match = typeof ranking === "string" ? ranking.match(/#(\d+)/) : null;
  return match ? Number(match[1]) : null;
}

type NormalisedScorecardRound = {
  score: number;
  handicapDifferential: number | null;
  date: Date;
};

function normalisedScorecardRound(session: PlayerSessionRow): NormalisedScorecardRound | null {
  const scorecard = session.scorecardJson ?? [];
  const rawTotalScore = scorecardGrossTotal(scorecard);

  if (!isNumber(rawTotalScore)) {
    return null;
  }

  const rawTotalPar =
    scorecard.length > 0 ? scorecard.reduce((total, hole) => total + (hole.par ?? 0), 0) : null;
  const handicapInput = normaliseHandicapRoundInput({
    totalScore: rawTotalScore,
    totalPar: rawTotalPar,
    courseRating: session.courseRating,
    slopeRating: session.slopeRating,
    holesPlayed: scorecard.length,
  });

  return {
    score: handicapInput.totalScore ?? rawTotalScore,
    handicapDifferential: calculateRoundDifferential(handicapInput),
    date: session.date,
  };
}

function scorecardGrossTotal(scorecard: PlayerSessionRow["scorecardJson"]) {
  const scores = (scorecard ?? []).map((hole) => hole.score).filter(isNumber);
  return scores.length > 0 ? scores.reduce((total, score) => total + score, 0) : null;
}

function latestStockCarry(stockRows: PlayerStockRow[], clubType: string) {
  return (
    [...stockRows]
      .filter((row) => row.clubType === clubType)
      .sort((left, right) => right.calculatedAt.getTime() - left.calculatedAt.getTime())[0]
      ?.carryMedianYd ?? null
  );
}

function formatCompareClubLabel(club: {
  type: string;
  brand: string | null;
  model: string | null;
  active: boolean;
}) {
  const label = [formatClubType(club.type), club.brand, club.model].filter(Boolean).join(" - ");
  return club.active ? label : `${label} (retired)`;
}

function dateRangeLabel(start: Date | null, end: Date | null) {
  if (!start || !end) {
    return "No shots";
  }

  const startLabel = formatDate(start);
  const endLabel = formatDate(end);
  return startLabel === endLabel ? startLabel : `${startLabel} to ${endLabel}`;
}

function buildBenefit(
  focus: CompareSampleSummary,
  baseline: CompareSampleSummary,
  delta: CompareDelta,
): CompareData["benefit"] {
  const score = benefitScore(focus, baseline, delta);
  const positives: string[] = [];
  const warnings: string[] = [];

  if (isNumber(delta.offlineDeltaYd)) {
    if (delta.offlineDeltaYd <= -2) {
      positives.push(`Offline average tightened by ${formatAbs(delta.offlineDeltaYd)} yd.`);
    } else if (delta.offlineDeltaYd >= 2) {
      warnings.push(`Offline average widened by ${formatAbs(delta.offlineDeltaYd)} yd.`);
    }
  }

  if (isNumber(delta.playableRateDelta)) {
    if (delta.playableRateDelta >= 5) {
      positives.push(`Playable rate improved by ${formatAbs(delta.playableRateDelta)} points.`);
    } else if (delta.playableRateDelta <= -5) {
      warnings.push(`Playable rate fell by ${formatAbs(delta.playableRateDelta)} points.`);
    }
  }

  if (isNumber(delta.coneDeltaYd)) {
    if (delta.coneDeltaYd <= -4) {
      positives.push(`Shot cone tightened by ${formatAbs(delta.coneDeltaYd)} yd.`);
    } else if (delta.coneDeltaYd >= 4) {
      warnings.push(`Shot cone widened by ${formatAbs(delta.coneDeltaYd)} yd.`);
    }
  }

  if (isNumber(delta.bigMissRateDelta)) {
    if (delta.bigMissRateDelta <= -4) {
      positives.push(`Big misses dropped by ${formatAbs(delta.bigMissRateDelta)} points.`);
    } else if (delta.bigMissRateDelta >= 4) {
      warnings.push(`Big misses increased by ${formatAbs(delta.bigMissRateDelta)} points.`);
    }
  }

  if (isNumber(delta.ballSpeedDeltaMph)) {
    if (delta.ballSpeedDeltaMph >= 1) {
      positives.push(`Ball speed was up ${roundOne(delta.ballSpeedDeltaMph)} mph.`);
    } else if (delta.ballSpeedDeltaMph <= -1) {
      warnings.push(`Ball speed was down ${formatAbs(delta.ballSpeedDeltaMph)} mph.`);
    }
  }

  if (focus.stockShots < 8) {
    warnings.push("Focus sample is light, so treat the signal as directional.");
  }

  if (baseline.stockShots < 8) {
    warnings.push("Baseline sample is light for this filter.");
  }

  const verdict =
    score >= 66 ? "Beneficial" : score >= 54 ? "Useful" : score >= 42 ? "Mixed" : "Review";

  return {
    score,
    verdict,
    summary:
      verdict === "Beneficial"
        ? "The focus sample is more playable and controlled against the baseline."
        : verdict === "Useful"
          ? "There are useful control gains, with at least one signal still worth watching."
          : verdict === "Mixed"
            ? "The period helped in places, but the control pattern is not clean yet."
            : "The comparison shows more risk than gain; review the miss pattern before trusting it.",
    positives: positives.length > 0 ? positives : ["No strong positive movement yet."],
    warnings: warnings.length > 0 ? warnings : ["No major red flags in the selected comparison."],
  };
}

function benefitScore(
  focus: CompareSampleSummary,
  baseline: CompareSampleSummary,
  delta: CompareDelta,
) {
  let score = 50;

  if (isNumber(delta.offlineDeltaYd)) score += clamp(-delta.offlineDeltaYd * 2, -18, 18);
  if (isNumber(delta.coneDeltaYd)) score += clamp(-delta.coneDeltaYd * 0.8, -14, 14);
  if (isNumber(delta.playableRateDelta)) score += clamp(delta.playableRateDelta * 0.35, -16, 16);
  if (isNumber(delta.bigMissRateDelta)) score += clamp(-delta.bigMissRateDelta * 0.45, -14, 14);
  if (isNumber(delta.ballSpeedDeltaMph)) score += clamp(delta.ballSpeedDeltaMph * 1.6, -8, 8);
  if (focus.stockShots < 8) score -= 8;
  if (baseline.stockShots < 8) score -= 6;

  return Math.round(clamp(score, 0, 100));
}

function sessionBreakdown(shots: CompareShot[]) {
  const bySession = groupBy(shots, (shot) => shot.sessionId);

  return [...bySession.entries()]
    .map(([id, sessionShots]) => {
      const first = sessionShots[0];
      return {
        id,
        label: first?.sessionLabel ?? "Session",
        dateLabel: first ? formatDate(first.sessionDate) : "--",
        shotCount: sessionShots.length,
      };
    })
    .sort((left, right) => right.dateLabel.localeCompare(left.dateLabel))
    .slice(0, 5);
}

function medianCarryByClub(shots: CompareShot[]) {
  const result = new Map<string, number | null>();
  const byClub = groupBy(shots, (shot) => shot.clubId);

  for (const [clubId, clubShots] of byClub.entries()) {
    result.set(
      clubId,
      roundOne(percentile(clubShots.map((shot) => shot.carryYd).filter(isNumber), 0.5)),
    );
  }

  return result;
}

function groupBy<T>(items: T[], keyFn: (item: T) => string) {
  const result = new Map<string, T[]>();

  for (const item of items) {
    const key = keyFn(item);
    const group = result.get(key) ?? [];
    group.push(item);
    result.set(key, group);
  }

  return result;
}

function latestImportedSessionShots(shots: CompareShot[]) {
  const latestShot = [...shots].sort(compareImportedSessionRecency)[0];

  if (!latestShot) {
    return [];
  }

  return shots
    .filter((shot) => shot.sessionId === latestShot.sessionId)
    .sort((left, right) => right.shotAt.getTime() - left.shotAt.getTime());
}

function compareImportedSessionRecency(left: CompareShot, right: CompareShot) {
  return (
    right.sessionCreatedAt.getTime() - left.sessionCreatedAt.getTime() ||
    right.sessionDate.getTime() - left.sessionDate.getTime() ||
    right.shotAt.getTime() - left.shotAt.getTime() ||
    (right.shotNumber ?? 0) - (left.shotNumber ?? 0)
  );
}

function playableLimit(clubType: string) {
  const family = clubFamily(clubType);
  return family === "driver"
    ? 45
    : family === "wood"
      ? 36
      : family === "hybrid"
        ? 32
        : family === "iron"
          ? 26
          : 18;
}

function bigMissLimit(clubType: string) {
  const family = clubFamily(clubType);
  return family === "driver"
    ? 35
    : family === "wood"
      ? 30
      : family === "hybrid"
        ? 26
        : family === "iron"
          ? 22
          : 16;
}

function clubFamily(clubType: string): "driver" | "wood" | "hybrid" | "iron" | "wedge" {
  if (clubType === "driver") return "driver";
  if (clubType.endsWith("w")) return "wood";
  if (clubType.endsWith("h")) return "hybrid";
  if (clubType.endsWith("i")) return "iron";
  return "wedge";
}

function primaryMiss(sideValues: number[]): "Left" | "Right" | "Balanced" | "Unknown" {
  if (sideValues.length === 0) return "Unknown";
  const left = sideValues.filter((value) => value < -5).length;
  const right = sideValues.filter((value) => value > 5).length;
  const total = sideValues.length;

  if (left / total >= 0.55) return "Left";
  if (right / total >= 0.55) return "Right";
  return "Balanced";
}

function shotConeWidth(values: number[]) {
  const p10 = percentile(values, 0.1);
  const p90 = percentile(values, 0.9);
  return isNumber(p10) && isNumber(p90) ? roundOne(p90 - p10) : null;
}

function rate<T>(items: T[], predicate: (item: T) => boolean) {
  if (items.length === 0) return null;
  return roundOne((items.filter(predicate).length / items.length) * 100);
}

function diff(left: number | null, right: number | null) {
  return isNumber(left) && isNumber(right) ? roundOne(left - right) : null;
}

function percentile(values: number[], percentileValue: number) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * percentileValue;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) return sorted[lower];

  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function mean(values: number[]) {
  return values.length > 0
    ? values.reduce((total, value) => total + value, 0) / values.length
    : null;
}

function minDate(values: Date[]) {
  return values.length > 0 ? new Date(Math.min(...values.map((value) => value.getTime()))) : null;
}

function maxDate(values: Date[]) {
  return values.length > 0 ? new Date(Math.max(...values.map((value) => value.getTime()))) : null;
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfLocalDay(date: Date) {
  const start = startOfLocalDay(date);
  return new Date(start.getTime() + DAY_MS - 1);
}

function startOfLocalWeek(date: Date) {
  const start = startOfLocalDay(date);
  const dayOffset = (start.getDay() + 6) % 7;
  return new Date(start.getTime() - dayOffset * DAY_MS);
}

function endOfLocalWeek(date: Date) {
  return endOfLocalDay(new Date(startOfLocalWeek(date).getTime() + 6 * DAY_MS));
}

function startOfLocalMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfLocalMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function parseDateInput(value: string, endOfDay = false) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return endOfDay ? endOfLocalDay(date) : startOfLocalDay(date);
}

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isBetween(date: Date, start: Date, end: Date) {
  const value = date.getTime();
  return value >= start.getTime() && value <= end.getTime();
}

function formatDate(date: Date) {
  return dateFormatter.format(date);
}

function formatSessionType(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

function emptySelection(label: string, detail: string): Selection {
  return {
    label,
    detail,
    shots: [],
    start: null,
    end: null,
  };
}

function roundOne(value: number | null) {
  return isNumber(value) ? Math.round(value * 10) / 10 : null;
}

function isNumber(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatAbs(value: number) {
  return Math.abs(roundOne(value) ?? 0).toString();
}
