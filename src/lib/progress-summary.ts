import { formatClubType } from "@/lib/club-format";
import type { ClubAnalytics } from "@/lib/club-analytics";

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
  tone: "green" | "sky" | "pink" | "amber" | "slate";
  clubId?: string;
};

export type PracticePriority = {
  clubId: string;
  clubType: string;
  title: string;
  reason: string;
  drill: string;
  score: number;
  tone: "green" | "sky" | "pink" | "amber" | "slate";
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
  title: string;
  detail: string;
  tone: "green" | "sky" | "pink" | "amber" | "slate";
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
  practicePlan: PracticePriority[];
  clubRows: ProgressClubRow[];
  journey: JourneyEvent[];
  rankings: {
    mostTrusted: ProgressClubRow | null;
    mostImproved: ProgressClubRow | null;
    needsWork: ProgressClubRow | null;
    mostVolatile: ProgressClubRow | null;
  };
};

export function buildProgressSummary(clubs: ProgressClub[]): ProgressSummary {
  const clubRows = clubs
    .map((club) => buildClubRow(club))
    .sort((left, right) => right.score - left.score);
  const averageTrust = average(clubRows.map((club) => club.trustIndex)) ?? 0;
  const averagePlayableRate = average(
    clubRows.map((club) => club.playableRate).filter(isNumber),
  );
  const rankings = {
    mostTrusted:
      sortBy(
        clubRows.filter((club) => club.sampleSize >= 5),
        (club) => club.trustIndex,
      )[0] ?? null,
    mostImproved: sortBy(
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
    practicePlan: buildPracticePlan(clubs),
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
    rows.filter((row) => row.sampleSize >= 6 && isNumber(row.carryDeltaYd) && Math.abs(row.carryDeltaYd) >= 1),
    (row) => Math.abs(row.carryDeltaYd ?? 0),
  )[0];
  const dispersionMover = sortBy(
    rows.filter((row) => row.sampleSize >= 6 && isNumber(row.offlineDeltaYd) && Math.abs(row.offlineDeltaYd) >= 2),
    (row) => Math.abs(row.offlineDeltaYd ?? 0),
  )[0];
  const speedMover = sortBy(
    rows.filter((row) => row.sampleSize >= 6 && isNumber(row.ballSpeedDeltaMph) && Math.abs(row.ballSpeedDeltaMph) >= 1),
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
      tone: "pink",
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

function buildPracticePlan(clubs: ProgressClub[]): PracticePriority[] {
  return clubs
    .map((club) => {
      const analytics = club.analytics;
      const bigMissRate = analytics.accuracy.bigMissRate ?? 0;
      const playableGap = 100 - (analytics.accuracy.playableShotRate ?? 50);
      const trustGap = 100 - analytics.consistency.clubTrustIndex;
      const launchGap = 100 - (analytics.launch.launchWindowScore ?? 60);
      const strikeGap = 100 - (analytics.strike.highSmashRate ?? 55);
      const dataPenalty = analytics.sample.stockShots < 10 ? 12 : 0;
      const score =
        trustGap * 0.34 +
        bigMissRate * 0.24 +
        playableGap * 0.2 +
        launchGap * 0.12 +
        strikeGap * 0.1 +
        dataPenalty;

      return {
        clubId: club.clubId,
        clubType: club.clubType,
        title: `${formatClubType(club.clubType)}: ${analytics.practice.title}`,
        reason: practiceReason(analytics),
        drill: analytics.practice.drill,
        score: Math.round(score),
        tone: score >= 62 ? "pink" : score >= 46 ? "amber" : score >= 34 ? "sky" : "green",
      } satisfies PracticePriority;
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);
}

function buildJourney(clubs: ProgressClub[], rows: ProgressClubRow[]): JourneyEvent[] {
  const events: JourneyEvent[] = [];

  for (const row of rows) {
    if (isNumber(row.carryDeltaYd) && row.carryDeltaYd >= 5) {
      events.push({
        clubId: row.clubId,
        clubType: row.clubType,
        title: `${formatClubType(row.clubType)} carry moved up`,
        detail: `${signed(row.carryDeltaYd)} yd versus the first clean baseline.`,
        tone: "green",
      });
    }

    if (isNumber(row.offlineDeltaYd) && row.offlineDeltaYd <= -8) {
      events.push({
        clubId: row.clubId,
        clubType: row.clubType,
        title: `${formatClubType(row.clubType)} miss pattern tightened`,
        detail: `${Math.abs(roundOne(row.offlineDeltaYd) ?? 0)} yd less average offline.`,
        tone: "sky",
      });
    }

    if (row.trustIndex >= 75 && row.sampleSize >= 10) {
      events.push({
        clubId: row.clubId,
        clubType: row.clubType,
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
      title: `${formatClubType(club.clubType)} personal best`,
      detail: `${club.analytics.progress.personalBestCarryYd} yd carry in the saved data.`,
      tone: "pink",
    });
  }

  if (events.length === 0 && clubs.length > 0) {
    events.push({
      clubId: clubs[0].clubId,
      clubType: clubs[0].clubType,
      title: "Baseline started",
      detail: "ForeKingHell has enough data to begin building personal comparisons.",
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
  const launchImprovement = analytics.launch.launchWindowScore !== null ? analytics.launch.launchWindowScore / 15 : 0;
  const trust = analytics.consistency.clubTrustIndex / 8;

  return Math.round(carry * 1.8 + speed * 3.2 - offline * 1.1 - Math.abs(launch) * 0.4 + launchImprovement + trust);
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

function practiceReason(analytics: ClubAnalytics) {
  if (analytics.sample.stockShots < 10) {
    return "Needs more clean full-shot data before strong conclusions.";
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

  return analytics.insights[0]?.body ?? "Highest-value club to keep moving based on the current trust profile.";
}

function findClub(clubs: ProgressClub[], clubId: string) {
  return clubs.find((club) => club.clubId === clubId);
}

function sortBy<T>(values: T[], score: (value: T) => number) {
  return [...values].sort((left, right) => score(right) - score(left));
}

function average(values: number[]) {
  const usable = values.filter(isNumber);
  return usable.length > 0 ? usable.reduce((total, value) => total + value, 0) / usable.length : null;
}

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function roundOne(value: number | null) {
  return value === null ? null : Math.round(value * 10) / 10;
}

function signed(value: number) {
  const rounded = roundOne(value) ?? 0;
  return `${rounded > 0 ? "+" : ""}${rounded}`;
}
