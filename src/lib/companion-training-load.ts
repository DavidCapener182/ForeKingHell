import "server-only";

import { and, asc, eq, gte } from "drizzle-orm";

import { getDb } from "@/db/client";
import { golfTrainingDailyLoad } from "@/db/schema";
import { calculateFitnessFreshnessSeries, toDateKey } from "@/lib/training/fitnessFreshness";
import { getTrainingStatus, getTrainingTrend } from "@/lib/training/trainingStatus";

const COMPANION_TRAINING_DAYS = 120;

export async function getCompanionTrainingLoad(userId: string) {
  const today = toDateKey(new Date());
  const start = new Date(`${today}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - (COMPANION_TRAINING_DAYS - 1));
  const startDate = toDateKey(start);
  const dailyRows = await getDb()
    .select({
      date: golfTrainingDailyLoad.date,
      load: golfTrainingDailyLoad.totalSessionLoad,
    })
    .from(golfTrainingDailyLoad)
    .where(
      and(eq(golfTrainingDailyLoad.userId, userId), gte(golfTrainingDailyLoad.date, startDate)),
    )
    .orderBy(asc(golfTrainingDailyLoad.date));
  const series = calculateFitnessFreshnessSeries(dailyRows, {
    startDate,
    endDate: today,
    fitnessDays: 84,
    minimumDays: COMPANION_TRAINING_DAYS,
  });
  const latest = series.at(-1) ?? null;

  return {
    latest,
    status: latest
      ? getTrainingStatus(latest.fitness, latest.fatigue, latest.form)
      : getTrainingStatus(0, 0, 100),
    trend: getTrainingTrend(series),
  };
}
