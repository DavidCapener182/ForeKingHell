import { clubSortValue, formatClubType } from "@/lib/club-format";
import type { ClubAnalytics } from "@/lib/club-analytics";

type ProgressTone = "green" | "sky" | "pink" | "amber" | "slate";

const MAX_PRACTICE_PRIORITIES = 7;

export type ProgressClub = {
  clubId: string;
  clubType: string;
  brandModel: string;
  analytics: ClubAnalytics;
};

export type ProgressSignal = {
  label: string;
  value: string;
  detail: string;
  tone: ProgressTone;
  clubId?: string;
};

export type PracticePriority = {
  clubId: string;
  clubType: string;
  title: string;
  reason: string;
  drill: string;
  score: number;
  priorityLabel: "High priority" | "Medium priority" | "Low priority";
  tone: ProgressTone;
};

export type ProgressClubRow = {
  clubId: string;
  clubType: string;
  brandModel: string;
  stockCarryYd: number | null;
  trustIndex: number;
  confidenceLabel: string;
  playableRate: number | null;
  primaryMiss: ClubAnalytics["accuracy"]["primaryMiss"];
  primaryShape: ClubAnalytics["accuracy"]["primaryShape"];
  carryDeltaYd: number | null;
  ballSpeedDeltaMph: number | null;
  offlineDeltaYd: number | null;
  launchDeltaDeg: number | null;
  sampleSize: number;
  score: number;
};

export type JourneyEvent = {
  clubId: string;
  clubType: string;
  dateLabel: string;
  title: string;
  detail: string;
  tone: ProgressTone;
};

export type ProgressTrend = {
  label: string;
  value: string;
  detail: string;
  points: number[];
  goodDirection: "up" | "down" | "neutral";
  tone: ProgressTone;
};

export type BestSignal = {
  clubId?: string;
  title: string;
  value: string;
  detail: string;
  why: string;
  tone: ProgressTone;
};

export type CoachSummaryGroup = {
  title: "Positive signals" | "Warnings" | "Data gaps";
  tone: ProgressTone;
  items: Array<{
    label: string;
    detail?: string;
    clubId?: string;
  }>;
};

export type DataGap = {
  clubId: string;
  clubType: string;
  cleanShots: number;
  recommendation: string;
  detail: string;
};

export type TrustLadderItem = {
  clubId: string;
  clubType: string;
  trustIndex: number | null;
  sampleSize: number;
  label: string;
  note: string;
  tone: ProgressTone;
};

export type CurrentFormSignal = {
  clubId: string;
  clubType: string;
  shotCount: number;
  score: number;
  carryDeltaYd: number | null;
  ballSpeedDeltaMph: number | null;
  offlineDeltaYd: number | null;
  latestOfflineAverageYd: number | null;
  tone: ProgressTone;
};

export type ProgressSummary = {
  totals: {
    clubs: number;
    shots: number;
    averageTrust: number;
    averagePlayableRate: number | null;
    trackedCleanShots: number;
  };
  signals: ProgressSignal[];
  trends: ProgressTrend[];
  practicePlan: PracticePriority[];
  bestSignal: BestSignal | null;
  coachSummary: CoachSummaryGroup[];
  dataGaps: DataGap[];
  trustLadder: TrustLadderItem[];
  clubRows: ProgressClubRow[];
  journey: JourneyEvent[];
  rankings: {
    mostTrusted: ProgressClubRow | null;
    mostImproved: ProgressClubRow | null;
    needsWork: ProgressClubRow | null;
    mostVolatile: ProgressClubRow | null;
    currentForm: CurrentFormSignal | null;
  };
};

const journeyDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Europe/London",
});

export function buildProgressSummary(clubs: ProgressClub[]): ProgressSummary {
  const clubRows = clubs
    .map((club) => buildClubRow(club))
    .sort((left, right) => right.score - left.score);
  const averageTrust = average(clubRows.map((club) => club.trustIndex)) ?? 0;
  const averagePlayableRate = average(clubRows.map((club) => club.playableRate).filter(isNumber));
  const rankings = {
    mostTrusted:
      sortBy(
        clubRows.filter((club) => club.sampleSize >= 5),
        (club) => club.trustIndex,
      )[0] ?? null,
    mostImproved:
      sortBy(
        clubRows.filter((club) => club.sampleSize >= 6),
        (club) => club.score,
      )[0] ?? null,
    needsWork:
      [...clubRows]
        .filter((club) => club.sampleSize >= 3)
        .sort((left, right) => left.trustIndex - right.trustIndex)[0] ?? null,
    mostVolatile:
      sortBy(
        clubRows.filter((club) => club.sampleSize >= 3),
        (club) => volatilityScore(findClub(clubs, club.clubId)?.analytics),
      )[0] ?? null,
    currentForm: buildCurrentFormSignal(clubs, clubRows),
  };

  return {
    totals: {
      clubs: clubs.length,
      shots: clubs.reduce((total, club) => total + club.analytics.sample.totalShots, 0),
      averageTrust: Math.round(averageTrust),
      averagePlayableRate: roundOne(averagePlayableRate),
      trackedCleanShots: clubs.reduce((total, club) => total + club.analytics.sample.stockShots, 0),
    },
    signals: buildSignals(clubs, clubRows, rankings),
    trends: buildTrends(clubs, clubRows),
    practicePlan: buildPracticePlan(clubs),
    bestSignal: buildBestSignal(clubRows),
    coachSummary: buildCoachSummaryGroups(clubs, clubRows, rankings),
    dataGaps: buildDataGaps(clubRows),
    trustLadder: buildTrustLadder(clubRows, rankings),
    clubRows,
    journey: buildJourney(clubs, clubRows),
    rankings,
  };
}

function buildClubRow(club: ProgressClub): ProgressClubRow {
  const delta = club.analytics.progress.baselineDelta;
  const score = improvementScore(club.analytics);

  return {
    clubId: club.clubId,
    clubType: club.clubType,
    brandModel: club.brandModel,
    stockCarryYd: club.analytics.distance.stockCarryYd,
    trustIndex: club.analytics.consistency.clubTrustIndex,
    confidenceLabel: club.analytics.consistency.confidenceLabel,
    playableRate: club.analytics.accuracy.playableShotRate,
    primaryMiss: club.analytics.accuracy.primaryMiss,
    primaryShape: club.analytics.accuracy.primaryShape,
    carryDeltaYd: delta?.carryDeltaYd ?? null,
    ballSpeedDeltaMph: delta?.ballSpeedDeltaMph ?? null,
    offlineDeltaYd: delta?.offlineDeltaYd ?? null,
    launchDeltaDeg: delta?.launchDeltaDeg ?? null,
    sampleSize: club.analytics.sample.stockShots,
    score,
  };
}

function buildSignals(
  clubs: ProgressClub[],
  rows: ProgressClubRow[],
  rankings: ProgressSummary["rankings"],
): ProgressSignal[] {
  const signals: ProgressSignal[] = [];
  const carryMover = sortBy(
    rows.filter(
      (row) => row.sampleSize >= 6 && isNumber(row.carryDeltaYd) && Math.abs(row.carryDeltaYd) >= 1,
    ),
    (row) => Math.abs(row.carryDeltaYd ?? 0),
  )[0];
  const dispersionMover = sortBy(
    rows.filter(
      (row) =>
        row.sampleSize >= 6 && isNumber(row.offlineDeltaYd) && Math.abs(row.offlineDeltaYd) >= 2,
    ),
    (row) => Math.abs(row.offlineDeltaYd ?? 0),
  )[0];
  const speedMover = sortBy(
    rows.filter(
      (row) =>
        row.sampleSize >= 6 &&
        isNumber(row.ballSpeedDeltaMph) &&
        Math.abs(row.ballSpeedDeltaMph) >= 1,
    ),
    (row) => Math.abs(row.ballSpeedDeltaMph ?? 0),
  )[0];

  if (carryMover && isNumber(carryMover.carryDeltaYd)) {
    signals.push({
      label: `${formatClubType(carryMover.clubType)} carry`,
      value: `${signed(carryMover.carryDeltaYd)} yd`,
      detail: "Latest clean baseline compared with the first clean baseline.",
      tone: carryMover.carryDeltaYd >= 0 ? "green" : "amber",
      clubId: carryMover.clubId,
    });
  }

  if (dispersionMover && isNumber(dispersionMover.offlineDeltaYd)) {
    const tighter = dispersionMover.offlineDeltaYd < 0;
    signals.push({
      label: `${formatClubType(dispersionMover.clubType)} dispersion`,
      value: `${Math.abs(roundOne(dispersionMover.offlineDeltaYd) ?? 0)} yd ${tighter ? "tighter" : "wider"}`,
      detail: "Average offline movement from baseline to current clean shots.",
      tone: tighter ? "green" : "amber",
      clubId: dispersionMover.clubId,
    });
  }

  if (speedMover && isNumber(speedMover.ballSpeedDeltaMph)) {
    signals.push({
      label: `${formatClubType(speedMover.clubType)} ball speed`,
      value: `${signed(speedMover.ballSpeedDeltaMph)} mph`,
      detail: "Strike and output movement against your personal baseline.",
      tone: speedMover.ballSpeedDeltaMph >= 0 ? "sky" : "slate",
      clubId: speedMover.clubId,
    });
  }

  if (rankings.mostTrusted) {
    signals.push({
      label: "Most trusted",
      value: `${formatClubType(rankings.mostTrusted.clubType)} / ${rankings.mostTrusted.trustIndex}%`,
      detail: `${rankings.mostTrusted.confidenceLabel}. ${rankings.mostTrusted.sampleSize} clean stock shots.`,
      tone: "green",
      clubId: rankings.mostTrusted.clubId,
    });
  }

  if (rankings.needsWork && rankings.needsWork.clubId !== rankings.mostTrusted?.clubId) {
    signals.push({
      label: "Needs work",
      value: `${formatClubType(rankings.needsWork.clubType)} / ${rankings.needsWork.trustIndex}%`,
      detail: "Lowest trust club with enough data to make a useful call.",
      tone: "amber",
      clubId: rankings.needsWork.clubId,
    });
  }

  if (signals.length === 0 && clubs.length > 0) {
    signals.push({
      label: "Baseline building",
      value: `${clubs.length} clubs tracked`,
      detail: "Keep importing sessions to unlock stronger first-vs-latest comparisons.",
      tone: "slate",
    });
  }

  return signals.slice(0, 5);
}

function buildTrends(clubs: ProgressClub[], rows: ProgressClubRow[]): ProgressTrend[] {
  const sortedRows = [...rows].sort(
    (left, right) => clubSortValue(left.clubType) - clubSortValue(right.clubType),
  );
  const trustPoints = sortedRows.map((row) => row.trustIndex);
  const playablePoints = sortedRows.map((row) => row.playableRate).filter(isNumber);
  const carryBaseline = average(
    clubs.map((club) => club.analytics.progress.baseline?.carryMedianYd).filter(isNumber),
  );
  const carryCurrent = average(
    clubs.map((club) => club.analytics.progress.current?.carryMedianYd).filter(isNumber),
  );
  const offlineBaseline = average(
    clubs
      .map((club) => club.analytics.progress.baseline?.absoluteOfflineAverageYd)
      .filter(isNumber),
  );
  const offlineCurrent = average(
    clubs.map((club) => club.analytics.progress.current?.absoluteOfflineAverageYd).filter(isNumber),
  );
  const carryDelta = nullableDelta(carryCurrent, carryBaseline);
  const offlineDelta = nullableDelta(offlineCurrent, offlineBaseline);
  const averageTrust = average(trustPoints);
  const averagePlayable = average(playablePoints);

  return [
    {
      label: "Trust by club",
      value: averageTrust === null ? "--" : `${Math.round(averageTrust)}% avg`,
      detail: "Current trust spread across tracked clubs.",
      points: trustPoints,
      goodDirection: "up",
      tone: "sky",
    },
    {
      label: "Offline movement",
      value:
        offlineDelta === null
          ? "--"
          : `${Math.abs(offlineDelta)} yd ${offlineDelta <= 0 ? "tighter" : "wider"}`,
      detail: "Average offline, latest clean baseline vs first clean baseline.",
      points: [offlineBaseline, offlineCurrent].filter(isNumber),
      goodDirection: "down",
      tone: offlineDelta === null ? "slate" : offlineDelta <= 0 ? "green" : "amber",
    },
    {
      label: "Carry movement",
      value: carryDelta === null ? "--" : `${signed(carryDelta)} yd`,
      detail: "Bag-average carry, latest clean baseline vs first clean baseline.",
      points: [carryBaseline, carryCurrent].filter(isNumber),
      goodDirection: "up",
      tone: carryDelta === null ? "slate" : carryDelta >= 0 ? "green" : "amber",
    },
    {
      label: "Playable rate",
      value: averagePlayable === null ? "--" : `${Math.round(averagePlayable)}% avg`,
      detail: "Current playable-shot rate across clubs with directional data.",
      points: playablePoints,
      goodDirection: "up",
      tone: "green",
    },
  ];
}

function buildBestSignal(rows: ProgressClubRow[]): BestSignal | null {
  const improvedDispersion = sortBy(
    rows.filter(
      (row) => row.sampleSize >= 10 && isNumber(row.offlineDeltaYd) && row.offlineDeltaYd <= -2,
    ),
    (row) => Math.abs(row.offlineDeltaYd ?? 0) + row.sampleSize / 20,
  )[0];

  if (improvedDispersion && isNumber(improvedDispersion.offlineDeltaYd)) {
    return {
      clubId: improvedDispersion.clubId,
      title: "Best signal",
      value: `${formatClubType(improvedDispersion.clubType)} dispersion improved by ${Math.abs(improvedDispersion.offlineDeltaYd)} yd.`,
      detail: `This is based on ${improvedDispersion.sampleSize} clean stock shots.`,
      why: `${formatClubType(improvedDispersion.clubType)} is trending tighter without relying on one outlier distance gain.`,
      tone: "green",
    };
  }

  const carryGain = sortBy(
    rows.filter(
      (row) => row.sampleSize >= 10 && isNumber(row.carryDeltaYd) && row.carryDeltaYd >= 1,
    ),
    (row) => (row.carryDeltaYd ?? 0) + row.sampleSize / 30,
  )[0];

  if (carryGain && isNumber(carryGain.carryDeltaYd)) {
    return {
      clubId: carryGain.clubId,
      title: "Best signal",
      value: `${formatClubType(carryGain.clubType)} carry improved by ${signed(carryGain.carryDeltaYd)} yd.`,
      detail: `This is based on ${carryGain.sampleSize} clean stock shots.`,
      why: "The distance gain is large enough to change the bag readout and has enough sample depth to treat as a real trend.",
      tone: "green",
    };
  }

  return null;
}

function buildCurrentFormSignal(
  clubs: ProgressClub[],
  rows: ProgressClubRow[],
): CurrentFormSignal | null {
  const rowById = new Map(rows.map((row) => [row.clubId, row]));
  const candidates = clubs
    .map((club) => {
      const row = rowById.get(club.clubId);
      const latest = club.analytics.progress.latestSession;

      if (!row || !latest || latest.shotCount < 3) {
        return null;
      }

      const score = currentFormScore(club.clubType, row, club.analytics);
      const offlineDeltaYd = club.analytics.progress.lastSessionDelta?.offlineDeltaYd ?? null;
      const signal: CurrentFormSignal = {
        clubId: club.clubId,
        clubType: club.clubType,
        shotCount: latest.shotCount,
        score,
        carryDeltaYd: club.analytics.progress.lastSessionDelta?.carryDeltaYd ?? null,
        ballSpeedDeltaMph: club.analytics.progress.lastSessionDelta?.ballSpeedDeltaMph ?? null,
        offlineDeltaYd,
        latestOfflineAverageYd: latest.absoluteOfflineAverageYd,
        tone:
          score >= 58 || (isNumber(offlineDeltaYd) && offlineDeltaYd <= -2)
            ? "green"
            : score >= 46
              ? "sky"
              : "slate",
      };

      return signal;
    })
    .filter((candidate): candidate is CurrentFormSignal => candidate !== null);

  return sortBy(candidates, (candidate) => candidate.score)[0] ?? null;
}

function buildCoachSummaryGroups(
  clubs: ProgressClub[],
  rows: ProgressClubRow[],
  rankings: ProgressSummary["rankings"],
): CoachSummaryGroup[] {
  const groups: CoachSummaryGroup[] = [
    { title: "Positive signals", tone: "green", items: [] },
    { title: "Warnings", tone: "amber", items: [] },
    { title: "Data gaps", tone: "slate", items: [] },
  ];
  const positives = groups[0];
  const warnings = groups[1];
  const gaps = groups[2];
  const carryGain = sortBy(
    rows.filter(
      (row) => row.sampleSize >= 6 && isNumber(row.carryDeltaYd) && row.carryDeltaYd >= 1,
    ),
    (row) => row.carryDeltaYd ?? 0,
  )[0];
  const tighter = sortBy(
    rows.filter(
      (row) => row.sampleSize >= 6 && isNumber(row.offlineDeltaYd) && row.offlineDeltaYd <= -2,
    ),
    (row) => Math.abs(row.offlineDeltaYd ?? 0),
  )[0];
  const speedDrop = sortBy(
    rows.filter(
      (row) =>
        row.sampleSize >= 6 && isNumber(row.ballSpeedDeltaMph) && row.ballSpeedDeltaMph <= -1,
    ),
    (row) => Math.abs(row.ballSpeedDeltaMph ?? 0),
  )[0];

  if (carryGain && isNumber(carryGain.carryDeltaYd)) {
    positives.items.push({
      label: `${formatClubType(carryGain.clubType)} carry improved by ${signed(carryGain.carryDeltaYd)} yd`,
      clubId: carryGain.clubId,
    });
  }

  if (tighter && isNumber(tighter.offlineDeltaYd)) {
    positives.items.push({
      label: `${formatClubType(tighter.clubType)} dispersion is ${Math.abs(tighter.offlineDeltaYd)} yd tighter`,
      clubId: tighter.clubId,
    });
  }

  if (rankings.mostTrusted) {
    positives.items.push({
      label: `${formatClubType(rankings.mostTrusted.clubType)} is the most trusted club at ${rankings.mostTrusted.trustIndex}%`,
      detail: `${rankings.mostTrusted.sampleSize} clean stock shots`,
      clubId: rankings.mostTrusted.clubId,
    });
  }

  if (rankings.needsWork) {
    warnings.items.push({
      label: `${formatClubType(rankings.needsWork.clubType)} is still the lowest-trust club at ${rankings.needsWork.trustIndex}%`,
      detail: `${rankings.needsWork.primaryMiss.toLowerCase()} miss pattern`,
      clubId: rankings.needsWork.clubId,
    });
  }

  if (speedDrop && isNumber(speedDrop.ballSpeedDeltaMph)) {
    warnings.items.push({
      label: `${formatClubType(speedDrop.clubType)} ball speed is down ${Math.abs(speedDrop.ballSpeedDeltaMph)} mph`,
      clubId: speedDrop.clubId,
    });
  }

  if (rankings.mostVolatile && rankings.mostVolatile.clubId !== rankings.needsWork?.clubId) {
    warnings.items.push({
      label: `${formatClubType(rankings.mostVolatile.clubType)} has the most volatile pattern`,
      detail: `${rankings.mostVolatile.sampleSize} clean stock shots`,
      clubId: rankings.mostVolatile.clubId,
    });
  }

  for (const gap of buildDataGaps(rows).slice(0, 2)) {
    gaps.items.push({
      label: `${formatClubType(gap.clubType)} needs more clean stock shots`,
      detail: gap.recommendation,
      clubId: gap.clubId,
    });
  }

  if (positives.items.length === 0) {
    positives.items.push({
      label: "No strong positive movement yet",
      detail: "Keep importing comparable stock-shot sessions.",
    });
  }

  if (warnings.items.length === 0) {
    warnings.items.push({
      label: "No clear warning has separated yet",
      detail: "The next import may make the trend clearer.",
    });
  }

  if (gaps.items.length === 0) {
    gaps.items.push({
      label: "Tracked clubs have enough samples for a first read",
      detail: `${clubs.length} clubs are included.`,
    });
  }

  return groups;
}

function buildPracticePlan(clubs: ProgressClub[]): PracticePriority[] {
  return clubs
    .map((club) => {
      const analytics = club.analytics;
      const bigMissRate = analytics.accuracy.bigMissRate ?? 0;
      const playableGap = 100 - (analytics.accuracy.playableShotRate ?? 50);
      const trustGap = 100 - analytics.consistency.clubTrustIndex;
      const launchGap = 100 - (analytics.launch.launchWindowScore ?? 60);
      const strikeGap = 100 - (analytics.strike.highSmashRate ?? 55);
      const directionRisk = directionRiskScore(club.clubType, analytics);
      const dataPenalty =
        analytics.sample.stockShots < 10 ? 12 : analytics.sample.stockShots < 18 ? 4 : 0;
      const longGameDirectionBoost = isLongGameClub(club.clubType)
        ? directionRisk * 0.2
        : directionRisk * 0.06;
      const newScoringWedgeAdjustment =
        isScoringWedgeClub(club.clubType) && analytics.sample.stockShots < 18 ? -8 : 0;
      const score =
        trustGap * 0.3 +
        bigMissRate * 0.28 +
        playableGap * 0.2 +
        launchGap * 0.1 +
        strikeGap * 0.08 +
        longGameDirectionBoost +
        dataPenalty +
        newScoringWedgeAdjustment;

      return {
        clubId: club.clubId,
        clubType: club.clubType,
        title: practiceTitle(club.clubType, analytics),
        reason: practiceReason(analytics),
        drill: analytics.practice.drill,
        score: Math.max(0, Math.round(score)),
        priorityLabel: priorityLabel(score),
        tone: score >= 62 ? "amber" : score >= 46 ? "amber" : score >= 34 ? "sky" : "green",
      } satisfies PracticePriority;
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_PRACTICE_PRIORITIES);
}

function buildDataGaps(rows: ProgressClubRow[]): DataGap[] {
  return [...rows]
    .filter((row) => row.sampleSize < 10 || row.confidenceLabel === "Not enough data")
    .sort((left, right) => left.sampleSize - right.sampleSize)
    .map((row) => ({
      clubId: row.clubId,
      clubType: row.clubType,
      cleanShots: row.sampleSize,
      recommendation: "Add 10 full stock shots to build a reliable baseline.",
      detail:
        row.sampleSize === 0
          ? "No clean stock-shot baseline yet."
          : `${row.sampleSize} clean stock shots is not enough for a confident trend.`,
    }));
}

function buildTrustLadder(
  rows: ProgressClubRow[],
  rankings: ProgressSummary["rankings"],
): TrustLadderItem[] {
  return [...rows]
    .sort((left, right) => {
      if (left.sampleSize < 3 && right.sampleSize >= 3) {
        return 1;
      }

      if (right.sampleSize < 3 && left.sampleSize >= 3) {
        return -1;
      }

      return right.trustIndex - left.trustIndex;
    })
    .map((row) => {
      const hasEnoughData = row.sampleSize >= 3;
      const isVolatile = row.clubId === rankings.mostVolatile?.clubId;
      const isNeedsWork = row.clubId === rankings.needsWork?.clubId;
      const speedWarning = isNumber(row.ballSpeedDeltaMph) && row.ballSpeedDeltaMph <= -1;

      return {
        clubId: row.clubId,
        clubType: row.clubType,
        trustIndex: hasEnoughData ? row.trustIndex : null,
        sampleSize: row.sampleSize,
        label: hasEnoughData ? trustLabel(row.trustIndex) : "Needs data",
        note: !hasEnoughData
          ? "Needs data"
          : isNeedsWork
            ? "Needs work"
            : isVolatile
              ? "Reliable but volatile"
              : speedWarning
                ? "Watch ball speed"
                : row.confidenceLabel,
        tone: !hasEnoughData
          ? "slate"
          : row.trustIndex >= 68
            ? "green"
            : row.trustIndex >= 62
              ? "sky"
              : "amber",
      };
    });
}

function buildJourney(clubs: ProgressClub[], rows: ProgressClubRow[]): JourneyEvent[] {
  const events: JourneyEvent[] = [];

  for (const row of rows) {
    if (isNumber(row.carryDeltaYd) && row.carryDeltaYd >= 5) {
      events.push({
        clubId: row.clubId,
        clubType: row.clubType,
        dateLabel: journeyDateForClub(clubs, row.clubId),
        title: `${formatClubType(row.clubType)} carry moved up`,
        detail: `${signed(row.carryDeltaYd)} yd versus the first clean baseline.`,
        tone: "green",
      });
    }

    if (isNumber(row.offlineDeltaYd) && row.offlineDeltaYd <= -8) {
      events.push({
        clubId: row.clubId,
        clubType: row.clubType,
        dateLabel: journeyDateForClub(clubs, row.clubId),
        title: `${formatClubType(row.clubType)} miss pattern tightened`,
        detail: `${Math.abs(roundOne(row.offlineDeltaYd) ?? 0)} yd less average offline.`,
        tone: "sky",
      });
    }

    if (row.trustIndex >= 75 && row.sampleSize >= 10) {
      events.push({
        clubId: row.clubId,
        clubType: row.clubType,
        dateLabel: journeyDateForClub(clubs, row.clubId),
        title: `${formatClubType(row.clubType)} is becoming playable`,
        detail: `${row.trustIndex}% trust with ${row.sampleSize} clean stock shots.`,
        tone: "green",
      });
    }
  }

  const personalBests = clubs
    .filter((club) => isNumber(club.analytics.progress.personalBestCarryYd))
    .sort(
      (left, right) =>
        (right.analytics.progress.personalBestCarryYd ?? 0) -
        (left.analytics.progress.personalBestCarryYd ?? 0),
    )
    .slice(0, 2);

  for (const club of personalBests) {
    events.push({
      clubId: club.clubId,
      clubType: club.clubType,
      dateLabel: journeyDate(club.analytics.sample.latestShotAt),
      title: `${formatClubType(club.clubType)} personal best`,
      detail: `${club.analytics.progress.personalBestCarryYd} yd carry in the saved data.`,
      tone: "sky",
    });
  }

  if (events.length === 0 && clubs.length > 0) {
    events.push({
      clubId: clubs[0].clubId,
      clubType: clubs[0].clubType,
      dateLabel: journeyDate(clubs[0].analytics.sample.latestShotAt),
      title: "Baseline started",
      detail: "LM World Tour has enough data to begin building personal comparisons.",
      tone: "slate",
    });
  }

  return events.slice(0, 8);
}

function improvementScore(analytics: ClubAnalytics) {
  const delta = analytics.progress.baselineDelta;
  const carry = delta?.carryDeltaYd ?? 0;
  const speed = delta?.ballSpeedDeltaMph ?? 0;
  const offline = delta?.offlineDeltaYd ?? 0;
  const launch = delta?.launchDeltaDeg ?? 0;
  const launchImprovement =
    analytics.launch.launchWindowScore !== null ? analytics.launch.launchWindowScore / 15 : 0;
  const trust = analytics.consistency.clubTrustIndex / 8;

  return Math.round(
    carry * 1.8 + speed * 3.2 - offline * 1.1 - Math.abs(launch) * 0.4 + launchImprovement + trust,
  );
}

function volatilityScore(analytics: ClubAnalytics | undefined) {
  if (!analytics) {
    return 0;
  }

  return (
    (analytics.accuracy.bigMissRate ?? 0) * 0.8 +
    (analytics.accuracy.shotConeWidthYd ?? 0) * 0.55 +
    (analytics.distance.carrySpreadYd ?? 0) * 0.5
  );
}

function currentFormScore(clubType: string, row: ProgressClubRow, analytics: ClubAnalytics) {
  const latest = analytics.progress.latestSession;

  if (!latest) {
    return 0;
  }

  const targetOffline = currentFormOfflineTarget(clubType);
  const latestOffline =
    latest.absoluteOfflineAverageYd ?? analytics.accuracy.absoluteOfflineAverageYd;
  const offlineScore = isNumber(latestOffline)
    ? Math.max(0, targetOffline - latestOffline) * 0.55 -
      Math.max(0, latestOffline - targetOffline) * 0.45
    : 0;
  const carryDelta = analytics.progress.lastSessionDelta?.carryDeltaYd ?? 0;
  const speedDelta = analytics.progress.lastSessionDelta?.ballSpeedDeltaMph ?? 0;
  const offlineDelta = analytics.progress.lastSessionDelta?.offlineDeltaYd ?? 0;
  const playableScore = (analytics.accuracy.playableShotRate ?? 50) * 0.15;
  const sampleScore = Math.min(latest.shotCount, 12) * 1.4;
  const trustScore = row.trustIndex * 0.22;

  return Math.round(
    sampleScore +
      trustScore +
      playableScore +
      offlineScore +
      carryDelta * 0.8 +
      speedDelta * 1.4 -
      offlineDelta * 1.2,
  );
}

function currentFormOfflineTarget(clubType: string) {
  const family = progressClubFamily(clubType);

  if (family === "driver") {
    return 32;
  }

  if (family === "wood" || family === "hybrid") {
    return 26;
  }

  if (family === "wedge") {
    return 13;
  }

  return 19;
}

function directionRiskScore(clubType: string, analytics: ClubAnalytics) {
  const family = progressClubFamily(clubType);
  const bigMissRate = analytics.accuracy.bigMissRate ?? 0;
  const playableGap = 100 - (analytics.accuracy.playableShotRate ?? 50);
  const startLineRisk = scoreFromRaw(analytics.accuracy.startLineStdDevDeg ?? 0, 7);
  const coneLimit =
    family === "driver"
      ? 82
      : family === "wood" || family === "hybrid"
        ? 66
        : family === "wedge"
          ? 32
          : 46;
  const coneRisk = scoreFromRaw(analytics.accuracy.shotConeWidthYd ?? 0, coneLimit);

  return Math.max(bigMissRate, playableGap, startLineRisk, coneRisk);
}

function hasStartLinePriority(clubType: string, analytics: ClubAnalytics) {
  if (!isLongGameClub(clubType)) {
    return false;
  }

  return (
    (analytics.accuracy.bigMissRate ?? 0) >= 24 || directionRiskScore(clubType, analytics) >= 52
  );
}

function practiceReason(analytics: ClubAnalytics) {
  if (analytics.sample.stockShots < 10) {
    return "Needs more clean full-shot data before strong conclusions.";
  }

  if (hasStartLinePriority(analytics.clubType, analytics)) {
    const shotCone = analytics.accuracy.shotConeWidthYd;
    const bigMissRate = analytics.accuracy.bigMissRate;

    if (isNumber(shotCone) && isNumber(bigMissRate)) {
      return `Shot cone is ${Math.round(shotCone)} yd and big miss rate is ${Math.round(bigMissRate)}%. Start line is the first priority.`;
    }

    return "Start line is the most volatile current signal.";
  }

  if ((analytics.accuracy.bigMissRate ?? 0) >= 30) {
    return `Big miss rate is ${Math.round(analytics.accuracy.bigMissRate ?? 0)}%. Direction is the first priority.`;
  }

  if ((analytics.launch.launchWindowScore ?? 100) < 55) {
    return `Only ${Math.round(analytics.launch.launchWindowScore ?? 0)}% of clean shots are in the launch window.`;
  }

  if ((analytics.strike.lowSmashRate ?? 0) >= 25) {
    return `Low-smash rate is ${Math.round(analytics.strike.lowSmashRate ?? 0)}%, so strike quality is leaking speed.`;
  }

  return (
    analytics.insights[0]?.body ??
    "Highest-value club to keep moving based on the current trust profile."
  );
}

function practiceTitle(clubType: string, analytics: ClubAnalytics) {
  const club = formatClubType(clubType);

  if (analytics.sample.stockShots < 10) {
    return `Build ${club} baseline`;
  }

  if ((analytics.accuracy.bigMissRate ?? 0) >= 30 || hasStartLinePriority(clubType, analytics)) {
    return `Stabilise ${club} start line`;
  }

  if ((analytics.strike.lowSmashRate ?? 0) >= 25) {
    return `Centre ${club} strike`;
  }

  if (
    analytics.accuracy.primaryMiss !== "Balanced" &&
    analytics.accuracy.primaryMiss !== "Unknown"
  ) {
    return `Guard against ${club} ${analytics.accuracy.primaryMiss.toLowerCase()} miss`;
  }

  return `Confirm ${club} stock distance`;
}

function priorityLabel(score: number): PracticePriority["priorityLabel"] {
  if (score >= 62) {
    return "High priority";
  }

  if (score >= 34) {
    return "Medium priority";
  }

  return "Low priority";
}

function trustLabel(value: number) {
  if (value >= 72) {
    return "Trusted";
  }

  if (value >= 66) {
    return "Reliable";
  }

  if (value >= 58) {
    return "Developing";
  }

  return "Needs work";
}

function progressClubFamily(clubType: string) {
  const normalized = clubType.toLowerCase();

  if (normalized === "driver") {
    return "driver";
  }

  if (/^[1-9]w$/.test(normalized)) {
    return "wood";
  }

  if (/^[1-9]h$/.test(normalized)) {
    return "hybrid";
  }

  if (["pw", "gw", "aw", "sw", "lw", "wedge"].includes(normalized)) {
    return "wedge";
  }

  return "iron";
}

function isLongGameClub(clubType: string) {
  const normalized = clubType.toLowerCase();

  return (
    normalized === "driver" ||
    /^[1-9]w$/.test(normalized) ||
    /^[1-9]h$/.test(normalized) ||
    ["2i", "3i", "4i", "5i"].includes(normalized)
  );
}

function isScoringWedgeClub(clubType: string) {
  return ["pw", "gw", "aw", "sw", "lw", "wedge"].includes(clubType.toLowerCase());
}

function scoreFromRaw(value: number, worstExpected: number) {
  return Math.round(Math.max(0, Math.min(1, value / worstExpected)) * 100);
}

function journeyDateForClub(clubs: ProgressClub[], clubId: string) {
  return journeyDate(findClub(clubs, clubId)?.analytics.sample.latestShotAt ?? null);
}

function journeyDate(date: Date | null) {
  return date ? journeyDateFormatter.format(date) : "Latest data";
}

function findClub(clubs: ProgressClub[], clubId: string) {
  return clubs.find((club) => club.clubId === clubId);
}

function sortBy<T>(values: T[], score: (value: T) => number) {
  return [...values].sort((left, right) => score(right) - score(left));
}

function average(values: number[]) {
  const usable = values.filter(isNumber);
  return usable.length > 0
    ? usable.reduce((total, value) => total + value, 0) / usable.length
    : null;
}

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function roundOne(value: number | null) {
  return value === null ? null : Math.round(value * 10) / 10;
}

function nullableDelta(current: number | null, baseline: number | null) {
  return current === null || baseline === null ? null : roundOne(current - baseline);
}

function signed(value: number) {
  const rounded = roundOne(value) ?? 0;
  return `${rounded > 0 ? "+" : ""}${rounded}`;
}
