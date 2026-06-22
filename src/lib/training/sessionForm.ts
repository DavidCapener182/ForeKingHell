export type SessionFormSnapshot = {
  kind: "round" | "shots" | "speed" | "load";
  title: string;
  sampleSize: number;
  scoreToParPer18?: number | null;
  averageOfflineYd?: number | null;
  playableRate?: number | null;
  carryAverageYd?: number | null;
  ballSpeedAverageMph?: number | null;
  carryStdDevYd?: number | null;
  maxSpeedMph?: number | null;
  averageSpeedMph?: number | null;
  sessionLoad?: number | null;
  rpe?: number | null;
};

export type SessionFormSignal = {
  adjustment: number;
  direction: "improving" | "dipping" | "steady" | "unknown";
  label: string;
  summaryLabel: string;
  detail: string;
  confidence: "high" | "medium" | "low";
  tone: "green" | "amber" | "slate";
};

const MAX_SESSION_FORM_ADJUSTMENT = 8;

export const neutralSessionFormSignal: SessionFormSignal = {
  adjustment: 0,
  direction: "unknown",
  label: "Needs comparison",
  summaryLabel: "No Golf Form comparison yet",
  detail:
    "Golf Form starts from a neutral performance baseline until a session can be compared with a similar previous one.",
  confidence: "low",
  tone: "slate",
};

export function aggregateSessionFormSnapshots(
  snapshots: SessionFormSnapshot[],
  title = "Combined session",
): SessionFormSnapshot | null {
  const [first] = snapshots;

  if (!first) {
    return null;
  }

  const matchingSnapshots = snapshots.filter((snapshot) => snapshot.kind === first.kind);
  const sampleSize = matchingSnapshots.reduce(
    (total, snapshot) => total + Math.max(0, snapshot.sampleSize),
    0,
  );
  const aggregateTitle = matchingSnapshots.length === 1 ? matchingSnapshots[0]!.title : title;

  if (first.kind === "round") {
    return {
      kind: "round",
      title: aggregateTitle,
      sampleSize,
      scoreToParPer18: weightedMean(matchingSnapshots, (snapshot) => snapshot.scoreToParPer18),
      sessionLoad: sumValues(matchingSnapshots, (snapshot) => snapshot.sessionLoad),
      rpe: weightedMean(matchingSnapshots, (snapshot) => snapshot.rpe),
    };
  }

  if (first.kind === "shots") {
    return {
      kind: "shots",
      title: aggregateTitle,
      sampleSize,
      averageOfflineYd: weightedMean(matchingSnapshots, (snapshot) => snapshot.averageOfflineYd),
      playableRate: weightedMean(matchingSnapshots, (snapshot) => snapshot.playableRate),
      carryAverageYd: weightedMean(matchingSnapshots, (snapshot) => snapshot.carryAverageYd),
      ballSpeedAverageMph: weightedMean(
        matchingSnapshots,
        (snapshot) => snapshot.ballSpeedAverageMph,
      ),
      carryStdDevYd: weightedMean(matchingSnapshots, (snapshot) => snapshot.carryStdDevYd),
      sessionLoad: sumValues(matchingSnapshots, (snapshot) => snapshot.sessionLoad),
      rpe: weightedMean(matchingSnapshots, (snapshot) => snapshot.rpe),
    };
  }

  if (first.kind === "speed") {
    return {
      kind: "speed",
      title: aggregateTitle,
      sampleSize,
      maxSpeedMph: maxValue(matchingSnapshots, (snapshot) => snapshot.maxSpeedMph),
      averageSpeedMph: weightedMean(matchingSnapshots, (snapshot) => snapshot.averageSpeedMph),
      sessionLoad: sumValues(matchingSnapshots, (snapshot) => snapshot.sessionLoad),
      rpe: weightedMean(matchingSnapshots, (snapshot) => snapshot.rpe),
    };
  }

  return {
    kind: "load",
    title: aggregateTitle,
    sampleSize,
    sessionLoad: sumValues(matchingSnapshots, (snapshot) => snapshot.sessionLoad),
    rpe: weightedMean(matchingSnapshots, (snapshot) => snapshot.rpe),
  };
}

export function calculateSessionFormSignal(
  latest: SessionFormSnapshot | null | undefined,
  previous: SessionFormSnapshot | null | undefined,
): SessionFormSignal {
  if (!latest || !previous || latest.kind !== previous.kind) {
    return neutralSessionFormSignal;
  }

  const result =
    latest.kind === "round"
      ? roundScore(latest, previous)
      : latest.kind === "shots"
        ? shotScore(latest, previous)
        : latest.kind === "speed"
          ? speedScore(latest, previous)
          : loadScore(latest, previous);

  if (!result) {
    return neutralSessionFormSignal;
  }

  return buildSignal(result.adjustment, result.detail, result.confidence);
}

function roundScore(latest: SessionFormSnapshot, previous: SessionFormSnapshot) {
  if (!isNumber(latest.scoreToParPer18) || !isNumber(previous.scoreToParPer18)) {
    return null;
  }

  const delta = previous.scoreToParPer18 - latest.scoreToParPer18;
  const adjustment = clamp(delta * 1.5, -MAX_SESSION_FORM_ADJUSTMENT, MAX_SESSION_FORM_ADJUSTMENT);
  const detail =
    Math.abs(delta) < 1
      ? "Latest round scored about the same versus par as the previous comparable round."
      : delta > 0
        ? `Latest round was ${formatOne(delta)} shots better versus par over 18 holes.`
        : `Latest round was ${formatOne(Math.abs(delta))} shots worse versus par over 18 holes.`;

  return {
    adjustment,
    detail,
    confidence: latest.sampleSize >= 18 && previous.sampleSize >= 18 ? "high" : "medium",
  } satisfies ScoreResult;
}

function shotScore(latest: SessionFormSnapshot, previous: SessionFormSnapshot) {
  if (latest.sampleSize < 5 || previous.sampleSize < 5) {
    return null;
  }

  let score = 0;
  const notes: string[] = [];

  score += scoredDelta({
    latest: latest.averageOfflineYd,
    previous: previous.averageOfflineYd,
    threshold: 1.5,
    direction: "lower",
    weight: 3,
    improved: "tighter offline",
    worse: "wider offline",
    notes,
  });
  score += scoredDelta({
    latest: latest.playableRate,
    previous: previous.playableRate,
    threshold: 5,
    direction: "higher",
    weight: 2,
    improved: "more playable shots",
    worse: "fewer playable shots",
    notes,
  });
  score += scoredDelta({
    latest: latest.carryAverageYd,
    previous: previous.carryAverageYd,
    threshold: 3,
    direction: "higher",
    weight: 1,
    improved: "stronger carry",
    worse: "carry dropped",
    penalizeWorse: false,
    notes,
  });
  score += scoredDelta({
    latest: latest.ballSpeedAverageMph,
    previous: previous.ballSpeedAverageMph,
    threshold: 2,
    direction: "higher",
    weight: 1,
    improved: "ball speed up",
    worse: "ball speed down",
    penalizeWorse: false,
    notes,
  });
  score += scoredDelta({
    latest: latest.carryStdDevYd,
    previous: previous.carryStdDevYd,
    threshold: 4,
    direction: "lower",
    weight: 1,
    improved: "carry more consistent",
    worse: "carry less consistent",
    notes,
  });

  const adjustment = clamp(score * 1.3, -MAX_SESSION_FORM_ADJUSTMENT, MAX_SESSION_FORM_ADJUSTMENT);
  const evidence =
    notes.length > 0 ? notes.slice(0, 2).join(" and ") : "similar launch-monitor output";

  return {
    adjustment,
    detail: `Latest session compared with the previous similar launch session: ${evidence}.`,
    confidence: latest.sampleSize >= 20 && previous.sampleSize >= 20 ? "high" : "medium",
  } satisfies ScoreResult;
}

function speedScore(latest: SessionFormSnapshot, previous: SessionFormSnapshot) {
  if (!isNumber(latest.maxSpeedMph) && !isNumber(latest.averageSpeedMph)) {
    return null;
  }

  let score = 0;
  const notes: string[] = [];

  score += scoredDelta({
    latest: latest.maxSpeedMph,
    previous: previous.maxSpeedMph,
    threshold: 2,
    direction: "higher",
    weight: 2,
    improved: "top speed up",
    worse: "top speed down",
    notes,
  });
  score += scoredDelta({
    latest: latest.averageSpeedMph,
    previous: previous.averageSpeedMph,
    threshold: 1.5,
    direction: "higher",
    weight: 1,
    improved: "average speed up",
    worse: "average speed down",
    notes,
  });

  return {
    adjustment: clamp(score * 1.5, -6, 6),
    detail: `Latest speed session compared with the previous one: ${
      notes.length > 0 ? notes.slice(0, 2).join(" and ") : "speed held steady"
    }.`,
    confidence: latest.sampleSize >= 15 && previous.sampleSize >= 15 ? "medium" : "low",
  } satisfies ScoreResult;
}

function loadScore(latest: SessionFormSnapshot, previous: SessionFormSnapshot) {
  if (!isNumber(latest.sessionLoad) || !isNumber(previous.sessionLoad)) {
    return null;
  }

  const loadDeltaRatio =
    previous.sessionLoad > 0
      ? (latest.sessionLoad - previous.sessionLoad) / previous.sessionLoad
      : 0;
  const rpeDelta = isNumber(latest.rpe) && isNumber(previous.rpe) ? latest.rpe - previous.rpe : 0;
  let adjustment = 0;
  let detail = "Latest manual load looks similar to the previous one.";

  if (loadDeltaRatio <= -0.2 && rpeDelta <= 0) {
    adjustment = 2;
    detail = "Latest manual load was lighter with no higher RPE, so form is nudged upward.";
  } else if (loadDeltaRatio >= 0.3 || rpeDelta >= 2) {
    adjustment = -2;
    detail = "Latest manual load was heavier or felt harder, so form is nudged downward.";
  }

  return {
    adjustment,
    detail,
    confidence: "low",
  } satisfies ScoreResult;
}

function buildSignal(
  adjustment: number,
  detail: string,
  confidence: SessionFormSignal["confidence"],
): SessionFormSignal {
  const roundedAdjustment = Math.round(adjustment);

  if (roundedAdjustment >= 2) {
    return {
      adjustment: roundedAdjustment,
      direction: "improving",
      label: "Golf Form improving",
      summaryLabel: `Improving (+${roundedAdjustment} comparison)`,
      detail,
      confidence,
      tone: "green",
    };
  }

  if (roundedAdjustment <= -2) {
    return {
      adjustment: roundedAdjustment,
      direction: "dipping",
      label: "Golf Form dipping",
      summaryLabel: `Dipping (${roundedAdjustment} comparison)`,
      detail,
      confidence,
      tone: "amber",
    };
  }

  return {
    adjustment: roundedAdjustment,
    direction: "steady",
    label: "Golf Form steady",
    summaryLabel: "Steady comparison signal",
    detail,
    confidence,
    tone: "slate",
  };
}

function scoredDelta(input: {
  latest?: number | null;
  previous?: number | null;
  threshold: number;
  direction: "higher" | "lower";
  weight: number;
  improved: string;
  worse: string;
  penalizeWorse?: boolean;
  notes: string[];
}) {
  if (!isNumber(input.latest) || !isNumber(input.previous)) {
    return 0;
  }

  const delta = input.latest - input.previous;
  const improved =
    input.direction === "higher" ? delta >= input.threshold : delta <= -input.threshold;
  const worse = input.direction === "higher" ? delta <= -input.threshold : delta >= input.threshold;

  if (improved) {
    input.notes.push(input.improved);
    return input.weight;
  }

  if (worse && input.penalizeWorse !== false) {
    input.notes.push(input.worse);
    return -input.weight;
  }

  return 0;
}

type ScoreResult = {
  adjustment: number;
  detail: string;
  confidence: SessionFormSignal["confidence"];
};

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(max, Math.max(min, value));
}

function weightedMean(
  snapshots: SessionFormSnapshot[],
  selector: (snapshot: SessionFormSnapshot) => number | null | undefined,
) {
  let weightedTotal = 0;
  let totalWeight = 0;

  for (const snapshot of snapshots) {
    const value = selector(snapshot);

    if (isNumber(value)) {
      const weight = Math.max(1, snapshot.sampleSize);
      weightedTotal += value * weight;
      totalWeight += weight;
    }
  }

  return totalWeight > 0 ? weightedTotal / totalWeight : null;
}

function sumValues(
  snapshots: SessionFormSnapshot[],
  selector: (snapshot: SessionFormSnapshot) => number | null | undefined,
) {
  let total = 0;
  let hasValue = false;

  for (const snapshot of snapshots) {
    const value = selector(snapshot);

    if (isNumber(value)) {
      total += value;
      hasValue = true;
    }
  }

  return hasValue ? total : null;
}

function maxValue(
  snapshots: SessionFormSnapshot[],
  selector: (snapshot: SessionFormSnapshot) => number | null | undefined,
) {
  const values = snapshots.map(selector).filter(isNumber);
  return values.length > 0 ? Math.max(...values) : null;
}

function formatOne(value: number) {
  return value.toLocaleString("en-GB", {
    maximumFractionDigits: 1,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
  });
}
