import "server-only";
import { and, eq } from "drizzle-orm";
import { contentExports } from "@/db/schema";
import { getDb } from "@/db/client";
import { parseCoachReportAccessConfig } from "@/lib/coach-report-access";

/** Append view metadata without restoring stale password or privacy settings. */
export async function recordCoachReportView(exportId: string) {
  await getDb().transaction(async (db) => {
    const [current] = await db
      .select({ config: contentExports.renderConfigJson })
      .from(contentExports)
      .where(
        and(
          eq(contentExports.id, exportId),
          eq(contentExports.sourceType, "coach_report"),
          eq(contentExports.status, "ready"),
        ),
      )
      .limit(1)
      .for("update");
    if (!current) return;
    const now = new Date();
    const history = parseCoachReportAccessConfig(current.config).accessHistory;
    await db
      .update(contentExports)
      .set({
        renderConfigJson: {
          ...current.config,
          accessHistory: [...history, now.toISOString()].slice(-50),
        },
        updatedAt: now,
      })
      .where(eq(contentExports.id, exportId));
  });
}
