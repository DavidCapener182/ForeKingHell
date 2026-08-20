import { analysisConfidence } from "@/lib/analysis-confidence";
import { finiteNumbers, interquartileRange, median } from "@/lib/analysis-statistics";
import { calculateRepeatabilityScore } from "@/lib/repeatability-score";
import { recordEligibility } from "@/lib/shot-records";
import type { ShotReviewStatus } from "@/lib/shot-review";

export type EquipmentChangeShot = {
  sessionId: string;
  clubId: string;
  shotAt: Date;
  carryYd: number | null;
  totalYd: number | null;
  sideYd: number | null;
  ballSpeedMph: number | null;
  launchAngleDeg: number | null;
  spinRate: number | null;
  smashFactor: number | null;
  qualityTag?: string | null;
  shotCategory?: string | null;
  reviewStatus?: ShotReviewStatus | null;
  sessionSource?: string | null;
  sessionType?: string | null;
};

export function analyseEquipmentChange(input: {
  clubId: string;
  changeAt: Date;
  shots: EquipmentChangeShot[];
  windowDays?: number;
  sessionType?: string | null;
}) {
  const windowDays = Math.max(14, Math.min(365, input.windowDays ?? 90));
  const windowMs = windowDays * 86_400_000;
  const eligible = input.shots.filter(
    (shot) =>
      shot.clubId === input.clubId &&
      (!input.sessionType || shot.sessionType === input.sessionType) &&
      recordEligibility({
        carryYd: shot.carryYd,
        totalYd: shot.totalYd,
        qualityTag: shot.qualityTag,
        shotCategory: shot.shotCategory,
        reviewStatus: shot.reviewStatus,
        sessionSource: shot.sessionSource,
      }).trustedEligible,
  );
  const changeTime = input.changeAt.getTime();
  const beforeShots = eligible.filter((shot) => {
    const time = shot.shotAt.getTime();
    return time < changeTime && time >= changeTime - windowMs;
  });
  const afterShots = eligible.filter((shot) => {
    const time = shot.shotAt.getTime();
    return time >= changeTime && time <= changeTime + windowMs;
  });
  const before = summarize(beforeShots);
  const after = summarize(afterShots);
  const minimumSample = Math.min(before.sampleSize, after.sampleSize);
  const sessionCount = new Set([...beforeShots, ...afterShots].map((shot) => shot.sessionId)).size;
  const confidence = analysisConfidence({
    sampleSize: minimumSample,
    sessionCount,
    recencyDays: afterShots.length
      ? Math.max(
          0,
          (Date.now() - Math.max(...afterShots.map((shot) => shot.shotAt.getTime()))) / 86_400_000,
        )
      : null,
    outlierRate: input.shots.length ? 1 - eligible.length / input.shots.length : 1,
    metricCompleteness: minimumSample
      ? Math.min(before.metricCompleteness, after.metricCompleteness)
      : 0,
    coefficientOfVariation: null,
    crossSessionConsistency: sessionCount >= 4 ? 0.65 : null,
  });

  return {
    windowDays,
    before,
    after,
    deltas: {
      carryYd: delta(after.carryMedianYd, before.carryMedianYd),
      ballSpeedMph: delta(after.ballSpeedMedianMph, before.ballSpeedMedianMph),
      launchDeg: delta(after.launchMedianDeg, before.launchMedianDeg),
      spinRpm: delta(after.spinMedianRpm, before.spinMedianRpm),
      offlineYd: delta(after.absoluteOfflineMedianYd, before.absoluteOfflineMedianYd),
      repeatability: after.repeatability.score - before.repeatability.score,
      strike: delta(after.smashMedian, before.smashMedian),
    },
    confidence,
    comparable: before.sampleSize >= 5 && after.sampleSize >= 5,
    caveat:
      "This is an observational before/after association. Session conditions and swing changes mean it does not prove the equipment caused the result.",
  };
}

function summarize(shots: EquipmentChangeShot[]) {
  const carries = finiteNumbers(shots.map((shot) => shot.carryYd));
  const sides = finiteNumbers(shots.map((shot) => shot.sideYd));
  const ballSpeeds = finiteNumbers(shots.map((shot) => shot.ballSpeedMph));
  const launches = finiteNumbers(shots.map((shot) => shot.launchAngleDeg));
  const spins = finiteNumbers(shots.map((shot) => shot.spinRate));
  const smashes = finiteNumbers(shots.map((shot) => shot.smashFactor));
  const totalPresent =
    carries.length +
    sides.length +
    ballSpeeds.length +
    launches.length +
    spins.length +
    smashes.length;

  return {
    sampleSize: shots.length,
    sessionCount: new Set(shots.map((shot) => shot.sessionId)).size,
    carryMedianYd: median(carries),
    carryIqrYd: interquartileRange(carries),
    ballSpeedMedianMph: median(ballSpeeds),
    launchMedianDeg: median(launches),
    spinMedianRpm: median(spins),
    absoluteOfflineMedianYd: median(sides.map(Math.abs)),
    smashMedian: median(smashes),
    repeatability: calculateRepeatabilityScore(
      shots.map((shot) => ({
        carryYd: shot.carryYd,
        sideYd: shot.sideYd,
        sessionId: shot.sessionId,
        shotAt: shot.shotAt,
      })),
    ),
    metricCompleteness: shots.length ? totalPresent / (shots.length * 6) : 0,
  };
}

function delta(after: number | null, before: number | null) {
  return after === null || before === null ? null : Math.round((after - before) * 10) / 10;
}
