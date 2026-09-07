import "server-only";
import { and, asc, desc, eq, gt, gte, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { sessions, shots, strokesGainedShotEvents } from "@/db/schema";
import { getDb } from "@/db/client";
import { shotEvidenceSqlPredicate } from "@/lib/strokes-gained-practice-data";
type SortMode = "recent" | "gains" | "losses" | "hole" | "category";
type SgResultFilter = "" | "gain" | "loss" | "pending";
export const SG_ANALYSIS_PAGE_SIZE = 200;
export type StrokesGainedFilters = {
  q: string;
  sessionId: string;
  category: string;
  hole: string;
  startLie: string;
  endLie: string;
  from: string;
  to: string;
  sg: SgResultFilter;
  sort: SortMode;
};

export async function getStrokesGainedHistory(
  userId: string,
  filters: StrokesGainedFilters,
  requestedPage = 1,
) {
  filters = normalizeStrokesGainedFilters(filters);
  const db = getDb();
  const owned = and(
    eq(strokesGainedShotEvents.userId, userId),
    eq(sessions.userId, userId),
    or(isNull(strokesGainedShotEvents.shotId), shotEvidenceSqlPredicate()),
  )!;
  const conditions: SQL[] = [owned];

  if (filters.q)
    conditions.push(
      sql`strpos(lower(concat_ws(' ', ${sessions.courseName}, ${strokesGainedShotEvents.category}, replace(${strokesGainedShotEvents.category}, '_', ' '), ${strokesGainedShotEvents.startLie}, ${strokesGainedShotEvents.endLie}, ${strokesGainedShotEvents.holeNumber})), lower(${filters.q})) > 0`,
    );
  if (filters.sessionId) conditions.push(eq(strokesGainedShotEvents.sessionId, filters.sessionId));
  if (filters.category) conditions.push(eq(strokesGainedShotEvents.category, filters.category));
  if (filters.hole) conditions.push(eq(strokesGainedShotEvents.holeNumber, Number(filters.hole)));
  if (filters.startLie) conditions.push(eq(strokesGainedShotEvents.startLie, filters.startLie));
  if (filters.endLie) conditions.push(eq(strokesGainedShotEvents.endLie, filters.endLie));
  if (filters.from) conditions.push(gte(sessions.date, new Date(`${filters.from}T00:00:00.000Z`)));
  if (filters.to)
    conditions.push(
      lt(sessions.date, new Date(new Date(`${filters.to}T00:00:00.000Z`).getTime() + 86_400_000)),
    );
  if (filters.sg === "gain") conditions.push(gt(strokesGainedShotEvents.strokesGained, 0));
  if (filters.sg === "loss") conditions.push(lt(strokesGainedShotEvents.strokesGained, 0));
  if (filters.sg === "pending") conditions.push(isNull(strokesGainedShotEvents.strokesGained));

  const [count] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(strokesGainedShotEvents)
    .innerJoin(sessions, eq(sessions.id, strokesGainedShotEvents.sessionId))
    .leftJoin(shots, and(eq(shots.id, strokesGainedShotEvents.shotId), eq(shots.userId, userId)))
    .where(and(...conditions));
  const total = count?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / SG_ANALYSIS_PAGE_SIZE));
  const page = Math.min(
    pages,
    Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
  );
  const roundOptions = await db
    .selectDistinct({ id: sessions.id, courseName: sessions.courseName, date: sessions.date })
    .from(strokesGainedShotEvents)
    .innerJoin(sessions, eq(sessions.id, strokesGainedShotEvents.sessionId))
    .leftJoin(shots, and(eq(shots.id, strokesGainedShotEvents.shotId), eq(shots.userId, userId)))
    .where(owned)
    .orderBy(desc(sessions.date), desc(sessions.id));
  const [catalog] = await db
    .select({
      categories: sql<string[]>`array_agg(distinct ${strokesGainedShotEvents.category})`,
      holes: sql<Array<number | null>>`array_agg(distinct ${strokesGainedShotEvents.holeNumber})`,
      startLies: sql<string[]>`array_agg(distinct ${strokesGainedShotEvents.startLie})`,
      endLies: sql<Array<string | null>>`array_agg(distinct ${strokesGainedShotEvents.endLie})`,
    })
    .from(strokesGainedShotEvents)
    .innerJoin(sessions, eq(sessions.id, strokesGainedShotEvents.sessionId))
    .leftJoin(shots, and(eq(shots.id, strokesGainedShotEvents.shotId), eq(shots.userId, userId)))
    .where(owned);
  const orderBy =
    filters.sort === "gains"
      ? [
          sql`${strokesGainedShotEvents.strokesGained} desc nulls last`,
          desc(strokesGainedShotEvents.createdAt),
        ]
      : filters.sort === "losses"
        ? [
            sql`${strokesGainedShotEvents.strokesGained} asc nulls last`,
            desc(strokesGainedShotEvents.createdAt),
          ]
        : filters.sort === "hole"
          ? [
              asc(strokesGainedShotEvents.holeNumber),
              asc(strokesGainedShotEvents.strokeNumber),
              desc(strokesGainedShotEvents.createdAt),
            ]
          : filters.sort === "category"
            ? [
                asc(strokesGainedShotEvents.category),
                sql`${strokesGainedShotEvents.strokesGained} asc nulls last`,
              ]
            : [desc(strokesGainedShotEvents.createdAt)];
  const events = await db
    .select({
      id: strokesGainedShotEvents.id,
      sessionId: strokesGainedShotEvents.sessionId,
      courseName: sessions.courseName,
      sessionDate: sessions.date,
      holeNumber: strokesGainedShotEvents.holeNumber,
      strokeNumber: strokesGainedShotEvents.strokeNumber,
      category: strokesGainedShotEvents.category,
      startLie: strokesGainedShotEvents.startLie,
      endLie: strokesGainedShotEvents.endLie,
      startDistanceYd: strokesGainedShotEvents.startDistanceYd,
      endDistanceYd: strokesGainedShotEvents.endDistanceYd,
      penaltyStrokes: strokesGainedShotEvents.penaltyStrokes,
      strokesGained: strokesGainedShotEvents.strokesGained,
      createdAt: strokesGainedShotEvents.createdAt,
    })
    .from(strokesGainedShotEvents)
    .innerJoin(sessions, eq(sessions.id, strokesGainedShotEvents.sessionId))
    .leftJoin(shots, and(eq(shots.id, strokesGainedShotEvents.shotId), eq(shots.userId, userId)))
    .where(
      and(...conditions, or(isNull(strokesGainedShotEvents.shotId), shotEvidenceSqlPredicate())),
    )
    .orderBy(...orderBy, desc(strokesGainedShotEvents.id))
    .limit(SG_ANALYSIS_PAGE_SIZE)
    .offset((page - 1) * SG_ANALYSIS_PAGE_SIZE);

  return {
    events,
    total,
    page,
    pages,
    catalog: {
      rounds: roundOptions,
      categories: catalog?.categories ?? [],
      holes: (catalog?.holes ?? []).filter((n): n is number => n !== null),
      startLies: catalog?.startLies ?? [],
      endLies: (catalog?.endLies ?? []).filter((lie): lie is string => lie !== null),
    },
  };
}

export function normalizeStrokesGainedFilters(filters: StrokesGainedFilters): StrokesGainedFilters {
  const date = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
      ? value
      : "";
  };
  const hole = Number(filters.hole);
  return {
    ...filters,
    q: filters.q.trim().slice(0, 160),
    sessionId: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      filters.sessionId,
    )
      ? filters.sessionId
      : "",
    hole:
      /^\d+$/.test(filters.hole) && Number.isSafeInteger(hole) && hole <= 2_147_483_647
        ? String(hole)
        : "",
    from: date(filters.from),
    to: date(filters.to),
  };
}
