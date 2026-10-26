"use server";
import { and, eq, ne, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { importFiles, stockYardages } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/current-user";
import { getMonthlyImportUsage } from "@/lib/imports/import-usage";
import { getProTrialEligibility } from "@/lib/billing-pro-trial";
export async function getImportUpgradeState() {
  const userId = await requireCurrentUserId();
  const usage = await getMonthlyImportUsage(userId);
  const [trial, [imports], [clubs]] = await Promise.all([
    getProTrialEligibility(userId, usage.planKey),
    getDb()
      .select({
        count: sql<number>`count(distinct ${importFiles.sessionId}) filter (where ${importFiles.createdAt} >= ${usage.start.toISOString()}::timestamptz and ${importFiles.createdAt} < ${usage.end.toISOString()}::timestamptz)::int`,
        last: sql<Date | null>`max(${importFiles.createdAt})`,
      })
      .from(importFiles)
      .where(and(eq(importFiles.userId, userId), ne(importFiles.status, "duplicate"))),
    getDb()
      .select({ count: sql<number>`count(distinct ${stockYardages.clubId})::int` })
      .from(stockYardages)
      .where(and(eq(stockYardages.userId, userId), sql`${stockYardages.carryMedianYd} > 0`)),
  ]);
  return {
    used: usage.used,
    limit: usage.limit,
    remaining: usage.remaining,
    allowed: usage.allowed,
    resetsAt: usage.resetsAt,
    trialEligible: trial.eligible && trial.configured,
    savedSessions: imports?.count ?? 0,
    stockClubs: clubs?.count ?? 0,
    lastImportAt: imports?.last ? new Date(imports.last).toISOString() : null,
  };
}
export type ImportUpgradeState = Awaited<ReturnType<typeof getImportUpgradeState>>;
