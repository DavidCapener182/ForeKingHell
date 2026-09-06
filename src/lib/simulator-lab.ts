import "server-only";

import { directionalMetricSql } from "@/lib/directional-confidence-sql";

import { and, asc, desc, eq, gte, inArray, lt, ne, or, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import { clubEquipmentHistory, clubs, sessions, shots } from "@/db/schema";
import { clubSortValue, formatClubType, isTrackedClubType } from "@/lib/club-format";
import { requireCurrentUserId } from "@/lib/current-user";
import {
  isManageableTopEndGap,
  isMissingYardageWindowGap,
  isScoringEndGap,
} from "@/lib/gapping-windows";
import { isShotEvidenceEligible } from "@/lib/shot-review";
import { calculateStockYardage, type StockShot } from "@/lib/stock-yardage";
import { getRangeRealityHandicapData, type RangeRealityHandicapData } from "@/lib/reality-handicap";

export type SimulatorLabTone = "green" | "sky" | "amber" | "pink" | "slate";

export type SimulatorLabSession = {
  id: string;
  source: string;
  type: string;
  date: Date;
  fileName: string | null;
};

export type SimulatorLabShot = StockShot & {
  id: string;
  sessionId: string;
  clubId: string;
  clubType: string;
  shotAt: Date;
  clubSpeedMph: number | null;
  smashFactor: number | null;
  sessionType: string | null;
  source: string | null;
};

export type GappingMatrixRow = {
  clubId: string;
  clubType: string;
  clubLabel: string;
  brandModel: string;
  recommendedCarryYd: number | null;
  bestStockCarryYd: number | null;
  latestReliableCarryYd: number | null;
  latestReliableCarryP25Yd: number | null;
  latestReliableCarryP75Yd: number | null;
  sampleSize: number;
  confidenceScore: number;
  confidenceLabel: string;
  gapToNextYd: number | null;
  nextClubType: string | null;
  gapStatus: "building" | "overlap" | "danger" | "watch" | "ok" | "top-ok";
  gapLabel: string;
  gapDetail: string;
  tone: SimulatorLabTone;
};

export type SessionDeltaRow = {
  clubType: string;
  clubLabel: string;
  latestShotCount: number;
  baselineShotCount: number;
  carryDeltaYd: number | null;
  ballSpeedDeltaMph: number | null;
  smashDelta: number | null;
  offlineDeltaYd: number | null;
  carrySpreadDeltaYd: number | null;
  verdict: "better" | "worse" | "mixed" | "building";
  summary: string;
  tone: SimulatorLabTone;
};

export type EquipmentChangeImpact = {
  id: string;
  clubId: string;
  clubType: string;
  clubLabel: string;
  equipmentLabel: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  beforeShotCount: number;
  afterShotCount: number;
  carryDeltaYd: number | null;
  ballSpeedDeltaMph: number | null;
  smashDelta: number | null;
  offlineDeltaYd: number | null;
  verdict: "helped" | "hurt" | "mixed" | "building";
  detail: string;
  tone: SimulatorLabTone;
};

export type SessionRoastFact = {
  label: string;
  value: string;
  detail: string;
  severity: "mild" | "medium" | "spicy";
};

export type SimulatorLabData = {
  latestSession: SimulatorLabSession | null;
  dataIssues?: string[];
  rangeReality: RangeRealityHandicapData;
  totals: {
    activeClubs: number;
    gappingRows: number;
    latestSessionShots: number;
    gapFlags: number;
    positiveDeltas: number;
    equipmentChanges: number;
  };
  gappingRows: GappingMatrixRow[];
  sessionDeltas: SessionDeltaRow[];
  equipmentImpacts: EquipmentChangeImpact[];
  roastFacts: SessionRoastFact[];
};

export type SimulatorLabClub = {
  id: string;
  type: string;
  brand: string | null;
  model: string | null;
};

export type EquipmentHistoryRow = {
  id: string;
  clubId: string;
  clubType: string;
  clubBrand: string | null;
  clubModel: string | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  loftDeg: number | null;
  lieDeg: number | null;
  shaft: string | null;
  swingWeight: string | null;
  notes: string | null;
};

type MetricSnapshot = {
  shotCount: number;
  carryAverageYd: number | null;
  ballSpeedAverageMph: number | null;
  smashAverage: number | null;
  offlineAverageYd: number | null;
  carrySpreadYd: number | null;
};

const MAX_STOCK_SHOTS = 2500;
const MAX_EQUIPMENT_HISTORY = 200;
const BASELINE_DAYS = 30;
const MIN_LATEST_SHOTS_FOR_VERDICT = 3;
const MIN_BASELINE_SHOTS_FOR_VERDICT = 5;

export async function getSimulatorLabData(userId?: string): Promise<SimulatorLabData> {
  userId ??= await requireCurrentUserId();
  const db = getDb();
  const [clubRows, latestSessionRows] = await Promise.all([
    db
      .select({
        id: clubs.id,
        type: clubs.type,
        brand: clubs.brand,
        model: clubs.model,
      })
      .from(clubs)
      .where(and(eq(clubs.userId, userId), eq(clubs.active, true)))
      .orderBy(asc(clubs.type)),
    db
      .select({
        id: sessions.id,
        source: sessions.source,
        type: sessions.type,
        date: sessions.date,
        fileName: sessions.fileName,
      })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), inArray(sessions.type, simulatorSessionTypes())))
      .orderBy(desc(sessions.date))
      .limit(1),
  ]);
  let historyRows: EquipmentHistoryRow[] = [];
  let equipmentHistoryIssue: string | null = null;

  try {
    historyRows = await db
      .select({
        id: clubEquipmentHistory.id,
        clubId: clubEquipmentHistory.clubId,
        clubType: clubs.type,
        clubBrand: clubs.brand,
        clubModel: clubs.model,
        effectiveFrom: clubEquipmentHistory.effectiveFrom,
        effectiveTo: clubEquipmentHistory.effectiveTo,
        loftDeg: clubEquipmentHistory.loftDeg,
        lieDeg: clubEquipmentHistory.lieDeg,
        shaft: clubEquipmentHistory.shaft,
        swingWeight: clubEquipmentHistory.swingWeight,
        notes: clubEquipmentHistory.notes,
      })
      .from(clubEquipmentHistory)
      .innerJoin(clubs, eq(clubs.id, clubEquipmentHistory.clubId))
      .where(eq(clubEquipmentHistory.userId, userId))
      .orderBy(desc(clubEquipmentHistory.effectiveFrom))
      .limit(MAX_EQUIPMENT_HISTORY);
  } catch {
    equipmentHistoryIssue =
      "Equipment history was unavailable for this render, so equipment impact is hidden until the query recovers.";
  }
  const activeClubs = clubRows.filter((club) => isTrackedClubType(club.type));
  const latestSession = latestSessionRows[0] ?? null;
  const clubIds = activeClubs.map((club) => club.id);

  if (clubIds.length === 0) {
    return emptySimulatorLabData(latestSession ?? null);
  }

  const baselineStart = latestSession
    ? new Date(latestSession.date.getTime() - BASELINE_DAYS * 24 * 60 * 60 * 1000)
    : null;
  const [stockShotRows, latestShotRows, baselineShotRows, rangeReality] = await Promise.all([
    fetchLabShots(db, userId, clubIds, { limit: MAX_STOCK_SHOTS }),
    latestSession ? fetchLabShots(db, userId, clubIds, { sessionId: latestSession.id }) : [],
    latestSession && baselineStart
      ? fetchLabShots(db, userId, clubIds, {
          from: baselineStart,
          to: latestSession.date,
          excludeSessionId: latestSession.id,
        })
      : [],
    getRangeRealityHandicapData(userId),
  ]);
  const gappingRows = buildGappingMatrixRows({
    clubs: activeClubs,
    shots: stockShotRows,
  });
  const sessionDeltas = buildSessionDeltaRows(latestShotRows, baselineShotRows);
  const equipmentImpacts = buildEquipmentChangeImpacts(historyRows, stockShotRows);
  const roastFacts = latestSession
    ? buildSessionRoastFacts(latestSession, latestShotRows, sessionDeltas)
    : [];

  return {
    latestSession,
    dataIssues: equipmentHistoryIssue ? [equipmentHistoryIssue] : [],
    rangeReality,
    totals: {
      activeClubs: activeClubs.length,
      gappingRows: gappingRows.length,
      latestSessionShots: latestShotRows.length,
      gapFlags: gappingRows.filter(
        (row) => row.gapStatus === "danger" || row.gapStatus === "overlap",
      ).length,
      positiveDeltas: sessionDeltas.filter((row) => row.verdict === "better").length,
      equipmentChanges: equipmentImpacts.length,
    },
    gappingRows,
    sessionDeltas,
    equipmentImpacts,
    roastFacts,
  };
}

export async function getSessionRoastContext(userId: string, sessionId?: string | null) {
  const db = getDb();
  const [session] = await db
    .select({
      id: sessions.id,
      source: sessions.source,
      type: sessions.type,
      date: sessions.date,
      fileName: sessions.fileName,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        sessionId ? eq(sessions.id, sessionId) : inArray(sessions.type, simulatorSessionTypes()),
      ),
    )
    .orderBy(desc(sessions.date))
    .limit(1);

  if (!session || !simulatorSessionTypes().includes(session.type)) {
    return null;
  }

  const sessionShots = await fetchLabShots(db, userId, null, { sessionId: session.id });
  const facts = buildSessionRoastFacts(session, sessionShots, []);

  return { session, facts };
}

export function buildGappingMatrixRows({
  clubs: inputClubs,
  shots: inputShots,
}: {
  clubs: SimulatorLabClub[];
  shots: SimulatorLabShot[];
}): GappingMatrixRow[] {
  const shotsByClubId = groupBy(inputShots.filter(isShotEvidenceEligible), (shot) => shot.clubId);
  const baseRows = inputClubs
    .filter((club) => isTrackedClubType(club.type))
    .sort((left, right) => clubSortValue(left.type) - clubSortValue(right.type))
    .map((club) => {
      const stock = calculateStockYardage(shotsByClubId.get(club.id) ?? [], 200, {
        clubType: club.type,
      });
      const recommendedCarryYd = stock.coursePlayCarryYd ?? stock.bestStockCarryYd;

      return {
        club,
        stock,
        recommendedCarryYd,
      };
    });

  return baseRows.map((row, index) => {
    const nextRow = baseRows
      .slice(index + 1)
      .find((candidate) => candidate.recommendedCarryYd !== null);
    const nextCarryYd = nextRow?.recommendedCarryYd ?? null;
    const gapToNextYd =
      row.recommendedCarryYd !== null && nextCarryYd !== null
        ? roundOne(row.recommendedCarryYd - nextCarryYd)
        : null;
    const status = classifyGap({
      longerClubType: row.club.type,
      shorterClubType: nextRow?.club.type ?? null,
      gapYd: gapToNextYd,
    });

    return {
      clubId: row.club.id,
      clubType: row.club.type,
      clubLabel: formatClubType(row.club.type),
      brandModel: brandModel(row.club),
      recommendedCarryYd: row.recommendedCarryYd,
      bestStockCarryYd: row.stock.bestStockCarryYd,
      latestReliableCarryYd: row.stock.latestReliableCarryYd,
      latestReliableCarryP25Yd: row.stock.latestReliableCarryP25Yd,
      latestReliableCarryP75Yd: row.stock.latestReliableCarryP75Yd,
      sampleSize: row.stock.sampleSize,
      confidenceScore: row.stock.confidenceScore,
      confidenceLabel: confidenceLabel(row.stock.sampleSize, row.stock.confidenceScore),
      gapToNextYd,
      nextClubType: nextRow?.club.type ?? null,
      ...status,
    };
  });
}

export function buildSessionDeltaRows(
  latestShots: SimulatorLabShot[],
  baselineShots: SimulatorLabShot[],
): SessionDeltaRow[] {
  const baselineByClubType = groupBy(
    baselineShots.filter(
      (shot) => isShotEvidenceEligible(shot) && isTrackedClubType(shot.clubType),
    ),
    (shot) => shot.clubType,
  );

  return [
    ...groupBy(
      latestShots.filter(
        (shot) => isShotEvidenceEligible(shot) && isTrackedClubType(shot.clubType),
      ),
      (shot) => shot.clubType,
    ),
  ]
    .sort(([left], [right]) => clubSortValue(left) - clubSortValue(right))
    .map(([clubType, shotsForClub]) => {
      const latest = snapshot(shotsForClub);
      const baseline = snapshot(baselineByClubType.get(clubType) ?? []);
      const carryDeltaYd = nullableDelta(latest.carryAverageYd, baseline.carryAverageYd);
      const ballSpeedDeltaMph = nullableDelta(
        latest.ballSpeedAverageMph,
        baseline.ballSpeedAverageMph,
      );
      const smashDelta = nullableDelta(latest.smashAverage, baseline.smashAverage, 2);
      const offlineDeltaYd = nullableDelta(latest.offlineAverageYd, baseline.offlineAverageYd);
      const carrySpreadDeltaYd = nullableDelta(latest.carrySpreadYd, baseline.carrySpreadYd);
      const verdict = deltaVerdict({
        latestShotCount: latest.shotCount,
        baselineShotCount: baseline.shotCount,
        carryDeltaYd,
        ballSpeedDeltaMph,
        smashDelta,
        offlineDeltaYd,
        carrySpreadDeltaYd,
      });

      return {
        clubType,
        clubLabel: formatClubType(clubType),
        latestShotCount: latest.shotCount,
        baselineShotCount: baseline.shotCount,
        carryDeltaYd,
        ballSpeedDeltaMph,
        smashDelta,
        offlineDeltaYd,
        carrySpreadDeltaYd,
        verdict,
        summary: deltaSummary(verdict, latest.shotCount, baseline.shotCount),
        tone: verdictTone(verdict),
      };
    });
}

export function buildEquipmentChangeImpacts(
  historyRows: EquipmentHistoryRow[],
  inputShots: SimulatorLabShot[],
): EquipmentChangeImpact[] {
  const shotsByClubId = groupBy(inputShots.filter(isShotEvidenceEligible), (shot) => shot.clubId);
  const historyByClubId = groupBy(
    [...historyRows].sort(
      (left, right) => left.effectiveFrom.getTime() - right.effectiveFrom.getTime(),
    ),
    (row) => row.clubId,
  );
  const impacts: EquipmentChangeImpact[] = [];

  for (const history of historyRows) {
    const clubHistory = historyByClubId.get(history.clubId) ?? [];
    const nextChange = clubHistory.find(
      (row) => row.effectiveFrom.getTime() > history.effectiveFrom.getTime(),
    );
    const beforeStart = addDays(history.effectiveFrom, -BASELINE_DAYS);
    const afterEnd = minDate(
      addDays(history.effectiveFrom, BASELINE_DAYS),
      nextChange?.effectiveFrom ?? history.effectiveTo,
    );
    const clubShots = shotsByClubId.get(history.clubId) ?? [];
    const before = clubShots.filter(
      (shot) => shot.shotAt >= beforeStart && shot.shotAt < history.effectiveFrom,
    );
    const after = clubShots.filter(
      (shot) => shot.shotAt >= history.effectiveFrom && (!afterEnd || shot.shotAt < afterEnd),
    );
    const beforeSnapshot = snapshot(before);
    const afterSnapshot = snapshot(after);
    const carryDeltaYd = nullableDelta(afterSnapshot.carryAverageYd, beforeSnapshot.carryAverageYd);
    const ballSpeedDeltaMph = nullableDelta(
      afterSnapshot.ballSpeedAverageMph,
      beforeSnapshot.ballSpeedAverageMph,
    );
    const smashDelta = nullableDelta(afterSnapshot.smashAverage, beforeSnapshot.smashAverage, 2);
    const offlineDeltaYd = nullableDelta(
      afterSnapshot.offlineAverageYd,
      beforeSnapshot.offlineAverageYd,
    );
    const verdict = equipmentVerdict({
      beforeShotCount: beforeSnapshot.shotCount,
      afterShotCount: afterSnapshot.shotCount,
      carryDeltaYd,
      ballSpeedDeltaMph,
      smashDelta,
      offlineDeltaYd,
    });

    impacts.push({
      id: history.id,
      clubId: history.clubId,
      clubType: history.clubType,
      clubLabel: formatClubType(history.clubType),
      equipmentLabel: equipmentLabel(history),
      effectiveFrom: history.effectiveFrom,
      effectiveTo: history.effectiveTo,
      beforeShotCount: beforeSnapshot.shotCount,
      afterShotCount: afterSnapshot.shotCount,
      carryDeltaYd,
      ballSpeedDeltaMph,
      smashDelta,
      offlineDeltaYd,
      verdict,
      detail:
        verdict === "building"
          ? "Need 5 shots before and after this setup before calling it."
          : "Compared with the 30-day window before this setup change.",
      tone: equipmentTone(verdict),
    });
  }

  return impacts
    .filter((impact) => impact.beforeShotCount > 0 || impact.afterShotCount > 0)
    .sort((left, right) => right.effectiveFrom.getTime() - left.effectiveFrom.getTime())
    .slice(0, 12);
}

export function buildSessionRoastFacts(
  session: SimulatorLabSession,
  latestShots: SimulatorLabShot[],
  deltas: SessionDeltaRow[],
): SessionRoastFact[] {
  const evidenceShots = latestShots.filter(isShotEvidenceEligible);
  const facts: SessionRoastFact[] = [];
  const offlineShot = [...evidenceShots]
    .filter((shot) => isNumber(shot.sideCarryYd))
    .sort((left, right) => Math.abs(right.sideCarryYd ?? 0) - Math.abs(left.sideCarryYd ?? 0))[0];
  const lowSmashCount = evidenceShots.filter(
    (shot) => isNumber(shot.smashFactor) && (shot.smashFactor ?? 0) < 1.25,
  ).length;
  const badTagCount = evidenceShots.filter((shot) =>
    ["mishit", "top", "thin", "fat", "bad_data", "bad-data"].includes(
      shot.qualityTag?.toLowerCase() ?? "",
    ),
  ).length;
  const worstDelta = [...deltas]
    .filter((delta) => delta.verdict === "worse")
    .sort((left, right) => deltaRiskScore(right) - deltaRiskScore(left))[0];

  if (offlineShot && Math.abs(offlineShot.sideCarryYd ?? 0) >= 25) {
    facts.push({
      label: "Wildest miss",
      value: `${formatClubType(offlineShot.clubType)} ${signed(offlineShot.sideCarryYd)} yd`,
      detail: "Largest offline shot in the latest simulator session.",
      severity: Math.abs(offlineShot.sideCarryYd ?? 0) >= 45 ? "spicy" : "medium",
    });
  }

  if (lowSmashCount > 0) {
    facts.push({
      label: "Low-smash strikes",
      value: `${lowSmashCount}/${evidenceShots.length}`,
      detail: "Shots under 1.25 smash factor from the saved launch-monitor data.",
      severity: lowSmashCount >= 3 ? "spicy" : "medium",
    });
  }

  if (badTagCount > 0) {
    facts.push({
      label: "Tagged horrors",
      value: `${badTagCount} flagged`,
      detail: "Mishit/top/thin/fat quality tags in the import.",
      severity: badTagCount >= 3 ? "spicy" : "medium",
    });
  }

  if (worstDelta) {
    facts.push({
      label: "Baseline dip",
      value: worstDelta.clubLabel,
      detail: worstDelta.summary,
      severity: "medium",
    });
  }

  if (facts.length === 0 && evidenceShots.length > 0) {
    facts.push({
      label: "Not enough chaos",
      value: `${evidenceShots.length} shots`,
      detail: `${session.fileName ?? "Latest simulator session"} did not expose a roast-worthy outlier yet.`,
      severity: "mild",
    });
  }

  return facts.slice(0, 5);
}

async function fetchLabShots(
  db: ReturnType<typeof getDb>,
  userId: string,
  clubIds: string[] | null,
  options: {
    sessionId?: string;
    excludeSessionId?: string;
    from?: Date;
    to?: Date;
    limit?: number;
  },
): Promise<SimulatorLabShot[]> {
  const predicates = [
    eq(shots.userId, userId),
    eq(sessions.userId, userId),
    shotEvidenceSqlPredicate(),
  ];

  if (clubIds && clubIds.length > 0) {
    predicates.push(inArray(shots.clubId, clubIds));
  }

  if (options.sessionId) {
    predicates.push(eq(shots.sessionId, options.sessionId));
  }

  if (options.excludeSessionId) {
    predicates.push(ne(shots.sessionId, options.excludeSessionId));
    predicates.push(lt(shots.shotAt, options.to ?? new Date()));
  }

  if (options.from) {
    predicates.push(gte(shots.shotAt, options.from));
  }

  if (options.to) {
    predicates.push(lt(shots.shotAt, options.to));
  }

  const rows = await db
    .select({
      id: shots.id,
      sessionId: shots.sessionId,
      clubId: shots.clubId,
      clubType: shots.clubType,
      shotAt: shots.shotAt,
      carryYd: shots.carryYd,
      totalYd: shots.totalYd,
      sideCarryYd: directionalMetricSql(shots.sideCarryYd),
      ballSpeedMph: shots.ballSpeedMph,
      clubSpeedMph: shots.clubSpeedMph,
      launchAngleDeg: shots.launchAngleDeg,
      smashFactor: shots.smashFactor,
      reviewStatus: shots.reviewStatus,
      shotCategory: shots.shotCategory,
      qualityTag: shots.qualityTag,
      sessionType: sessions.type,
      source: sessions.source,
    })
    .from(shots)
    .innerJoin(sessions, eq(shots.sessionId, sessions.id))
    .where(and(...predicates))
    .orderBy(desc(shots.shotAt), desc(shots.shotNumber))
    .limit(options.limit ?? 600);

  return rows.filter(isShotEvidenceEligible);
}

function shotEvidenceSqlPredicate() {
  return and(
    inArray(shots.reviewStatus, ["included", "restored"]),
    or(
      eq(shots.reviewStatus, "restored"),
      and(
        eq(shots.reviewStatus, "included"),
        sql`lower(trim(coalesce(${shots.qualityTag}, ''))) not like 'exclude%'`,
        sql`lower(trim(coalesce(${shots.qualityTag}, ''))) not in ('exclude', 'excluded', 'delete', 'deleted', 'calibration', 'warm-up', 'warmup', 'warm_up', 'bad-data', 'bad_data', 'invalid', 'launch-monitor-error', 'misread', 'fat', 'mishit', 'thin', 'top')`,
        sql`lower(trim(coalesce(${shots.shotCategory}, ''))) not in ('warm-up', 'warmup', 'warm_up')`,
      ),
    ),
  )!;
}

function emptySimulatorLabData(latestSession: SimulatorLabSession | null): SimulatorLabData {
  return {
    latestSession,
    dataIssues: [],
    rangeReality: {
      estimate: {
        value: null,
        label: "--",
        expectedRangeLabel: "--",
        confidenceScore: 0,
        confidence: "building",
        confidenceLabel: "Building",
        trend: {
          direction: "building",
          delta: null,
          label: "Trend building",
          detail: "Needs enough newer and previous range shots before calling improvement.",
        },
        sampleSize: 0,
        clubCount: 0,
        sessionCount: 0,
        usableShotCount: 0,
        modelShotCount: 0,
        latestShotAt: null,
        methodLabel: "Import range shots to build a range reality estimate.",
        disclaimer:
          "Range reality is a launch-monitor estimate for practice benchmarking, not an official Handicap Index.",
        caveats: ["No active clubs are available for range reality analysis."],
        timeline: [],
      },
      costlyShots: [],
      costlyShotGroups: [],
      disasterScenarios: [],
      prescriptions: [],
      flightLines: [],
      bagTruth: [],
    },
    totals: {
      activeClubs: 0,
      gappingRows: 0,
      latestSessionShots: 0,
      gapFlags: 0,
      positiveDeltas: 0,
      equipmentChanges: 0,
    },
    gappingRows: [],
    sessionDeltas: [],
    equipmentImpacts: [],
    roastFacts: [],
  };
}

function simulatorSessionTypes() {
  return ["simulator", "simulated_course"];
}

function classifyGap(input: {
  longerClubType: string | null;
  shorterClubType: string | null;
  gapYd: number | null;
}): Pick<GappingMatrixRow, "gapStatus" | "gapLabel" | "gapDetail" | "tone"> {
  if (input.gapYd === null || input.shorterClubType === null) {
    return {
      gapStatus: "building",
      gapLabel: "Building",
      gapDetail: "Need another trusted club below it.",
      tone: "slate",
    };
  }

  if (input.gapYd < 8) {
    return {
      gapStatus: "overlap",
      gapLabel: "Overlap",
      gapDetail: "Carries are close enough to question strike, loft or club mapping.",
      tone: "pink",
    };
  }

  if (isManageableTopEndGap(input)) {
    return {
      gapStatus: "top-ok",
      gapLabel: "Top gap ok",
      gapDetail: "Driver to bridge-club spacing is playable.",
      tone: "sky",
    };
  }

  if (isMissingYardageWindowGap(input)) {
    return {
      gapStatus: "danger",
      gapLabel: isScoringEndGap(input) ? "Scoring gap" : "Missing window",
      gapDetail: "This is wide enough to plan a retest or setup check.",
      tone: "amber",
    };
  }

  if (input.gapYd > 16) {
    return {
      gapStatus: "watch",
      gapLabel: "Watch",
      gapDetail: "Not dangerous yet, but worth tracking.",
      tone: "sky",
    };
  }

  return {
    gapStatus: "ok",
    gapLabel: "Covered",
    gapDetail: "Healthy spacing from current stock yardages.",
    tone: "green",
  };
}

function deltaVerdict(input: {
  latestShotCount: number;
  baselineShotCount: number;
  carryDeltaYd: number | null;
  ballSpeedDeltaMph: number | null;
  smashDelta: number | null;
  offlineDeltaYd: number | null;
  carrySpreadDeltaYd: number | null;
}): SessionDeltaRow["verdict"] {
  if (
    input.latestShotCount < MIN_LATEST_SHOTS_FOR_VERDICT ||
    input.baselineShotCount < MIN_BASELINE_SHOTS_FOR_VERDICT
  ) {
    return "building";
  }

  let score = 0;
  if (isNumber(input.carryDeltaYd))
    score += input.carryDeltaYd >= 2 ? 1 : input.carryDeltaYd <= -2 ? -1 : 0;
  if (isNumber(input.ballSpeedDeltaMph))
    score += input.ballSpeedDeltaMph >= 1 ? 1 : input.ballSpeedDeltaMph <= -1 ? -1 : 0;
  if (isNumber(input.smashDelta))
    score += input.smashDelta >= 0.02 ? 1 : input.smashDelta <= -0.02 ? -1 : 0;
  if (isNumber(input.offlineDeltaYd))
    score += input.offlineDeltaYd <= -2 ? 1 : input.offlineDeltaYd >= 2 ? -1 : 0;
  if (isNumber(input.carrySpreadDeltaYd))
    score += input.carrySpreadDeltaYd <= -2 ? 1 : input.carrySpreadDeltaYd >= 2 ? -1 : 0;

  if (score >= 2) return "better";
  if (score <= -2) return "worse";
  return "mixed";
}

function equipmentVerdict(input: {
  beforeShotCount: number;
  afterShotCount: number;
  carryDeltaYd: number | null;
  ballSpeedDeltaMph: number | null;
  smashDelta: number | null;
  offlineDeltaYd: number | null;
}): EquipmentChangeImpact["verdict"] {
  if (input.beforeShotCount < 5 || input.afterShotCount < 5) {
    return "building";
  }

  let score = 0;
  if (isNumber(input.carryDeltaYd))
    score += input.carryDeltaYd >= 2 ? 1 : input.carryDeltaYd <= -2 ? -1 : 0;
  if (isNumber(input.ballSpeedDeltaMph))
    score += input.ballSpeedDeltaMph >= 1 ? 1 : input.ballSpeedDeltaMph <= -1 ? -1 : 0;
  if (isNumber(input.smashDelta))
    score += input.smashDelta >= 0.02 ? 1 : input.smashDelta <= -0.02 ? -1 : 0;
  if (isNumber(input.offlineDeltaYd))
    score += input.offlineDeltaYd <= -2 ? 1 : input.offlineDeltaYd >= 2 ? -1 : 0;

  if (score >= 2) return "helped";
  if (score <= -2) return "hurt";
  return "mixed";
}

function snapshot(inputShots: SimulatorLabShot[]): MetricSnapshot {
  const carryValues = values(inputShots.map((shot) => shot.carryYd));
  const ballSpeedValues = values(inputShots.map((shot) => shot.ballSpeedMph));
  const smashValues = values(inputShots.map((shot) => shot.smashFactor));
  const offlineValues = values(
    inputShots
      .map((shot) => shot.sideCarryYd)
      .map((value) => (isNumber(value) ? Math.abs(value) : null)),
  );

  return {
    shotCount: inputShots.length,
    carryAverageYd: average(carryValues),
    ballSpeedAverageMph: average(ballSpeedValues),
    smashAverage: average(smashValues, 2),
    offlineAverageYd: average(offlineValues),
    carrySpreadYd: carryValues.length >= 2 ? roundOne(standardDeviation(carryValues)) : null,
  };
}

function deltaSummary(
  verdict: SessionDeltaRow["verdict"],
  latestCount: number,
  baselineCount: number,
) {
  if (verdict === "building") {
    return `${latestCount}/${baselineCount} shots. Need 3 latest and 5 baseline before calling it.`;
  }

  if (verdict === "better") return "Latest simulator block beat the 30-day baseline.";
  if (verdict === "worse") return "Latest simulator block slipped against the 30-day baseline.";
  return "Mixed movement against the 30-day baseline.";
}

function confidenceLabel(sampleSize: number, confidenceScore: number) {
  if (sampleSize < 5) return "Low proof";
  if (confidenceScore >= 75) return "Trusted";
  if (confidenceScore >= 50) return "Developing";
  return "Retest";
}

function equipmentLabel(row: EquipmentHistoryRow) {
  const parts = [
    isNumber(row.loftDeg) ? `${row.loftDeg} deg loft` : null,
    isNumber(row.lieDeg) ? `${row.lieDeg} deg lie` : null,
    row.shaft,
    row.swingWeight,
    row.notes,
  ].filter(Boolean);

  return parts.length > 0
    ? parts.join(" / ")
    : brandModel({
        brand: row.clubBrand,
        model: row.clubModel,
      });
}

function brandModel(input: { brand: string | null; model: string | null }) {
  return [input.brand, input.model].filter(Boolean).join(" ") || "Unspecified model";
}

function groupBy<T, K>(items: T[], readKey: (item: T) => K) {
  const grouped = new Map<K, T[]>();

  for (const item of items) {
    const key = readKey(item);
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }

  return grouped;
}

function nullableDelta(current: number | null, baseline: number | null, digits = 1) {
  return isNumber(current) && isNumber(baseline) ? round(current - baseline, digits) : null;
}

function values(items: Array<number | null | undefined>) {
  return items.filter(isNumber);
}

function average(items: number[], digits = 1) {
  return items.length > 0
    ? round(items.reduce((total, value) => total + value, 0) / items.length, digits)
    : null;
}

function standardDeviation(items: number[]) {
  if (items.length < 2) return 0;
  const itemAverage = average(items) ?? 0;
  const variance =
    items.reduce((total, value) => total + (value - itemAverage) ** 2, 0) / items.length;
  return Math.sqrt(variance);
}

function roundOne(value: number) {
  return round(value, 1);
}

function round(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function minDate(...dates: Array<Date | null | undefined>) {
  const valid = dates.filter((date): date is Date => date instanceof Date);
  return valid.length > 0 ? new Date(Math.min(...valid.map((date) => date.getTime()))) : null;
}

function verdictTone(verdict: SessionDeltaRow["verdict"]): SimulatorLabTone {
  if (verdict === "better") return "green";
  if (verdict === "worse") return "pink";
  if (verdict === "mixed") return "amber";
  return "slate";
}

function equipmentTone(verdict: EquipmentChangeImpact["verdict"]): SimulatorLabTone {
  if (verdict === "helped") return "green";
  if (verdict === "hurt") return "pink";
  if (verdict === "mixed") return "amber";
  return "slate";
}

function deltaRiskScore(delta: SessionDeltaRow) {
  return Math.abs(delta.offlineDeltaYd ?? 0) + Math.abs(delta.carryDeltaYd ?? 0);
}

function signed(value: number | null | undefined) {
  if (!isNumber(value)) return "--";
  return `${value >= 0 ? "+" : ""}${roundOne(value)}`;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
