import { NextResponse } from "next/server";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/current-user";
import { getDb } from "@/db/client";
import { sessions, shots } from "@/db/schema";
import { getTodayShotDetailRows } from "@/lib/today-shot-detail-data";
export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return reply({ error: "Sign in to view session evidence." }, 401);
  const { sessionId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId))
    return reply({ error: "Session unavailable." }, 404);
  const db = getDb();
  const [session] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, user.id)))
    .limit(1);
  if (!session) return reply({ error: "Session unavailable." }, 404);
  const query = new URL(request.url).searchParams;
  const requestedPage = Number(query.get("page") ?? 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const sort = query.get("sort") === "carry" ? "carry" : "shot";
  const direction = query.get("dir") === "desc" ? "desc" : "asc";
  const where = and(eq(shots.sessionId, sessionId), eq(shots.userId, user.id));
  const [totalRow] = await db.select({ value: count() }).from(shots).where(where);
  const total = totalRow?.value ?? 0;
  const pages = Math.max(1, Math.ceil(total / 20));
  const selectedPage = Math.min(page, pages);
  const column = sort === "carry" ? shots.carryYd : shots.shotNumber;
  const ids = await db
    .select({ id: shots.id })
    .from(shots)
    .where(where)
    .orderBy(direction === "asc" ? asc(column) : desc(column), asc(shots.id))
    .limit(20)
    .offset((selectedPage - 1) * 20);
  const details = await getTodayShotDetailRows({
    userId: user.id,
    shotIds: ids.map((row) => row.id),
  });
  const byId = new Map(details.map((row) => [row.id, row]));
  return reply({
    sessionId,
    page: selectedPage,
    pages,
    total,
    shots: ids.flatMap((row) => (byId.has(row.id) ? [byId.get(row.id)!] : [])),
  });
}
