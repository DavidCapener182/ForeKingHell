"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { sessions } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/current-user";
import { monitorConditions } from "@/lib/launch-monitor-calibration";

export async function saveMonitorConditions(form: FormData) {
  const userId = await requireCurrentUserId();
  const sessionId = String(form.get("sessionId") ?? "");
  const sourceId = String(form.get("sourceId") ?? "");
  const referenceId = String(form.get("referenceId") ?? "");
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(sessionId) || !uuid.test(sourceId) || !uuid.test(referenceId))
    throw new Error("Choose valid sessions.");
  const conditions = monitorConditions(Object.fromEntries(form));
  const updated = await getDb()
    .update(sessions)
    .set({
      dataConfidenceJson: sql`jsonb_set(coalesce(${sessions.dataConfidenceJson}, '{}'::jsonb), '{launchMonitor}', ${JSON.stringify(conditions)}::jsonb, true)`,
      updatedAt: new Date(),
    })
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .returning({ id: sessions.id });
  if (!updated.length) throw new Error("Session not found.");
  revalidatePath("/equipment/launch-monitors/calibration");
  const query = new URLSearchParams({ source: sourceId, reference: referenceId, saved: "1" });
  const club = String(form.get("club") ?? "");
  if (club) query.set("club", club);
  redirect(`/equipment/launch-monitors/calibration?${query}`);
}
