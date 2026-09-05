import type { QuickBagClub } from "@/app/quick-bag/quick-bag-client";
import type { CourseTwinBagProfile } from "./course-twin-strategy";
import { selectLatestReliableStockShots, type StockShot } from "./stock-yardage";

type ModelShot = StockShot & { spinRate?: number | null; spinAxis?: number | null };

/** Same selected full-swing window as Bag; optional launch metrics never come from older shots. */
export function mobileCourseTwinBagProfile(
  club: QuickBagClub,
  shots: ModelShot[],
): CourseTwinBagProfile | null {
  if (
    club.evidenceKind !== "full" ||
    !club.clubType ||
    club.trustedCarryYd == null ||
    !Number.isFinite(club.trustedCarryYd) ||
    club.trustedCarryYd <= 0 ||
    club.sampleSize < 5
  )
    return null;
  const measured = selectLatestReliableStockShots(shots, shots.length, {
    clubType: club.clubType,
  }).filteredShots;
  const carries = numbers(measured.map((shot) => shot.carryYd));
  const sides = numbers(measured.map((shot) => shot.sideCarryYd));
  // A zero-centred invented miss pattern would make hazard recommendations misleading.
  if (carries.length < 5 || sides.length < 5) return null;
  const speeds = numbers(measured.map((shot) => shot.ballSpeedMph));
  const launches = numbers(measured.map((shot) => shot.launchAngleDeg));
  const spins = numbers(measured.map((shot) => shot.spinRate));
  const spinAxes = numbers(measured.map((shot) => shot.spinAxis));
  return {
    clubId: club.id,
    clubType: club.clubType,
    sampleSize: measured.length,
    confidenceScore: club.confidence,
    carryMedianYd: club.trustedCarryYd,
    carryStdDevYd: Math.max(2.5, deviation(carries) ?? 5),
    totalMedianYd: club.totalYd ?? null,
    sideMeanYd: mean(sides)!,
    sideStdDevYd: Math.max(2, deviation(sides) ?? 4),
    ballSpeedMeanMph: mean(speeds),
    ballSpeedStdDevMph: deviation(speeds),
    launchMeanDeg: mean(launches),
    launchStdDevDeg: deviation(launches),
    spinMeanRpm: mean(spins),
    spinStdDevRpm: deviation(spins),
    spinAxisMeanDeg: spinAxes.length >= 3 ? mean(spinAxes) : null,
    spinAxisStdDevDeg: spinAxes.length >= 3 ? deviation(spinAxes) : null,
    evidenceWindow: {
      basis: "latest-reliable",
      latestShotAt: club.latestEvidenceDate,
      lateralSampleSize: sides.length,
      lowCarryYd: club.lowYd,
      highCarryYd: club.highYd,
    },
  };
}
function numbers(values: Array<number | null | undefined>) {
  return values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
}
function mean(values: number[]) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
}
function deviation(values: number[]) {
  const average = mean(values);
  return average === null || values.length < 2
    ? null
    : Math.sqrt(
        values.reduce((total, value) => total + (value - average) ** 2, 0) / (values.length - 1),
      );
}
