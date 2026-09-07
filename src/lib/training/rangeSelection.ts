import type { TrainingOverTimeData } from "@/lib/training/trainingData";
import {
  trainingRangeDays,
  type TrainingRangeKey,
  type TrainingScope,
} from "@/lib/training/ranges";

export function selectTrainingRangeData(
  data: TrainingOverTimeData,
  rangeKey: TrainingRangeKey,
  scope?: TrainingScope,
): TrainingOverTimeData {
  const rangeDays = trainingRangeDays(rangeKey);
  const rangeStartDate = scope?.from || addDays(data.today, -(rangeDays - 1));
  const endDate = scope?.to || data.today;
  let series = data.series.filter((point) => point.date >= rangeStartDate && point.date <= endDate);
  const chartStartDate = series[0]?.date ?? rangeStartDate;
  let sessionMarkers = data.sessionMarkers.filter(
    (marker) => marker.date >= chartStartDate && marker.date <= endDate,
  );
  const sessions = data.sessions.filter(
    (session) =>
      session.sessionDate >= chartStartDate &&
      session.sessionDate <= endDate &&
      (!scope || scope.activity === "all" || session.sourceType === scope.activity) &&
      (!scope?.q ||
        `${session.title} ${session.notes ?? ""}`.toLowerCase().includes(scope.q.toLowerCase())),
  );
  if (scope && (scope.activity !== "all" || scope.q)) {
    const loads = new Map<string, number>();
    for (const session of sessions)
      loads.set(session.sessionDate, (loads.get(session.sessionDate) ?? 0) + session.sessionLoad);
    series = series.map((point) => ({ ...point, load: loads.get(point.date) ?? 0 }));
    sessionMarkers = sessionMarkers
      .filter((marker) => loads.has(marker.date))
      .map((marker) => ({
        ...marker,
        totalLoad: loads.get(marker.date)!,
        sessionCount: sessions.filter((session) => session.sessionDate === marker.date).length,
        title: "Matching training entries",
      }));
  }
  const averageTrainingLoad =
    series.length > 0 ? series.reduce((total, point) => total + point.load, 0) / series.length : 0;

  return {
    ...data,
    rangeKey,
    rangeDays,
    chartStartDate,
    series,
    sessionMarkers,
    sessions,
    averageTrainingLoad,
  };
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
