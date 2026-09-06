"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { sessions, shots } from "@/db/schema";
import { reportServerFailure } from "@/lib/server-observability";
import { requireCurrentUserId } from "@/lib/current-user";
import {
  ALIGNMENT_STATUSES,
  type AlignmentStatus,
  type DirectionReview,
} from "@/lib/session-data-confidence";
import { refreshStockYardagesForClubs } from "@/lib/stock-yardage-refresh";
import { refreshPracticeEvidenceForReviewedSessions } from "@/lib/practice-planner";

export async function saveSessionConfidence(input: {
  sessionId: string;
  alignment?: AlignmentStatus;
  shotId?: string;
  directionReview?: DirectionReview;
}) {
  const userId = await requireCurrentUserId();
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(input.sessionId) || (input.shotId && !uuid.test(input.shotId)))
    throw new Error("Choose a valid session or shot.");
  const alignmentEdit =
    input.alignment !== undefined && ALIGNMENT_STATUSES.includes(input.alignment);
  const shotEdit =
    !!input.shotId &&
    ["unreviewed", "confirmed", "questionable"].includes(input.directionReview ?? "");
  if (Number(alignmentEdit) + Number(shotEdit) !== 1)
    throw new Error("Choose one confidence update.");
  const saved = await getDb().transaction(async (tx) => {
    const [session] = await tx
      .select({ data: sessions.dataConfidenceJson })
      .from(sessions)
      .where(and(eq(sessions.id, input.sessionId), eq(sessions.userId, userId)))
      .for("update");
    if (!session) throw new Error("This session is unavailable.");
    if (shotEdit) {
      const [shot] = await tx
        .select({ id: shots.id })
        .from(shots)
        .where(
          and(
            eq(shots.id, input.shotId!),
            eq(shots.sessionId, input.sessionId),
            eq(shots.userId, userId),
          ),
        );
      if (!shot) throw new Error("This shot is unavailable in your session.");
    }
    const now = new Date();
    const data = {
      ...session.data,
      updatedAt: now.toISOString(),
      ...(alignmentEdit
        ? { alignment: input.alignment }
        : {
            directionReviews: {
              ...session.data.directionReviews,
              [input.shotId!]: { status: input.directionReview!, updatedAt: now.toISOString() },
            },
          }),
    };
    const [updated] = await tx
      .update(sessions)
      .set({ dataConfidenceJson: data, updatedAt: now })
      .where(and(eq(sessions.id, input.sessionId), eq(sessions.userId, userId)))
      .returning({ data: sessions.dataConfidenceJson });
    if (!updated) throw new Error("The confidence update was not saved.");
    const clubContexts = await tx
      .selectDistinct({ clubId: shots.clubId, playContext: shots.playContext })
      .from(shots)
      .where(and(eq(shots.sessionId, input.sessionId), eq(shots.userId, userId)));
    await refreshStockYardagesForClubs(tx, { userId, clubContexts, calculatedAt: now });
    return updated.data;
  });
  // Cache invalidation includes every page/API using the shared evidence, including mobile routes.
  revalidatePath("/", "layout");
  try {
    await refreshPracticeEvidenceForReviewedSessions(userId, [input.sessionId]);
  } catch (error) {
    reportServerFailure("confidence_practice_refresh_failed", error, {
      "app.session_id": input.sessionId,
    });
    return {
      ...saved,
      refreshWarning: "Confidence saved; the saved practice-plan evaluation needs a refresh.",
    };
  }
  return saved;
}
