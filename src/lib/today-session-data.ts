import { and, asc, desc, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";

import { clubs, sessions, shots } from "@/db/schema";
import { getDb } from "@/db/client";
import { clubSortValue, formatClubType, isTrackedClubType } from "@/lib/club-format";
import { requireCurrentUserId } from "@/lib/current-user";
import {
  detectShotDataIntegrityIssue,
  type ShotDataIntegrityIssue,
} from "@/lib/shot-data-integrity";
import { bigMissOfflineLimitYd, clubTypeImprovementScore } from "@/lib/today-club-scoring";

const APP_TIME_ZONE = "Europe/London";
const PREVIOUS_SHOT_LIMIT_PER_CLUB = 50;
const MIN_TODAY_SHOTS_FOR_VERDICT = 3;
const MIN_PREVIOUS_SHOTS_FOR_VERDICT = 5;

export type TodayPracticeFilters = {
  date?: string;
  sessionId?: string;
  scope?: "session" | "day";
  club?: string;
};

export type TodayPracticeShot = {
  id: string;
  sessionId: string;
  source: string;
  fileName: string | null;
  sessionType: string;
  courseName: string | null;
  sessionDate: Date;
  shotAt: Date;
  shotNumber: number | null;
  clubType: string;
  clubBrand: string | null;
  clubModel: string | null;
  shotCategory: string | null;
  carryYd: number | null;
  totalYd: number | null;
  sideCarryYd: number | null;
  launchDirectionDeg: number | null;
  launchAngleDeg: number | null;
  ballSpeedMph: number | null;
  clubSpeedMph: number | null;
  smashFactor: number | null;
  apexFt: number | null;
  descentAngleDeg: number | null;
  attackAngleDeg: number | null;
  clubPathDeg: number | null;
  faceAngleDeg: number | null;
  clubDataEstType: string | null;
  qualityTag: string | null;
  dataIntegrityIssue: ShotDataIntegrityIssue | null;
};

export type TodayPracticeSession = {
  id: string;
  label: string;
  type: string;
  shotCount: number;
};

export type MetricSnapshot = {
  shotCount: number;
  carryAverageYd: number | null;
  totalAverageYd: number | null;
  offlineAverageYd: number | null;
  straightRate: number | null;
  playableRate: number | null;
  bigMissRate: number | null;
  carryStdDevYd: number | null;
  carryRobustStdDevYd: number | null;
  ballSpeedAverageMph: number | null;
  smashAverage: number | null;
};

export type ClubDayComparison = {
  clubType: string;
  clubLabel: string;
  today: MetricSnapshot;
  previous: MetricSnapshot;
  carryDeltaYd: number | null;
  offlineDeltaYd: number | null;
  straightRateDelta: number | null;
  playableRateDelta: number | null;
  bigMissRateDelta: number | null;
  consistencyDeltaYd: number | null;
  ballSpeedDeltaMph: number | null;
  smashDelta: number | null;
  score: number;
  verdict: "better" | "worse" | "mixed" | "new";
  summary: string;
};

export type TodayPracticeOverall = {
  verdict: "better" | "worse" | "mixed" | "new";
  title: string;
  summary: string;
  today: MetricSnapshot;
  previous: MetricSnapshot;
  carryDeltaYd: number | null;
  offlineDeltaYd: number | null;
  straightRateDelta: number | null;
  playableRateDelta: number | null;
};

export type TodayPracticeDataCleaning = {
  importedShotCount: number;
  cleanShotCount: number;
  excludedShotCount: number;
  reasonLabel: string;
  excludedByClub: Array<{
    clubType: string;
    clubLabel: string;
    importedShotCount: number;
    cleanShotCount: number;
    excludedShotCount: number;
  }>;
  excludedByTag: Array<{
    tag: string;
    label: string;
    count: number;
  }>;
};

export type ClubBestStatus = "first" | "new" | "tied" | "none";

export type ClubMainStatMetric = {
  todayAverage: number | null;
  allTimeAverage: number | null;
  averageDelta: number | null;
  todayBest: number | null;
  allTimeBest: number | null;
  previousBest: number | null;
  bestDelta: number | null;
  bestStatus: ClubBestStatus;
};

export type ClubMainStats = {
  clubType: string;
  clubLabel: string;
  todayShotCount: number;
  allTimeShotCount: number;
  carryYd: ClubMainStatMetric;
  totalYd: ClubMainStatMetric;
  offlineYd: ClubMainStatMetric;
  ballSpeedMph: ClubMainStatMetric;
  clubSpeedMph: ClubMainStatMetric;
  smashFactor: ClubMainStatMetric;
  launchAngleDeg: ClubMainStatMetric;
  apexFt: ClubMainStatMetric;
};

export type TodayPracticeData = {
  dateKey: string;
  dateLabel: string;
  bounds: {
    start: Date;
    end: Date;
  };
  filters: {
    sessionId: string;
    club: string;
  };
  sessions: TodayPracticeSession[];
  clubs: Array<{ type: string; label: string; shotCount: number; cleanShotCount: number }>;
  shots: TodayPracticeShot[];
  rawShots: TodayPracticeShot[];
  allTodayShotCount: number;
  allCleanTodayShotCount: number;
  comparisonShots: TodayPracticeShot[];
  rawComparisonShots: TodayPracticeShot[];
  clubComparisons: ClubDayComparison[];
  rawClubComparisons: ClubDayComparison[];
  clubStats: ClubMainStats[];
  bestStraightShots: TodayPracticeShot[];
  overall: TodayPracticeOverall;
  rawOverall: TodayPracticeOverall;
  dataCleaning: TodayPracticeDataCleaning;
};

type ShotRow = TodayPracticeShot & {
  clubSort: number;
};

const EXCLUDED_PRACTICE_QUALITY_TAGS = new Set([
  "mishit",
  "top",
  "thin",
  "fat",
  "bad_data",
  "bad-data",
  "misread",
  "delete",
  "deleted",
]);

const practiceShotSelect = {
  id: shots.id,
  sessionId: shots.sessionId,
  source: sessions.source,
  fileName: sessions.fileName,
  sessionType: sessions.type,
  courseName: sessions.courseName,
  sessionDate: sessions.date,
  shotAt: shots.shotAt,
  shotNumber: shots.shotNumber,
  clubType: shots.clubType,
  clubBrand: clubs.brand,
  clubModel: clubs.model,
  shotCategory: shots.shotCategory,
  carryYd: shots.carryYd,
  totalYd: shots.totalYd,
  sideCarryYd: shots.sideCarryYd,
  launchDirectionDeg: shots.launchDirectionDeg,
  launchAngleDeg: shots.launchAngleDeg,
  ballSpeedMph: shots.ballSpeedMph,
  clubSpeedMph: shots.clubSpeedMph,
  smashFactor: shots.smashFactor,
  apexFt: shots.apexFt,
  descentAngleDeg: shots.descentAngleDeg,
  attackAngleDeg: shots.attackAngleDeg,
  clubPathDeg: shots.clubPathDeg,
  faceAngleDeg: shots.faceAngleDeg,
  clubDataEstType: shots.clubDataEstType,
  qualityTag: shots.qualityTag,
};

export async function getTodayPracticeData(
  filters: TodayPracticeFilters = {},
): Promise<TodayPracticeData> {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const requestedDate = filters.date;
  const hasExplicitDate = validDateKey(requestedDate);
  let dateKey = hasExplicitDate ? requestedDate : localDateKey(new Date());
  let defaultSessionId = "";

  if (!hasExplicitDate && filters.sessionId) {
    const sessionDateKey = await findSessionDateKey(db, userId, filters.sessionId);

    if (sessionDateKey) {
      dateKey = sessionDateKey;
      defaultSessionId = filters.sessionId;
    }
  }

  let bounds = dayBounds(dateKey);
  let allTodayRows = toShotRows(await fetchPracticeRowsForBounds(db, userId, bounds));

  if (!hasExplicitDate && !filters.sessionId && allTodayRows.length === 0) {
    const latestDateKey =
      (await findLatestPracticeDateKey(db, userId, filters.club, MIN_TODAY_SHOTS_FOR_VERDICT)) ??
      (await findLatestPracticeDateKey(db, userId, filters.club, 1));

    if (latestDateKey) {
      dateKey = latestDateKey;
      bounds = dayBounds(dateKey);
      allTodayRows = toShotRows(await fetchPracticeRowsForBounds(db, userId, bounds));
    }
  }

  const sessionIds = new Set(allTodayRows.map((shot) => shot.sessionId));
  const clubTypes = new Set(allTodayRows.map((shot) => shot.clubType).filter(isTrackedClubType));
  const scopeToSession = filters.scope !== "day";
  const sessionId =
    scopeToSession && defaultSessionId && sessionIds.has(defaultSessionId)
      ? defaultSessionId
      : scopeToSession && filters.sessionId && sessionIds.has(filters.sessionId)
        ? filters.sessionId
        : "";
  const club = filters.club && clubTypes.has(filters.club) ? filters.club : "";
  const filteredTodayRows = allTodayRows.filter((shot) => {
    if (sessionId && shot.sessionId !== sessionId) {
      return false;
    }

    if (club && shot.clubType !== club) {
      return false;
    }

    return true;
  });
  const comparisonClubTypes = [
    ...new Set(filteredTodayRows.map((shot) => shot.clubType).filter(isTrackedClubType)),
  ];
  const previousRows =
    comparisonClubTypes.length > 0
      ? await fetchPreviousPracticeRows(db, userId, bounds.start, comparisonClubTypes)
      : [];
  const previousShotRows = toShotRows(previousRows);

  return buildTodayPracticeData({
    dateKey,
    bounds,
    allTodayRows,
    filteredTodayRows,
    previousRows: previousShotRows,
    filters: { sessionId, club },
  });
}

async function fetchPracticeRowsForBounds(
  db: ReturnType<typeof getDb>,
  userId: string,
  bounds: { start: Date; end: Date },
) {
  return db
    .select(practiceShotSelect)
    .from(shots)
    .innerJoin(sessions, eq(shots.sessionId, sessions.id))
    .innerJoin(clubs, eq(shots.clubId, clubs.id))
    .where(
      and(
        eq(shots.userId, userId),
        eq(sessions.userId, userId),
        eq(clubs.userId, userId),
        gte(shots.shotAt, bounds.start),
        lt(shots.shotAt, bounds.end),
      ),
    )
    .orderBy(asc(sessions.date), asc(sessions.fileName), asc(shots.shotNumber));
}

async function fetchPreviousPracticeRows(
  db: ReturnType<typeof getDb>,
  userId: string,
  before: Date,
  clubTypes: string[],
) {
  const rankedPreviousShots = db
    .select({
      ...practiceShotSelect,
      clubRank: sql<number>`row_number() over (
        partition by ${shots.clubType}
        order by ${shots.shotAt} desc, ${shots.shotNumber} desc nulls last
      )`.as("club_rank"),
    })
    .from(shots)
    .innerJoin(sessions, eq(shots.sessionId, sessions.id))
    .innerJoin(clubs, eq(shots.clubId, clubs.id))
    .where(
      and(
        eq(shots.userId, userId),
        eq(sessions.userId, userId),
        eq(clubs.userId, userId),
        lt(shots.shotAt, before),
        inArray(shots.clubType, clubTypes),
      ),
    )
    .as("ranked_previous_shots");

  return db
    .select({
      id: rankedPreviousShots.id,
      sessionId: rankedPreviousShots.sessionId,
      source: rankedPreviousShots.source,
      fileName: rankedPreviousShots.fileName,
      sessionType: rankedPreviousShots.sessionType,
      courseName: rankedPreviousShots.courseName,
      sessionDate: rankedPreviousShots.sessionDate,
      shotAt: rankedPreviousShots.shotAt,
      shotNumber: rankedPreviousShots.shotNumber,
      clubType: rankedPreviousShots.clubType,
      clubBrand: rankedPreviousShots.clubBrand,
      clubModel: rankedPreviousShots.clubModel,
      shotCategory: rankedPreviousShots.shotCategory,
      carryYd: rankedPreviousShots.carryYd,
      totalYd: rankedPreviousShots.totalYd,
      sideCarryYd: rankedPreviousShots.sideCarryYd,
      launchDirectionDeg: rankedPreviousShots.launchDirectionDeg,
      launchAngleDeg: rankedPreviousShots.launchAngleDeg,
      ballSpeedMph: rankedPreviousShots.ballSpeedMph,
      clubSpeedMph: rankedPreviousShots.clubSpeedMph,
      smashFactor: rankedPreviousShots.smashFactor,
      apexFt: rankedPreviousShots.apexFt,
      descentAngleDeg: rankedPreviousShots.descentAngleDeg,
      attackAngleDeg: rankedPreviousShots.attackAngleDeg,
      clubPathDeg: rankedPreviousShots.clubPathDeg,
      faceAngleDeg: rankedPreviousShots.faceAngleDeg,
      clubDataEstType: rankedPreviousShots.clubDataEstType,
      qualityTag: rankedPreviousShots.qualityTag,
    })
    .from(rankedPreviousShots)
    .where(lte(rankedPreviousShots.clubRank, PREVIOUS_SHOT_LIMIT_PER_CLUB))
    .orderBy(desc(rankedPreviousShots.shotAt), desc(rankedPreviousShots.shotNumber));
}

async function findSessionDateKey(db: ReturnType<typeof getDb>, userId: string, sessionId: string) {
  const [session] = await db
    .select({ date: sessions.date })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), eq(sessions.id, sessionId)))
    .limit(1);

  return session ? localDateKey(session.date) : null;
}

async function findLatestPracticeDateKey(
  db: ReturnType<typeof getDb>,
  userId: string,
  clubFilter: string | undefined,
  minimumShotCount: number,
) {
  const clauses = [eq(shots.userId, userId), eq(sessions.userId, userId), eq(clubs.userId, userId)];
  const club = clubFilter && isTrackedClubType(clubFilter) ? clubFilter : "";
  const practiceDateKey = sql<string>`to_char(${shots.shotAt} at time zone 'Europe/London', 'YYYY-MM-DD')`;
  const latestShotAt = sql<Date>`max(${shots.shotAt})`;

  if (club) {
    clauses.push(eq(shots.clubType, club));
  }

  const [practiceDay] = await db
    .select({
      dateKey: practiceDateKey,
      latestShotAt,
      shotCount: sql<number>`count(${shots.id})::int`,
    })
    .from(shots)
    .innerJoin(sessions, eq(shots.sessionId, sessions.id))
    .innerJoin(clubs, eq(shots.clubId, clubs.id))
    .where(and(...clauses))
    .groupBy(practiceDateKey)
    .having(sql`count(${shots.id}) >= ${minimumShotCount}`)
    .orderBy(desc(latestShotAt))
    .limit(1);

  return practiceDay?.dateKey ?? null;
}

function buildTodayPracticeData({
  dateKey,
  bounds,
  allTodayRows,
  filteredTodayRows,
  previousRows,
  filters,
}: {
  dateKey: string;
  bounds: { start: Date; end: Date };
  allTodayRows: ShotRow[];
  filteredTodayRows: ShotRow[];
  previousRows: ShotRow[];
  filters: { sessionId: string; club: string };
}): TodayPracticeData {
  const sessions = sessionOptions(allTodayRows);
  const clubsForFilter = clubOptions(allTodayRows);
  const cleanTodayRows = filteredTodayRows.filter(isCleanPracticeShot);
  const cleanAllTodayRows = allTodayRows.filter(isCleanPracticeShot);
  const comparisonShots = cleanTodayRows.filter(isComparisonShot);
  const rawComparisonShots = filteredTodayRows.filter(isRawComparisonShot);
  const previousByClub = groupBy(previousRows.filter(isComparisonShot), (shot) => shot.clubType);
  const todayByClub = groupBy(comparisonShots, (shot) => shot.clubType);
  const rawTodayByClub = groupBy(rawComparisonShots, (shot) => shot.clubType);
  const allTimeRows = [...previousRows, ...cleanAllTodayRows].filter(
    (shot) => isComparisonShot(shot) && todayByClub.has(shot.clubType),
  );
  const allTimeByClub = groupBy(allTimeRows, (shot) => shot.clubType);
  const clubComparisons = [...todayByClub.entries()]
    .map(([clubType, todayShots]) => {
      const previousShots = (previousByClub.get(clubType) ?? []).slice(
        0,
        PREVIOUS_SHOT_LIMIT_PER_CLUB,
      );
      return compareClubDay(clubType, todayShots, previousShots);
    })
    .sort((left, right) => clubSortValue(left.clubType) - clubSortValue(right.clubType));
  const rawClubComparisons = [...rawTodayByClub.entries()]
    .map(([clubType, todayShots]) => {
      const previousShots = (previousByClub.get(clubType) ?? []).slice(
        0,
        PREVIOUS_SHOT_LIMIT_PER_CLUB,
      );
      return compareClubDay(clubType, todayShots, previousShots);
    })
    .sort((left, right) => clubSortValue(left.clubType) - clubSortValue(right.clubType));
  const clubStats = [...todayByClub.entries()]
    .map(([clubType, todayShots]) =>
      buildClubMainStats(
        clubType,
        todayShots,
        allTimeByClub.get(clubType) ?? [],
        previousByClub.get(clubType) ?? [],
      ),
    )
    .sort((left, right) => clubSortValue(left.clubType) - clubSortValue(right.clubType));
  const previousComparableShots = clubComparisons.flatMap((comparison) =>
    (previousByClub.get(comparison.clubType) ?? []).slice(0, PREVIOUS_SHOT_LIMIT_PER_CLUB),
  );
  const today = snapshot(comparisonShots);
  const rawToday = snapshot(rawComparisonShots);
  const previous = snapshot(previousComparableShots);
  const overall = buildOverallComparison(clubComparisons, today, previous);
  const rawOverall = buildOverallComparison(rawClubComparisons, rawToday, previous);

  return {
    dateKey,
    dateLabel: formatDateLabel(dateKey),
    bounds,
    filters,
    sessions,
    clubs: clubsForFilter,
    shots: cleanTodayRows,
    rawShots: filteredTodayRows,
    allTodayShotCount: allTodayRows.length,
    allCleanTodayShotCount: cleanAllTodayRows.length,
    comparisonShots,
    rawComparisonShots,
    clubComparisons,
    rawClubComparisons,
    clubStats,
    bestStraightShots: bestStraightShots(cleanTodayRows),
    overall,
    rawOverall,
    dataCleaning: buildDataCleaningSummary(filteredTodayRows, cleanTodayRows),
  };
}

function compareClubDay(
  clubType: string,
  todayShots: TodayPracticeShot[],
  previousShots: TodayPracticeShot[],
): ClubDayComparison {
  const today = snapshot(todayShots);
  const previous = snapshot(previousShots);
  const carryDeltaYd = delta(today.carryAverageYd, previous.carryAverageYd);
  const offlineDeltaYd = delta(today.offlineAverageYd, previous.offlineAverageYd);
  const straightRateDelta = delta(today.straightRate, previous.straightRate);
  const playableRateDelta = delta(today.playableRate, previous.playableRate);
  const bigMissRateDelta = delta(today.bigMissRate, previous.bigMissRate);
  const consistencyDeltaYd = delta(today.carryStdDevYd, previous.carryStdDevYd);
  const ballSpeedDeltaMph = delta(today.ballSpeedAverageMph, previous.ballSpeedAverageMph);
  const smashDelta = delta(today.smashAverage, previous.smashAverage);
  const score = improvementScore({
    clubType,
    today,
    previous,
    carryDeltaYd,
    offlineDeltaYd,
    straightRateDelta,
    playableRateDelta,
    bigMissRateDelta,
    consistencyDeltaYd,
    ballSpeedDeltaMph,
    smashDelta,
  });
  const verdict =
    today.shotCount < MIN_TODAY_SHOTS_FOR_VERDICT ||
    previous.shotCount < MIN_PREVIOUS_SHOTS_FOR_VERDICT
      ? "new"
      : score >= 2
        ? "better"
        : score <= -2
          ? "worse"
          : "mixed";

  return {
    clubType,
    clubLabel: formatClubType(clubType),
    today,
    previous,
    carryDeltaYd,
    offlineDeltaYd,
    straightRateDelta,
    playableRateDelta,
    bigMissRateDelta,
    consistencyDeltaYd,
    ballSpeedDeltaMph,
    smashDelta,
    score,
    verdict,
    summary: clubSummary({
      verdict,
      carryDeltaYd,
      offlineDeltaYd,
      straightRateDelta,
      consistencyDeltaYd,
      previousShotCount: previous.shotCount,
    }),
  };
}

function buildClubMainStats(
  clubType: string,
  todayShots: TodayPracticeShot[],
  allTimeShots: TodayPracticeShot[],
  previousShots: TodayPracticeShot[],
): ClubMainStats {
  return {
    clubType,
    clubLabel: formatClubType(clubType),
    todayShotCount: todayShots.length,
    allTimeShotCount: allTimeShots.length,
    carryYd: statMetric(
      todayShots,
      allTimeShots,
      previousShots,
      (shot) => shot.carryYd,
      "max",
      "one",
    ),
    totalYd: statMetric(
      todayShots,
      allTimeShots,
      previousShots,
      (shot) => shot.totalYd,
      "max",
      "one",
    ),
    offlineYd: statMetric(
      todayShots,
      allTimeShots,
      previousShots,
      (shot) => (isNumber(shot.sideCarryYd) ? Math.abs(shot.sideCarryYd) : null),
      "min",
      "one",
    ),
    ballSpeedMph: statMetric(
      todayShots,
      allTimeShots,
      previousShots,
      (shot) => shot.ballSpeedMph,
      "max",
      "one",
    ),
    clubSpeedMph: statMetric(
      todayShots,
      allTimeShots,
      previousShots,
      (shot) => shot.clubSpeedMph,
      "max",
      "one",
    ),
    smashFactor: statMetric(
      todayShots,
      allTimeShots,
      previousShots,
      (shot) => shot.smashFactor,
      "max",
      "two",
    ),
    launchAngleDeg: statMetric(
      todayShots,
      allTimeShots,
      previousShots,
      (shot) => shot.launchAngleDeg,
      "max",
      "one",
    ),
    apexFt: statMetric(
      todayShots,
      allTimeShots,
      previousShots,
      (shot) => shot.apexFt,
      "max",
      "one",
    ),
  };
}

function statMetric(
  todayShots: TodayPracticeShot[],
  allTimeShots: TodayPracticeShot[],
  previousShots: TodayPracticeShot[],
  readValue: (shot: TodayPracticeShot) => number | null,
  bestDirection: "max" | "min",
  precision: "one" | "two",
): ClubMainStatMetric {
  const todayValues = values(todayShots.map(readValue));
  const allTimeValues = values(allTimeShots.map(readValue));
  const previousValues = values(previousShots.map(readValue));
  const todayAverage = roundByPrecision(mean(todayValues), precision);
  const allTimeAverage = roundByPrecision(mean(allTimeValues), precision);
  const todayBest = roundByPrecision(bestValue(todayValues, bestDirection), precision);
  const allTimeBest = roundByPrecision(bestValue(allTimeValues, bestDirection), precision);
  const previousBest = roundByPrecision(bestValue(previousValues, bestDirection), precision);

  return {
    todayAverage,
    allTimeAverage,
    averageDelta: roundedDelta(todayAverage, allTimeAverage, precision),
    todayBest,
    allTimeBest,
    previousBest,
    bestDelta: roundedDelta(todayBest, allTimeBest, precision),
    bestStatus: bestStatus(todayBest, previousBest, bestDirection),
  };
}

function buildOverallComparison(
  clubComparisons: ClubDayComparison[],
  today: MetricSnapshot,
  previous: MetricSnapshot,
): TodayPracticeOverall {
  const comparable = clubComparisons.filter(
    (comparison) =>
      comparison.today.shotCount >= MIN_TODAY_SHOTS_FOR_VERDICT &&
      comparison.previous.shotCount >= MIN_PREVIOUS_SHOTS_FOR_VERDICT,
  );
  const carryDeltaYd = delta(today.carryAverageYd, previous.carryAverageYd);
  const offlineDeltaYd = delta(today.offlineAverageYd, previous.offlineAverageYd);
  const straightRateDelta = delta(today.straightRate, previous.straightRate);
  const playableRateDelta = delta(today.playableRate, previous.playableRate);

  if (today.shotCount === 0) {
    return {
      verdict: "new",
      title: "No comparison shots yet",
      summary: "Import or select a session with tracked full shots.",
      today,
      previous,
      carryDeltaYd,
      offlineDeltaYd,
      straightRateDelta,
      playableRateDelta,
    };
  }

  if (comparable.length === 0) {
    return {
      verdict: "new",
      title: "Baseline still building",
      summary:
        "This practice day is visible, but there are not enough previous shots for the same clubs to call better or worse yet.",
      today,
      previous,
      carryDeltaYd,
      offlineDeltaYd,
      straightRateDelta,
      playableRateDelta,
    };
  }

  const weightedScore =
    comparable.reduce(
      (total, comparison) => total + comparison.score * comparison.today.shotCount,
      0,
    ) / comparable.reduce((total, comparison) => total + comparison.today.shotCount, 0);
  const verdict = weightedScore >= 1.2 ? "better" : weightedScore <= -1.2 ? "worse" : "mixed";

  return {
    verdict,
    title:
      verdict === "better"
        ? "Better than your previous baseline"
        : verdict === "worse"
          ? "Behind your previous baseline"
          : "Mixed session",
    summary: overallSummary({ verdict, offlineDeltaYd, straightRateDelta, carryDeltaYd }),
    today,
    previous,
    carryDeltaYd,
    offlineDeltaYd,
    straightRateDelta,
    playableRateDelta,
  };
}

function improvementScore(input: {
  clubType: string;
  today: MetricSnapshot;
  previous: MetricSnapshot;
  carryDeltaYd: number | null;
  offlineDeltaYd: number | null;
  straightRateDelta: number | null;
  playableRateDelta: number | null;
  bigMissRateDelta: number | null;
  consistencyDeltaYd: number | null;
  ballSpeedDeltaMph: number | null;
  smashDelta: number | null;
}) {
  if (
    input.today.shotCount < MIN_TODAY_SHOTS_FOR_VERDICT ||
    input.previous.shotCount < MIN_PREVIOUS_SHOTS_FOR_VERDICT
  ) {
    return 0;
  }

  return clubTypeImprovementScore(input.clubType, {
    carryDeltaYd: input.carryDeltaYd,
    offlineDeltaYd: input.offlineDeltaYd,
    straightRateDelta: input.straightRateDelta,
    playableRateDelta: input.playableRateDelta,
    bigMissRateDelta: input.bigMissRateDelta,
    consistencyDeltaYd: input.consistencyDeltaYd,
  });
}

function snapshot(shots: TodayPracticeShot[]): MetricSnapshot {
  const carryValues = values(shots.map((shot) => shot.carryYd));
  const totalValues = values(shots.map((shot) => shot.totalYd));
  const offlineValues = values(
    shots.map((shot) => shot.sideCarryYd).map((value) => (value === null ? null : Math.abs(value))),
  );
  const ballSpeedValues = values(shots.map((shot) => shot.ballSpeedMph));
  const smashValues = values(shots.map((shot) => shot.smashFactor));
  const directionalShots = shots.filter(
    (shot) => isNumber(shot.sideCarryYd) || isNumber(shot.launchDirectionDeg),
  );
  const bigMissShots = shots.filter(
    (shot) =>
      isNumber(shot.sideCarryYd) &&
      Math.abs(shot.sideCarryYd) > bigMissOfflineLimitYd(shot.clubType),
  );

  return {
    shotCount: shots.length,
    carryAverageYd: roundOne(mean(carryValues)),
    totalAverageYd: roundOne(mean(totalValues)),
    offlineAverageYd: roundOne(mean(offlineValues)),
    straightRate:
      directionalShots.length > 0
        ? percent(directionalShots.filter(isStraightShot).length, directionalShots.length)
        : null,
    playableRate:
      directionalShots.length > 0
        ? percent(directionalShots.filter(isPlayableShot).length, directionalShots.length)
        : null,
    bigMissRate:
      directionalShots.length > 0 ? percent(bigMissShots.length, directionalShots.length) : null,
    carryStdDevYd: roundOne(stddev(carryValues)),
    carryRobustStdDevYd: roundOne(trimmedStddev(carryValues)),
    ballSpeedAverageMph: roundOne(mean(ballSpeedValues)),
    smashAverage: roundTwo(mean(smashValues)),
  };
}

function bestStraightShots(shots: TodayPracticeShot[]) {
  return [...shots]
    .filter((shot) => isNumber(shot.sideCarryYd) || isNumber(shot.launchDirectionDeg))
    .sort((left, right) => straightShotScore(left) - straightShotScore(right))
    .slice(0, 8);
}

function straightShotScore(shot: TodayPracticeShot) {
  const offline = Math.abs(shot.sideCarryYd ?? 999);
  const startLine = Math.abs(shot.launchDirectionDeg ?? 0);
  const carryBonus = (shot.carryYd ?? 0) / 100;
  return offline + startLine * 2 - carryBonus;
}

function isComparisonShot(shot: TodayPracticeShot) {
  if (!isCleanPracticeShot(shot)) {
    return false;
  }

  return isRawComparisonShot(shot);
}

function isRawComparisonShot(shot: TodayPracticeShot) {
  if (!isTrackedClubType(shot.clubType)) {
    return false;
  }

  if (shot.shotCategory === "chip" || shot.shotCategory === "recovery") {
    return false;
  }

  return isNumber(shot.carryYd) || isNumber(shot.sideCarryYd) || isNumber(shot.ballSpeedMph);
}

function isCleanPracticeShot(shot: Pick<TodayPracticeShot, "qualityTag" | "dataIntegrityIssue">) {
  return !isExcludedPracticeQualityTag(shot.qualityTag) && shot.dataIntegrityIssue === null;
}

export function isExcludedPracticeQualityTag(qualityTag: string | null | undefined) {
  const normalized = qualityTag?.trim().toLowerCase();
  return Boolean(normalized && EXCLUDED_PRACTICE_QUALITY_TAGS.has(normalized));
}

function buildDataCleaningSummary(
  rawShots: TodayPracticeShot[],
  cleanShots: TodayPracticeShot[],
): TodayPracticeDataCleaning {
  const cleanIds = new Set(cleanShots.map((shot) => shot.id));
  const excludedShots = rawShots.filter((shot) => !cleanIds.has(shot.id));
  const rawByClub = groupBy(
    rawShots.filter((shot) => isTrackedClubType(shot.clubType)),
    (shot) => shot.clubType,
  );
  const cleanByClub = groupBy(
    cleanShots.filter((shot) => isTrackedClubType(shot.clubType)),
    (shot) => shot.clubType,
  );
  const excludedByClub = [...rawByClub.entries()]
    .map(([clubType, clubShots]) => {
      const cleanShotCount = cleanByClub.get(clubType)?.length ?? 0;

      return {
        clubType,
        clubLabel: formatClubType(clubType),
        importedShotCount: clubShots.length,
        cleanShotCount,
        excludedShotCount: clubShots.length - cleanShotCount,
      };
    })
    .filter((item) => item.excludedShotCount > 0)
    .sort(
      (left, right) =>
        right.excludedShotCount - left.excludedShotCount ||
        clubSortValue(left.clubType) - clubSortValue(right.clubType),
    );
  const tagCounts = new Map<string, number>();

  for (const shot of excludedShots) {
    const tag = (shot.dataIntegrityIssue ?? shot.qualityTag?.trim().toLowerCase()) || "excluded";
    tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }

  const excludedByTag = [...tagCounts.entries()]
    .map(([tag, count]) => ({ tag, label: qualityTagLabel(tag), count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));

  return {
    importedShotCount: rawShots.length,
    cleanShotCount: cleanShots.length,
    excludedShotCount: excludedShots.length,
    reasonLabel:
      excludedByTag.length > 0 ? excludedByTag.map((item) => item.label).join(", ") : "None",
    excludedByClub,
    excludedByTag,
  };
}

function qualityTagLabel(tag: string) {
  switch (tag) {
    case "top":
      return "topped / non-clean strike";
    case "thin":
      return "thin strike";
    case "fat":
      return "fat strike";
    case "mishit":
      return "mishit";
    case "bad-data":
    case "bad_data":
      return "bad data";
    case "misread":
      return "misread";
    case "trajectory-review":
      return "trajectory review";
    case "delete":
    case "deleted":
      return "excluded";
    default:
      return tag.replace(/[-_]+/g, " ");
  }
}

function isStraightShot(shot: TodayPracticeShot) {
  const sideOk = isNumber(shot.sideCarryYd) ? Math.abs(shot.sideCarryYd) <= 10 : true;
  const startOk = isNumber(shot.launchDirectionDeg)
    ? Math.abs(shot.launchDirectionDeg) <= 3.5
    : true;
  return sideOk && startOk;
}

function isPlayableShot(shot: TodayPracticeShot) {
  if (!isNumber(shot.sideCarryYd)) {
    return false;
  }

  return Math.abs(shot.sideCarryYd) <= playableLimit(shot.clubType);
}

function playableLimit(clubType: string) {
  if (clubType === "driver") return 45;
  if (clubType.endsWith("w")) return 36;
  if (clubType.endsWith("h")) return 32;
  if (clubType.endsWith("i")) return 26;
  return 18;
}

function sessionOptions(shots: ShotRow[]): TodayPracticeSession[] {
  const bySession = groupBy(shots, (shot) => shot.sessionId);

  return [...bySession.entries()].map(([id, sessionShots]) => {
    const firstShot = sessionShots[0];

    return {
      id,
      label: firstShot?.fileName ?? firstShot?.courseName ?? "Untitled session",
      type: firstShot?.sessionType ?? "range",
      shotCount: sessionShots.length,
    };
  });
}

function clubOptions(shots: ShotRow[]) {
  const byClub = groupBy(
    shots.filter((shot) => isTrackedClubType(shot.clubType)),
    (shot) => shot.clubType,
  );

  return [...byClub.entries()]
    .map(([type, clubShots]) => ({
      type,
      label: formatClubType(type),
      shotCount: clubShots.length,
      cleanShotCount: clubShots.filter(isCleanPracticeShot).length,
    }))
    .sort((left, right) => clubSortValue(left.type) - clubSortValue(right.type));
}

function toShotRows<T extends Omit<TodayPracticeShot, "clubSort" | "dataIntegrityIssue">>(
  rows: T[],
): ShotRow[] {
  return rows.map((row) => ({
    ...row,
    dataIntegrityIssue: detectShotDataIntegrityIssue(row),
    clubSort: clubSortValue(row.clubType),
  }));
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const groupKey = key(item);
    const group = groups.get(groupKey) ?? [];
    group.push(item);
    groups.set(groupKey, group);
  }

  return groups;
}

function clubSummary({
  verdict,
  carryDeltaYd,
  offlineDeltaYd,
  straightRateDelta,
  consistencyDeltaYd,
  previousShotCount,
}: {
  verdict: ClubDayComparison["verdict"];
  carryDeltaYd: number | null;
  offlineDeltaYd: number | null;
  straightRateDelta: number | null;
  consistencyDeltaYd: number | null;
  previousShotCount: number;
}) {
  if (verdict === "new") {
    return previousShotCount > 0
      ? "Need a few more review shots for a fair call."
      : "No previous baseline for this club yet.";
  }

  const signals = [
    isNumber(offlineDeltaYd)
      ? `${offlineDeltaYd <= 0 ? "offline down" : "offline up"} ${Math.abs(offlineDeltaYd).toFixed(1)} yd`
      : null,
    isNumber(straightRateDelta) ? `straight rate ${formatDelta(straightRateDelta, "pp")}` : null,
    isNumber(carryDeltaYd) ? `carry ${formatDelta(carryDeltaYd, "yd")}` : null,
    isNumber(consistencyDeltaYd)
      ? `carry spread ${consistencyDeltaYd <= 0 ? "down" : "up"} ${Math.abs(consistencyDeltaYd).toFixed(1)} yd`
      : null,
  ].filter(Boolean);

  return signals.slice(0, 3).join(" / ");
}

function overallSummary({
  verdict,
  offlineDeltaYd,
  straightRateDelta,
  carryDeltaYd,
}: {
  verdict: TodayPracticeData["overall"]["verdict"];
  offlineDeltaYd: number | null;
  straightRateDelta: number | null;
  carryDeltaYd: number | null;
}) {
  const parts = [
    isNumber(offlineDeltaYd)
      ? `${offlineDeltaYd <= 0 ? "offline was better by" : "offline was worse by"} ${Math.abs(offlineDeltaYd).toFixed(1)} yd`
      : null,
    isNumber(straightRateDelta)
      ? `straight-shot rate ${formatDelta(straightRateDelta, "pp")}`
      : null,
    isNumber(carryDeltaYd) ? `carry ${formatDelta(carryDeltaYd, "yd")}` : null,
  ].filter(Boolean);

  if (parts.length === 0) {
    return verdict === "mixed"
      ? "Some clubs improved and some went backwards."
      : "Not enough comparable launch-monitor fields to explain the movement.";
  }

  return parts.join(" / ");
}

function formatDelta(value: number, unit: "yd" | "mph" | "pp") {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)} ${unit}`;
}

function localDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function dayBounds(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const start = zonedLocalToUtc(year, month, day);
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1, 12));
  const nextDateKey = localDateKey(nextDay);
  const [nextYear, nextMonth, nextDayOfMonth] = nextDateKey.split("-").map(Number);

  return {
    start,
    end: zonedLocalToUtc(nextYear, nextMonth, nextDayOfMonth),
  };
}

function zonedLocalToUtc(year: number, month: number, day: number) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const offsetMs = timeZoneOffsetMs(utcGuess);
  return new Date(utcGuess.getTime() - offsetMs);
}

function timeZoneOffsetMs(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour"),
    value("minute"),
    value("second"),
  );

  return asUtc - date.getTime();
}

function formatDateLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function validDateKey(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function values(items: Array<number | null>) {
  return items.filter(isNumber);
}

function mean(items: number[]) {
  if (items.length === 0) {
    return null;
  }

  return items.reduce((total, item) => total + item, 0) / items.length;
}

function stddev(items: number[]) {
  if (items.length < 2) {
    return null;
  }

  const average = mean(items);
  if (!isNumber(average)) {
    return null;
  }

  const variance = items.reduce((total, item) => total + (item - average) ** 2, 0) / items.length;
  return Math.sqrt(variance);
}

function trimmedStddev(items: number[]) {
  if (items.length < 5) {
    return stddev(items);
  }

  const sorted = [...items].sort((left, right) => left - right);
  const trimCount = Math.max(1, Math.floor(sorted.length * 0.1));
  const trimmed = sorted.slice(trimCount, sorted.length - trimCount);

  return trimmed.length >= 2 ? stddev(trimmed) : stddev(items);
}

function percent(value: number, total: number) {
  return total <= 0 ? null : roundOne((value / total) * 100);
}

function delta(current: number | null, previous: number | null) {
  return isNumber(current) && isNumber(previous) ? roundOne(current - previous) : null;
}

function roundedDelta(current: number | null, previous: number | null, precision: "one" | "two") {
  return isNumber(current) && isNumber(previous)
    ? roundByPrecision(current - previous, precision)
    : null;
}

function bestValue(items: number[], direction: "max" | "min") {
  if (items.length === 0) {
    return null;
  }

  return items.reduce(
    (best, item) => {
      if (!isNumber(best)) {
        return item;
      }

      return direction === "max" ? Math.max(best, item) : Math.min(best, item);
    },
    null as number | null,
  );
}

function bestStatus(
  todayBest: number | null,
  previousBest: number | null,
  direction: "max" | "min",
): ClubBestStatus {
  if (!isNumber(todayBest)) {
    return "none";
  }

  if (!isNumber(previousBest)) {
    return "first";
  }

  if (direction === "max") {
    if (todayBest > previousBest) return "new";
    if (todayBest === previousBest) return "tied";
    return "none";
  }

  if (todayBest < previousBest) return "new";
  if (todayBest === previousBest) return "tied";
  return "none";
}

function roundByPrecision(value: number | null, precision: "one" | "two") {
  return precision === "two" ? roundTwo(value) : roundOne(value);
}

function roundOne(value: number | null) {
  return isNumber(value) ? Math.round(value * 10) / 10 : null;
}

function roundTwo(value: number | null) {
  return isNumber(value) ? Math.round(value * 100) / 100 : null;
}

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
