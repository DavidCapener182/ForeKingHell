import { clubSpeedMeasurementTrust } from "@/lib/club-speed-evidence";
import { isRoundSessionType } from "@/lib/round-sessions";
import {
  assessFlightEvidence,
  withDirectionalConfidence,
  type FlightEvidenceInput,
  type SessionDataConfidence,
} from "@/lib/session-data-confidence";
import { isShotEvidenceEligible, type ShotReviewStatus } from "@/lib/shot-review";
import { calculateStockYardage } from "@/lib/stock-yardage";
import { detectShotDataIntegrityIssue } from "@/lib/shot-data-integrity";

export type DevelopmentShot = FlightEvidenceInput & {
  id: string;
  sessionId: string;
  clubId: string;
  clubType: string;
  shotAt: Date;
  sessionSource: string;
  sessionType: string;
  playContext: string;
  fileName: string | null;
  carryYd: number | null;
  totalYd: number | null;
  ballSpeedMph: number | null;
  clubSpeedMph: number | null;
  smashFactor: number | null;
  launchAngleDeg: number | null;
  attackAngleDeg: number | null;
  apexFt: number | null;
  sideCarryYd: number | null;
  clubDataEstType: string | null;
  reviewStatus: ShotReviewStatus;
  qualityTag: string | null;
  shotCategory: string;
};
export type EvidenceMetric = {
  value: number | null;
  sampleSize: number;
  confidence: "limited" | "developing" | "supported" | "unavailable";
  reason: string;
};
export type DriverDevelopmentSnapshot = {
  date: string;
  comparisonLabel: string;
  currentShotCount: number;
  rawShotCount: number;
  sessions: Array<{ id: string; label: string; confidence: SessionDataConfidence }>;
  metrics: Record<
    "carry" | "clubSpeed" | "ballSpeed" | "smash" | "launch" | "attack" | "offline",
    EvidenceMetric
  >;
  changes: Array<{
    key: string;
    label: string;
    delta: number | null;
    unit: string;
    status: "improved" | "stable" | "regressed" | "uncertain";
  }>;
  stockCarry: number | null;
  courseCarry: number | null;
  goodStrikeCarry: number | null;
  capabilityCarry: number | null;
  bestCarry: number | null;
  peakSpeed: number | null;
  repeatability: {
    count: number;
    sampleSize: number;
    percent: number | null;
    targetPercent: number;
  };
  project: {
    goal: number;
    bestGap: number | null;
    bestProgress: number | null;
    evidenceBestCarry: number | null;
    source: string;
  };
  directionReviewCount: number;
  directionOmittedCount: number;
  conclusion: string;
  nextAction: string;
};
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const mean = (vs: number[]) => (vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null);
const max = (vs: number[]) => (vs.length ? Math.max(...vs) : null);
function percentile(values: number[], p: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  return (
    sorted[Math.floor(index)] +
    (sorted[Math.ceil(index)] - sorted[Math.floor(index)]) * (index - Math.floor(index))
  );
}
export function practiceDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
function eligible(shot: DevelopmentShot) {
  return (
    isShotEvidenceEligible(shot) &&
    ["full", "tee", "approach"].includes(shot.shotCategory) &&
    !detectShotDataIntegrityIssue(shot)
  );
}
function measured(shot: DevelopmentShot) {
  // Match existing speed evidence convention; estimates cannot establish playing speed.
  return clubSpeedMeasurementTrust(shot.clubDataEstType) === "measured";
}
export function buildDriverDevelopmentSnapshot(
  rows: readonly DevelopmentShot[],
  requestedDate?: string,
  carryProject?: { targetCarryYd: number; currentBestCarryYd: number | null; carrySource: string },
): DriverDevelopmentSnapshot | null {
  const drivers = rows
    .filter((s) => s.clubType === "driver" && !isRoundSessionType(s.sessionType))
    .sort((a, b) => b.shotAt.getTime() - a.shotAt.getTime());
  const latest = requestedDate
    ? drivers.find((s) => practiceDate(s.shotAt) === requestedDate)
    : drivers[0];
  if (!latest) return null;
  const date = practiceDate(latest.shotAt);
  const comparable = drivers.filter(
    (s) =>
      s.clubId === latest.clubId &&
      s.sessionSource === latest.sessionSource &&
      s.playContext === latest.playContext &&
      practiceDate(s.shotAt) <= date,
  );
  const raw = comparable.filter((s) => practiceDate(s.shotAt) === date);
  const current = raw.filter(eligible);
  const previous = comparable
    .filter((s) => practiceDate(s.shotAt) < date && eligible(s))
    .slice(0, 50);
  const reviewed = current.map(withDirectionalConfidence);
  const priorReviewed = previous.map(withDirectionalConfidence);
  const metric = (key: keyof DevelopmentShot, speedOnly = false): EvidenceMetric => {
    const values = reviewed
      .filter((s) => !speedOnly || measured(s))
      .map((s) => s[key])
      .filter(finite);
    const limited =
      key === "sideCarryYd" &&
      current.some((s) => assessFlightEvidence(s).directionConfidence === "limited");
    return {
      value: mean(values.map((v) => (key === "sideCarryYd" ? Math.abs(v) : v))),
      sampleSize: values.length,
      confidence: !values.length
        ? "unavailable"
        : limited
          ? "limited"
          : values.length >= 10
            ? "supported"
            : "developing",
      reason:
        key === "sideCarryYd"
          ? "Absolute source-reported offline; questioned direction omitted. Alignment and source method limit interpretation."
          : `${values.length} eligible readings from this practice day${speedOnly ? "; measured club data only" : ""}. This is evidence coverage, not a calibrated probability.`,
    };
  };
  const metrics = {
    carry: metric("carryYd"),
    clubSpeed: metric("clubSpeedMph", true),
    ballSpeed: metric("ballSpeedMph"),
    smash: metric("smashFactor", true),
    launch: metric("launchAngleDeg"),
    attack: metric("attackAngleDeg", true),
    offline: metric("sideCarryYd"),
  };
  const specs = [
    ["carry", "carryYd", "Carry", "yd", 2],
    ["clubSpeed", "clubSpeedMph", "Club speed", "mph", 0.5],
    ["ballSpeed", "ballSpeedMph", "Ball speed", "mph", 1],
    ["smash", "smashFactor", "Smash", "", 0.02],
    ["launch", "launchAngleDeg", "Launch", "°", 1],
    ["offline", "sideCarryYd", "Absolute offline", "yd", 2],
  ] as const;
  const changes = specs.map(([key, field, label, unit, threshold]) => {
    const baseline = priorReviewed
      .filter((s) => !["clubSpeed", "smash"].includes(key) || measured(s))
      .map((s) => s[field])
      .filter(finite)
      .map((v) => (field === "sideCarryYd" ? Math.abs(v) : v));
    const value = metrics[key].value;
    const before = mean(baseline);
    const delta =
      value !== null &&
      before !== null &&
      baseline.length >= 5 &&
      metrics[key].sampleSize >= 5 &&
      metrics[key].confidence !== "limited"
        ? value - before
        : null;
    const improvement = key === "offline" ? -(delta ?? 0) : (delta ?? 0);
    return {
      key,
      label,
      unit,
      delta,
      status:
        delta === null
          ? ("uncertain" as const)
          : Math.abs(delta) < threshold
            ? ("stable" as const)
            : key === "launch"
              ? ("uncertain" as const)
              : improvement > 0
                ? ("improved" as const)
                : ("regressed" as const),
    };
  });
  const carries = current.map((s) => s.carryYd).filter(finite);
  const bestCarry = max(carries);
  const goal = carryProject?.targetCarryYd ?? 220;
  const evidenceBestCarry = carryProject ? carryProject.currentBestCarryYd : bestCarry;
  const stock = calculateStockYardage(
    comparable.filter(eligible).map(withDirectionalConfidence),
    50,
    { clubType: "driver" },
  );
  const directionOmittedCount = current.filter(
    (s) => !assessFlightEvidence(s).directionUsable,
  ).length;
  const directionReviewCount = current.filter((s) => assessFlightEvidence(s).needsReview).length;
  const carryChange = changes.find((c) => c.key === "carry")!;
  const speedChange = changes.find((c) => c.key === "ballSpeed")!;
  const conclusion =
    carryChange.status === "improved"
      ? speedChange.status === "improved"
        ? "Carry and ball speed increased together versus your previous comparable shots. This is consistent with a speed contribution, but does not isolate the cause."
        : "Carry increased versus your previous comparable shots. The available measurements do not establish a single cause."
      : carryChange.status === "regressed"
        ? "Average carry decreased versus your previous comparable shots. Check strike and session conditions before changing your setup."
        : carryChange.status === "stable"
          ? "Average carry is within 2 yd of your previous comparable shots."
          : "This practice day adds useful evidence. More comparable shots are needed before calling a distance improvement.";
  return {
    date,
    comparisonLabel: `This practice day versus ${previous.length} preceding eligible Driver shots (up to 50; same club, source and context).`,
    rawShotCount: raw.length,
    currentShotCount: current.length,
    sessions: [
      ...new Map(
        raw.map((s) => [
          s.sessionId,
          {
            id: s.sessionId,
            label: s.fileName ?? "Practice upload",
            confidence: s.dataConfidence ?? {},
          },
        ]),
      ).values(),
    ],
    metrics,
    changes,
    stockCarry: stock.carryMedianYd,
    courseCarry: stock.recommendedPlayNumberYd,
    goodStrikeCarry: carries.length >= 10 ? percentile(carries, 0.75) : null,
    capabilityCarry: carries.length >= 10 ? percentile(carries, 0.9) : null,
    bestCarry,
    peakSpeed: max(
      current
        .filter(measured)
        .map((s) => s.clubSpeedMph)
        .filter(finite),
    ),
    repeatability: {
      count: carries.filter((v) => v >= 200).length,
      sampleSize: carries.length,
      percent: carries.length
        ? (carries.filter((v) => v >= 200).length / carries.length) * 100
        : null,
      targetPercent: 70,
    },
    project: {
      goal,
      evidenceBestCarry,
      source: carryProject?.carrySource ?? "Today’s eligible Driver carry",
      bestGap: evidenceBestCarry === null ? null : Math.max(0, goal - evidenceBestCarry),
      bestProgress:
        evidenceBestCarry === null ? null : Math.min(100, (evidenceBestCarry / goal) * 100),
    },
    directionReviewCount,
    directionOmittedCount,
    conclusion,
    nextAction:
      directionOmittedCount || directionReviewCount
        ? "Check alignment and review the flagged direction readings before judging control or speed transfer."
        : "Use your next practice to repeat your good carries, then check whether strike and target control hold up. A peak alone does not establish speed transfer.",
  };
}
