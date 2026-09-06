import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { shots, sessions } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/current-user";
import { assessFlightEvidence } from "@/lib/session-data-confidence";

export async function getSessionAlignmentEvidence(sessionId: string) {
  const userId = await requireCurrentUserId();
  const [session] = await getDb()
    .select({ fileName: sessions.fileName, confidence: sessions.dataConfidenceJson })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));
  if (!session) return null;
  const rows = await getDb()
    .select({
      id: shots.id,
      carryYd: shots.carryYd,
      sideCarryYd: shots.sideCarryYd,
      launchDirectionDeg: shots.launchDirectionDeg,
      spinRate: shots.spinRate,
      spinAxis: shots.spinAxis,
    })
    .from(shots)
    .where(and(eq(shots.sessionId, sessionId), eq(shots.userId, userId)));
  const reviewCount = rows.filter(
    (shot) => assessFlightEvidence({ ...shot, dataConfidence: session.confidence }).needsReview,
  ).length;
  return { session, reviewCount };
}
