import { formatClubType } from "@/lib/club-format";
import type { ClubAnalytics } from "@/lib/club-analytics";
import {
  buildProgressSummary,
  type PracticePriority,
  type ProgressClub,
  type ProgressSignal,
  type ProgressSummary,
} from "@/lib/progress-summary";

export type CoachFocusArea = "distance" | "strike" | "launch" | "direction" | "delivery" | "data";

export type CoachClubCard = {
  clubId: string;
  clubType: string;
  clubName: string;
  brandModel: string;
  issue: CoachFocusArea;
  issueLabel: string;
  trustIndex: number;
  sampleSize: number;
  stockCarryYd: number | null;
  usualMiss: ClubAnalytics["accuracy"]["primaryMiss"];
  playableRate: number | null;
  launchWindow: { low: number; high: number };
  drill: string;
  reason: string;
  tone: "green" | "sky" | "pink" | "amber" | "slate";
};

export type CoachSessionBlock = {
  title: string;
  detail: string;
  duration: string;
  tone: "green" | "sky" | "pink" | "amber" | "slate";
};

export type CoachDrillChallenge = {
  id: string;
  dateKey: string;
  clubId: string;
  clubType: string;
  clubName: string;
  issue: CoachFocusArea;
  issueLabel: string;
  title: string;
  detail: string;
  target: string;
  winCondition: string;
  completionTarget: number;
  winRule: CoachDrillWinRule;
  completeAchievementId: string;
  winAchievementId: string;
  completeXp: number;
  winXp: number;
  tone: "green" | "sky" | "pink" | "amber" | "slate";
};

export type CoachDrillWinRule =
  | { kind: "clean-shots"; target: number }
  | { kind: "playable"; target: number }
  | { kind: "launch-window"; target: number; low: number; high: number }
  | { kind: "solid-strike"; target: number }
  | { kind: "delivery-window"; target: number }
  | { kind: "carry-window"; target: number; setSize: number; maxSpreadYd: number };

export type CoachTrainingImpactMetric = {
  label: string;
  before: string;
  after: string;
  delta: string;
  tone: "green" | "sky" | "pink" | "amber" | "slate";
};

export type CoachTrainingImpact = {
  clubId: string;
  clubName: string;
  issueLabel: string;
  status: "better" | "worse" | "mixed" | "needs-data";
  headline: string;
  detail: string;
  tone: "green" | "sky" | "pink" | "amber" | "slate";
  metrics: CoachTrainingImpactMetric[];
};

export type CoachSummary = {
  headline: string;
  subhead: string;
  nextPriority: PracticePriority | null;
  focusArea: CoachFocusArea;
  signals: ProgressSignal[];
  clubCards: CoachClubCard[];
  sessionPlan: CoachSessionBlock[];
  trainingImpact: CoachTrainingImpact[];
  summary: ProgressSummary;
};

export function buildCoachSummary(clubs: ProgressClub[]): CoachSummary {
  const summary = buildProgressSummary(clubs);
  const clubCards = clubs
    .map((club) => buildCoachClubCard(club))
    .sort((left, right) => priorityScore(right) - priorityScore(left));
  const topCard = clubCards.find((card) => card.sampleSize >= 3) ?? clubCards[0] ?? null;
  const nextPriority =
    summary.practicePlan.find((priority) => priority.clubId === topCard?.clubId) ??
    summary.practicePlan.find((priority) => {
      const card = clubCards.find((item) => item.clubId === priority.clubId);
      return (card?.sampleSize ?? 0) >= 3;
    }) ??
    summary.practicePlan[0] ??
    null;
  const focusArea = topCard?.issue ?? "data";

  return {
    headline: buildHeadline(summary, topCard),
    subhead: buildSubhead(summary, topCard),
    nextPriority,
    focusArea,
    signals: summary.signals,
    clubCards,
    sessionPlan: buildSessionPlan(clubCards),
    trainingImpact: buildTrainingImpact(clubs, clubCards),
    summary,
  };
}

export function buildCoachDrillChallenges(
  coach: CoachSummary,
  date = new Date(),
): CoachDrillChallenge[] {
  const dateKey = localDateKey(date);

  return coach.clubCards
    .filter((card) => card.sampleSize >= 3 || card.issue === "data")
    .slice(0, 3)
    .map((card, index) => buildCoachDrillChallenge(card, dateKey, index));
}

function buildCoachClubCard(club: ProgressClub): CoachClubCard {
  const analytics = club.analytics;
  const issue = primaryIssue(analytics);
  const stockCarryYd = analytics.distance.stockCarryYd;

  return {
    clubId: club.clubId,
    clubType: club.clubType,
    clubName: formatClubType(club.clubType),
    brandModel: club.brandModel,
    issue,
    issueLabel: issueLabel(issue),
    trustIndex: analytics.consistency.clubTrustIndex,
    sampleSize: analytics.sample.stockShots,
    stockCarryYd,
    usualMiss: analytics.accuracy.primaryMiss,
    playableRate: analytics.accuracy.playableShotRate,
    launchWindow: analytics.launch.launchWindow,
    drill: coachDrill(analytics, issue),
    reason: coachReason(analytics, issue),
    tone: toneForIssue(issue, analytics),
  };
}

function buildCoachDrillChallenge(
  card: CoachClubCard,
  dateKey: string,
  index: number,
): CoachDrillChallenge {
  const slug = `${dateKey}-${card.clubType}-${card.issue}`.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const template = drillChallengeTemplate(card);

  return {
    id: `coach-drill-${slug}`,
    dateKey,
    clubId: card.clubId,
    clubType: card.clubType,
    clubName: card.clubName,
    issue: card.issue,
    issueLabel: card.issueLabel,
    title: template.title,
    detail: template.detail,
    target: template.target,
    winCondition: template.winCondition,
    completionTarget: template.completionTarget,
    winRule: template.winRule,
    completeAchievementId: `coach_complete_${slug}`,
    winAchievementId: `coach_win_${slug}`,
    completeXp: index === 0 ? 60 : 40,
    winXp: index === 0 ? 160 : 120,
    tone: card.tone,
  };
}

function drillChallengeTemplate(card: CoachClubCard) {
  if (card.issue === "data") {
    return {
      title: `${card.clubName} baseline builder`,
      detail: "Hit normal stock swings and keep the sample clean: no chips, recoveries, or obvious warm-up swings.",
      target: "Record 12 full stock shots.",
      winCondition: "Win it by importing a clean 12-shot sample for this club.",
      completionTarget: 12,
      winRule: { kind: "clean-shots" as const, target: 12 },
    };
  }

  if (card.issue === "direction") {
    return {
      title: `${card.clubName} start-line gate`,
      detail: card.drill,
      target: "10 balls. Score one point for every shot inside the playable window.",
      winCondition: "Win it with 7 or more playable shots.",
      completionTarget: 10,
      winRule: { kind: "playable" as const, target: 7 },
    };
  }

  if (card.issue === "launch") {
    return {
      title: `${card.clubName} launch ladder`,
      detail: card.drill,
      target: "12 balls. Score one point for every launch inside the stated window.",
      winCondition: "Win it with 8 or more launch-window shots.",
      completionTarget: 12,
      winRule: {
        kind: "launch-window" as const,
        target: 8,
        low: card.launchWindow.low,
        high: card.launchWindow.high,
      },
    };
  }

  if (card.issue === "strike") {
    return {
      title: `${card.clubName} strike ladder`,
      detail: card.drill,
      target: "12 balls at 80% speed. Track stable ball speed and centred contact.",
      winCondition: "Win it with 8 solid strikes and no obvious speed chase.",
      completionTarget: 12,
      winRule: { kind: "solid-strike" as const, target: 8 },
    };
  }

  if (card.issue === "delivery") {
    return {
      title: `${card.clubName} delivery window`,
      detail: card.drill,
      target: "10 balls. Score one point when path is inside +/-5 degrees with a predictable start line.",
      winCondition: "Win it with 7 or more delivery-window shots.",
      completionTarget: 10,
      winRule: { kind: "delivery-window" as const, target: 7 },
    };
  }

  return {
    title: `${card.clubName} repeatable carry`,
    detail: card.drill,
    target: "Two five-ball sets. Keep both carry windows tight.",
    winCondition: "Win it when both sets finish inside an 8-yard carry window.",
    completionTarget: 10,
    winRule: { kind: "carry-window" as const, target: 2, setSize: 5, maxSpreadYd: 8 },
  };
}

function primaryIssue(analytics: ClubAnalytics): CoachFocusArea {
  if (analytics.sample.stockShots < 5) {
    return "data";
  }

  if ((analytics.accuracy.bigMissRate ?? 0) >= 30 || (analytics.accuracy.playableShotRate ?? 100) < 55) {
    return "direction";
  }

  if ((analytics.launch.launchWindowScore ?? 100) < 60 || (analytics.launch.lowFlightRate ?? 0) >= 25) {
    return "launch";
  }

  if ((analytics.strike.lowSmashRate ?? 0) >= 25 || (analytics.strike.speedLeakageRate ?? 0) >= 20) {
    return "strike";
  }

  if (
    (analytics.delivery.pathSpikeRate ?? 0) >= 25 ||
    Math.abs(analytics.delivery.clubPathAverageDeg ?? 0) >= 7 ||
    (analytics.delivery.hookRiskScore ?? 0) >= 35 ||
    (analytics.delivery.blockRiskScore ?? 0) >= 35
  ) {
    return "delivery";
  }

  if ((analytics.distance.carrySpreadYd ?? 0) >= 18 || analytics.consistency.carryConsistencyScore < 62) {
    return "distance";
  }

  return "direction";
}

function coachReason(analytics: ClubAnalytics, issue: CoachFocusArea) {
  if (issue === "data") {
    return `${analytics.sample.stockShots} clean stock shots. Add more normal swings before trusting strong conclusions.`;
  }

  if (issue === "direction") {
    return `${formatRate(analytics.accuracy.playableShotRate)} playable rate with a ${analytics.accuracy.primaryMiss.toLowerCase()} miss tendency.`;
  }

  if (issue === "launch") {
    return `${formatRate(analytics.launch.launchWindowScore)} launch-window score against the ${analytics.launch.launchWindow.low}-${analytics.launch.launchWindow.high} degree window.`;
  }

  if (issue === "strike") {
    return `${formatRate(analytics.strike.lowSmashRate)} low-smash rate. Improve contact before adding speed.`;
  }

  if (issue === "delivery") {
    return `Path averages ${formatSigned(analytics.delivery.clubPathAverageDeg)} degrees and needs a tighter delivery window.`;
  }

  return `Carry spread is ${formatNullableYards(analytics.distance.carrySpreadYd)}. The number needs more repeatability.`;
}

function buildHeadline(summary: ProgressSummary, topCard: CoachClubCard | null) {
  if (summary.totals.clubs === 0) {
    return "Import data to unlock your coach readout.";
  }

  if (!topCard) {
    return "The next job is building enough clean data.";
  }

  return `${topCard.clubName} is the next practice priority.`;
}

function buildSubhead(summary: ProgressSummary, topCard: CoachClubCard | null) {
  if (!topCard) {
    return "ForeKingHell needs clean full-shot samples before it can separate distance, strike, launch, direction, and delivery issues.";
  }

  return `${topCard.issueLabel} is the main signal. Bag trust is ${summary.totals.averageTrust}% across ${summary.totals.clubs} tracked clubs.`;
}

function buildSessionPlan(clubCards: CoachClubCard[]): CoachSessionBlock[] {
  const topCard = clubCards[0] ?? null;
  const secondCard = clubCards.find((card) => card.clubId !== topCard?.clubId) ?? null;

  if (!topCard) {
    return [
      {
        title: "Build the baseline",
        detail: "Import one range session and one scorecard, then repeat with the same club list.",
        duration: "20 min",
        tone: "slate",
      },
    ];
  }

  return [
    {
      title: "Warm-up calibration",
      detail: "Hit five easy wedges, five mid-irons, then three normal tee-club swings. Do not chase speed.",
      duration: "10 min",
      tone: "slate",
    },
    {
      title: `${topCard.clubName}: ${topCard.issueLabel}`,
      detail: topCard.drill,
      duration: "20 min",
      tone: topCard.tone,
    },
    {
      title: secondCard ? `${secondCard.clubName} maintenance` : "Stock-shot maintenance",
      detail: secondCard
        ? secondCard.drill
        : "Finish with two sets of five normal stock shots and record carry plus start line.",
      duration: "15 min",
      tone: secondCard?.tone ?? "green",
    },
  ];
}

function buildTrainingImpact(clubs: ProgressClub[], clubCards: CoachClubCard[]): CoachTrainingImpact[] {
  const clubsById = new Map(clubs.map((club) => [club.clubId, club]));

  return clubCards
    .slice(0, 4)
    .map((card) => {
      const club = clubsById.get(card.clubId);

      if (!club) {
        return null;
      }

      return buildTrainingImpactCard(club, card);
    })
    .filter((card): card is CoachTrainingImpact => card !== null);
}

function buildTrainingImpactCard(club: ProgressClub, card: CoachClubCard): CoachTrainingImpact {
  const analytics = club.analytics;
  const previous = analytics.progress.previousSession;
  const latest = analytics.progress.latestSession;
  const delta = analytics.progress.lastSessionDelta;

  if (!previous || !latest || !delta) {
    return {
      clubId: card.clubId,
      clubName: card.clubName,
      issueLabel: card.issueLabel,
      status: "needs-data",
      headline: "Needs one more comparable session",
      detail: `${card.clubName} needs at least three clean shots in two sessions before ForeKingHell can judge whether training helped.`,
      tone: "slate",
      metrics: [
        {
          label: "Latest clean shots",
          before: `${previous?.shotCount ?? 0}`,
          after: `${latest?.shotCount ?? 0}`,
          delta: "Need 3+ each",
          tone: "slate",
        },
      ],
    };
  }

  const status = impactStatus(card.issue, analytics);
  const tone = status === "better" ? "green" : status === "worse" ? "pink" : "amber";

  return {
    clubId: card.clubId,
    clubName: card.clubName,
    issueLabel: card.issueLabel,
    status,
    headline: impactHeadline(card, status),
    detail: impactDetail(card, status, delta),
    tone,
    metrics: buildImpactMetrics(analytics),
  };
}

function impactStatus(issue: CoachFocusArea, analytics: ClubAnalytics): CoachTrainingImpact["status"] {
  const previous = analytics.progress.previousSession;
  const latest = analytics.progress.latestSession;
  const delta = analytics.progress.lastSessionDelta;

  if (!previous || !latest || !delta) {
    return "needs-data";
  }

  if (issue === "direction") {
    return compareLowerIsBetter(delta.offlineDeltaYd, 2);
  }

  if (issue === "launch") {
    if (previous.launchAverageDeg === null || latest.launchAverageDeg === null) {
      return "mixed";
    }

    const midpoint = (analytics.launch.launchWindow.low + analytics.launch.launchWindow.high) / 2;
    const previousMiss = Math.abs(previous.launchAverageDeg - midpoint);
    const latestMiss = Math.abs(latest.launchAverageDeg - midpoint);
    return compareLowerIsBetter(roundOne(latestMiss - previousMiss), 1);
  }

  if (issue === "strike") {
    return compareHigherIsBetter(delta.ballSpeedDeltaMph, 1);
  }

  if (issue === "delivery") {
    if (previous.clubPathAverageDeg === null || latest.clubPathAverageDeg === null) {
      return "mixed";
    }

    return compareLowerIsBetter(
      roundOne(Math.abs(latest.clubPathAverageDeg) - Math.abs(previous.clubPathAverageDeg)),
      1,
    );
  }

  if (issue === "distance") {
    return compareHigherIsBetter(delta.carryDeltaYd, 1);
  }

  return "needs-data";
}

function buildImpactMetrics(analytics: ClubAnalytics): CoachTrainingImpactMetric[] {
  const previous = analytics.progress.previousSession;
  const latest = analytics.progress.latestSession;
  const delta = analytics.progress.lastSessionDelta;

  if (!previous || !latest || !delta) {
    return [];
  }

  return [
    {
      label: "Carry",
      before: formatNullableYards(previous.carryMedianYd),
      after: formatNullableYards(latest.carryMedianYd),
      delta: formatDelta(delta.carryDeltaYd, "yd"),
      tone: metricTone(delta.carryDeltaYd, "higher"),
    },
    {
      label: "Offline",
      before: formatNullableYards(previous.absoluteOfflineAverageYd),
      after: formatNullableYards(latest.absoluteOfflineAverageYd),
      delta: formatDelta(delta.offlineDeltaYd, "yd"),
      tone: metricTone(delta.offlineDeltaYd, "lower"),
    },
    {
      label: "Launch",
      before: formatDegrees(previous.launchAverageDeg),
      after: formatDegrees(latest.launchAverageDeg),
      delta: formatDelta(delta.launchDeltaDeg, "deg"),
      tone: launchTone(analytics),
    },
    {
      label: "Ball speed",
      before: formatMph(previous.ballSpeedAverageMph),
      after: formatMph(latest.ballSpeedAverageMph),
      delta: formatDelta(delta.ballSpeedDeltaMph, "mph"),
      tone: metricTone(delta.ballSpeedDeltaMph, "higher"),
    },
  ];
}

function impactHeadline(card: CoachClubCard, status: CoachTrainingImpact["status"]) {
  if (status === "better") {
    return `${card.clubName} improved after the latest session`;
  }

  if (status === "worse") {
    return `${card.clubName} went backwards on the target metric`;
  }

  if (status === "needs-data") {
    return "Needs one more comparable session";
  }

  return `${card.clubName} is mixed after the latest session`;
}

function impactDetail(card: CoachClubCard, status: CoachTrainingImpact["status"], delta: NonNullable<ClubAnalytics["progress"]["lastSessionDelta"]>) {
  if (card.issue === "direction") {
    const offline = delta.offlineDeltaYd;
    return status === "better"
      ? `The direction work helped: average offline tightened by ${formatAbs(offline)} yd versus the previous comparable session.`
      : status === "worse"
        ? `Average offline widened by ${formatAbs(offline)} yd. Keep the same guardrail drill before changing the swing thought.`
        : "Direction was mixed. Check carry, launch, and offline together before judging the session.";
  }

  if (card.issue === "launch") {
    return status === "better"
      ? "Launch moved closer to the useful window for this club."
      : status === "worse"
        ? "Launch moved farther from the useful window, so repeat the launch-window block."
        : "Launch was mixed. Keep tracking whether the average is moving toward the target window.";
  }

  if (card.issue === "strike") {
    return status === "better"
      ? `Ball speed improved by ${formatAbs(delta.ballSpeedDeltaMph)} mph, which suggests the strike work helped.`
      : status === "worse"
        ? `Ball speed dropped by ${formatAbs(delta.ballSpeedDeltaMph)} mph. Prioritise centred contact before adding speed.`
        : "Strike output was mixed. Look for stable ball speed over one-off fast swings.";
  }

  if (card.issue === "delivery") {
    return status === "better"
      ? "Club path moved closer to neutral in the latest session."
      : status === "worse"
        ? "Club path moved farther from neutral. Keep the delivery window small next session."
        : "Delivery was mixed. Use the path metric only where club data exists.";
  }

  if (card.issue === "distance") {
    return status === "better"
      ? `Stock carry improved by ${formatAbs(delta.carryDeltaYd)} yd versus the previous comparable session.`
      : status === "worse"
        ? `Stock carry dropped by ${formatAbs(delta.carryDeltaYd)} yd, so check strike before chasing speed.`
        : "Distance was mixed. The goal is repeatability, not one longer shot.";
  }

  return "Build one more comparable session before judging whether the practice block helped.";
}

function coachDrill(analytics: ClubAnalytics, issue: CoachFocusArea) {
  if (issue === "data") {
    return "Hit 12 normal stock shots with this club and keep only full-swing results in the sample.";
  }

  if (issue === "direction") {
    return `Hit 10 balls with a hard ${analytics.accuracy.primaryMiss.toLowerCase()} boundary. Count only shots inside the playable window.`;
  }

  if (issue === "launch") {
    return `Hit 12 stock shots and count how many launch inside ${analytics.launch.launchWindow.low}-${analytics.launch.launchWindow.high} degrees.`;
  }

  if (issue === "strike") {
    return "Hit 12 balls at 80% speed. The goal is stable ball speed and smash before adding speed.";
  }

  if (issue === "delivery") {
    return "Hit 10 delivery-window shots. The goal is path inside +/-5 degrees with a predictable start line.";
  }

  return "Hit two five-ball stock sets. The goal is the same carry window twice, not one maximum shot.";
}

function priorityScore(card: CoachClubCard) {
  if (card.sampleSize < 3) {
    return 8 + card.sampleSize;
  }

  const trustGap = 100 - card.trustIndex;
  const dataPenalty = card.issue === "data" ? 14 : 0;
  const playableGap = 100 - (card.playableRate ?? 55);
  return trustGap + playableGap * 0.5 + dataPenalty;
}

function issueLabel(issue: CoachFocusArea) {
  const labels: Record<CoachFocusArea, string> = {
    distance: "Distance reliability",
    strike: "Strike quality",
    launch: "Launch window",
    direction: "Direction control",
    delivery: "Delivery pattern",
    data: "Data depth",
  };

  return labels[issue];
}

function toneForIssue(issue: CoachFocusArea, analytics: ClubAnalytics) {
  if (issue === "data") {
    return "slate";
  }

  if (analytics.consistency.clubTrustIndex >= 75) {
    return "green";
  }

  if (issue === "direction" || issue === "strike") {
    return "pink";
  }

  if (issue === "launch" || issue === "delivery") {
    return "amber";
  }

  return "sky";
}

function formatRate(value: number | null) {
  return value === null ? "--" : `${Math.round(value)}%`;
}

function formatSigned(value: number | null) {
  if (value === null) {
    return "--";
  }

  return `${value > 0 ? "+" : ""}${Math.round(value * 10) / 10}`;
}

function formatNullableYards(value: number | null) {
  return value === null ? "--" : `${Math.round(value * 10) / 10} yd`;
}

function formatMph(value: number | null) {
  return value === null ? "--" : `${Math.round(value * 10) / 10} mph`;
}

function formatDegrees(value: number | null) {
  return value === null ? "--" : `${Math.round(value * 10) / 10} deg`;
}

function formatDelta(value: number | null, unit: string) {
  return value === null ? "--" : `${value > 0 ? "+" : ""}${Math.round(value * 10) / 10} ${unit}`;
}

function formatAbs(value: number | null) {
  return value === null ? "--" : `${Math.abs(Math.round(value * 10) / 10)}`;
}

function metricTone(value: number | null, direction: "higher" | "lower") {
  if (value === null || Math.abs(value) < 0.5) {
    return "slate";
  }

  const improved = direction === "higher" ? value > 0 : value < 0;
  return improved ? "green" : "amber";
}

function launchTone(analytics: ClubAnalytics) {
  const previous = analytics.progress.previousSession?.launchAverageDeg;
  const latest = analytics.progress.latestSession?.launchAverageDeg;

  if (previous === null || previous === undefined || latest === null || latest === undefined) {
    return "slate";
  }

  const midpoint = (analytics.launch.launchWindow.low + analytics.launch.launchWindow.high) / 2;
  const movement = Math.abs(latest - midpoint) - Math.abs(previous - midpoint);

  if (Math.abs(movement) < 0.75) {
    return "slate";
  }

  return movement < 0 ? "green" : "amber";
}

function compareHigherIsBetter(value: number | null, threshold: number): CoachTrainingImpact["status"] {
  if (value === null || Math.abs(value) < threshold) {
    return "mixed";
  }

  return value > 0 ? "better" : "worse";
}

function compareLowerIsBetter(value: number | null, threshold: number): CoachTrainingImpact["status"] {
  if (value === null || Math.abs(value) < threshold) {
    return "mixed";
  }

  return value < 0 ? "better" : "worse";
}

function roundOne(value: number | null) {
  return value === null ? null : Math.round(value * 10) / 10;
}

function localDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}
