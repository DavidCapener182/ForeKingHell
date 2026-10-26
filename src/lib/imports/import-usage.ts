import "server-only";
import { and, count, eq, gte, lt, ne, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { importFiles, usageEvents } from "@/db/schema";
import { getActivePlanKeyForUser } from "@/lib/billing";
import type { PlanKey } from "@/lib/billing-plan-catalog";
import { monthlyImportAllowance } from "./import-allowance";

export type ImportUsageExecutor = Pick<ReturnType<typeof getDb>, "select">;
export async function readMonthlyImportUsage(
  userId: string,
  planKey: PlanKey,
  executor: ImportUsageExecutor = getDb(),
  now = new Date(),
) {
  const window = monthlyImportAllowance(planKey, 0, now);
  const [events] = await executor
    .select({ total: sql<number>`coalesce(sum(${usageEvents.quantity}),0)::int` })
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.userId, userId),
        eq(usageEvents.eventType, "subscription_import"),
        gte(usageEvents.createdAt, window.start),
        lt(usageEvents.createdAt, window.end),
      ),
    );
  const eventUsage = events?.total ?? 0;
  let used = eventUsage;
  if (eventUsage === 0) {
    const [legacy] = await executor
      .select({ total: count() })
      .from(importFiles)
      .where(
        and(
          eq(importFiles.userId, userId),
          ne(importFiles.status, "duplicate"),
          gte(importFiles.createdAt, window.start),
          lt(importFiles.createdAt, window.end),
        ),
      );
    used = legacy?.total ?? 0;
  }
  return {
    ...monthlyImportAllowance(planKey, used, now),
    planKey,
    legacyUsageToMigrate: eventUsage === 0 ? used : 0,
  };
}
export async function getMonthlyImportUsage(userId: string, now = new Date()) {
  return readMonthlyImportUsage(userId, await getActivePlanKeyForUser(userId), getDb(), now);
}
export type MonthlyImportUsage = Awaited<ReturnType<typeof getMonthlyImportUsage>>;
export type ImportLimitDetails = {
  used: number;
  limit: number;
  resetsAt: string;
  upgrade: { plus: string; trialEligible: boolean };
};
