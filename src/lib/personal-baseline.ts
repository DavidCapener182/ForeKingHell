import { analysisConfidence } from "@/lib/analysis-confidence";
import {
  finiteNumbers,
  interquartileRange,
  median,
  sampleStandardDeviation,
} from "@/lib/analysis-statistics";

export type BaselineShot = {
  clubId: string;
  shotType?: string | null;
  sessionId: string;
  shotAt: Date;
  carryYd: number | null;
  sideYd: number | null;
  trusted: boolean;
};

export function buildPersonalBaselines(
  shots: BaselineShot[],
  options: { referenceDate?: Date; minimumSamples?: number } = {},
) {
  const referenceDate = options.referenceDate ?? new Date();
  const minimumSamples = Math.max(1, options.minimumSamples ?? 8);
  const trusted = shots.filter((shot) => shot.trusted && shot.shotAt <= referenceDate);
  const groups = new Map<string, BaselineShot[]>();

  for (const shot of trusted) {
    const key = `${shot.clubId}::${shot.shotType ?? "stock"}`;
    groups.set(key, [...(groups.get(key) ?? []), shot]);
  }

  return [...groups.entries()].map(([key, rows]) => {
    const [clubId, shotType] = key.split("::") as [string, string];
    return {
      clubId,
      shotType,
      recent30: summarizeWindow(rows, referenceDate, 30, minimumSamples),
      recent90: summarizeWindow(rows, referenceDate, 90, minimumSamples),
      allTime: summarize(rows, referenceDate, minimumSamples),
    };
  });
}

function summarizeWindow(
  shots: BaselineShot[],
  referenceDate: Date,
  days: number,
  minimumSamples: number,
) {
  const start = new Date(referenceDate.getTime() - days * 86_400_000);
  return summarize(
    shots.filter((shot) => shot.shotAt >= start),
    referenceDate,
    minimumSamples,
  );
}

function summarize(shots: BaselineShot[], referenceDate: Date, minimumSamples: number) {
  if (shots.length < minimumSamples) return null;
  const carries = finiteNumbers(shots.map((shot) => shot.carryYd));
  const sides = finiteNumbers(shots.map((shot) => shot.sideYd));
  if (carries.length < minimumSamples) return null;
  const sessionIds = new Set(shots.map((shot) => shot.sessionId));
  const carryMedian = median(carries);
  const latest = Math.max(...shots.map((shot) => shot.shotAt.getTime()));
  const sessionMedians = [...sessionIds].map((sessionId) =>
    median(
      finiteNumbers(
        shots.filter((shot) => shot.sessionId === sessionId).map((shot) => shot.carryYd),
      ),
    ),
  );
  const completeSessionMedians = finiteNumbers(sessionMedians);
  const sessionVariation = sampleStandardDeviation(completeSessionMedians);
  const crossSessionConsistency =
    carryMedian && sessionVariation !== null
      ? 1 - Math.min(1, sessionVariation / Math.max(1, Math.abs(carryMedian) * 0.15))
      : null;

  return {
    sampleSize: shots.length,
    sessionCount: sessionIds.size,
    carryMedianYd: carryMedian,
    carryIqrYd: interquartileRange(carries),
    offlineMedianYd: median(sides),
    offlineIqrYd: interquartileRange(sides),
    confidence: analysisConfidence({
      sampleSize: shots.length,
      sessionCount: sessionIds.size,
      recencyDays: Math.max(0, (referenceDate.getTime() - latest) / 86_400_000),
      outlierRate: 0,
      metricCompleteness: shots.length ? Math.min(carries.length, sides.length) / shots.length : 0,
      coefficientOfVariation:
        carryMedian && carries.length > 1
          ? (sampleStandardDeviation(carries) ?? 0) / Math.max(1, Math.abs(carryMedian))
          : null,
      crossSessionConsistency,
    }),
  };
}
