import type { TrainingOverTimeData } from "@/lib/training/trainingData";
import { trainingRangeDays, type TrainingRangeKey } from "@/lib/training/ranges";

export function selectTrainingRangeData(
  data: TrainingOverTimeData,
  rangeKey: TrainingRangeKey,
): TrainingOverTimeData {
  const rangeDays = trainingRangeDays(rangeKey);
  const rangeStartDate = addDays(data.today, -(rangeDays - 1));
  const series = data.series.filter((point) => point.date >= rangeStartDate);
  const chartStartDate = series[0]?.date ?? rangeStartDate;
  const sessionMarkers = data.sessionMarkers.filter((marker) => marker.date >= chartStartDate);
  const averageTrainingLoad =
    series.length > 0 ? series.reduce((total, point) => total + point.load, 0) / series.length : 0;

  return {
    ...data,
    rangeKey,
    rangeDays,
    chartStartDate,
    series,
    sessionMarkers,
    averageTrainingLoad,
  };
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
