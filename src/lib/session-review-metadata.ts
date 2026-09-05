import "server-only";
import { and, count, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { sessions, shots } from "@/db/schema";

/** An owned saved activity exists independently of its measurable, mapped shots. */
export async function getSessionReviewMetadata(userId: string, sessionId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
    return null;
  }
  const [session] = await getDb()
    .select({
      id: sessions.id,
      type: sessions.type,
      source: sessions.source,
      date: sessions.date,
      courseName: sessions.courseName,
      location: sessions.location,
      notes: sessions.notes,
      equipmentNotes: sessions.equipmentNotes,
      fileName: sessions.fileName,
      shotCount: count(shots.id),
    })
    .from(sessions)
    .leftJoin(shots, and(eq(shots.sessionId, sessions.id), eq(shots.userId, userId)))
    .where(and(eq(sessions.userId, userId), eq(sessions.id, sessionId)))
    .groupBy(sessions.id)
    .limit(1);
  return session ?? null;
}

export type SessionReviewMetadata = NonNullable<
  Awaited<ReturnType<typeof getSessionReviewMetadata>>
>;
