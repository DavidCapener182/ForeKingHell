import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { sessions, shots, teeSets } from "@/db/schema";
import { isRoundSessionType } from "@/lib/round-sessions";

export type TodayRound = {
  session: Pick<
    typeof sessions.$inferSelect,
    | "id"
    | "date"
    | "type"
    | "courseName"
    | "location"
    | "scorecardJson"
    | "notes"
    | "weatherJson"
    | "equipmentNotes"
  >;
  tee: typeof teeSets.$inferSelect | null;
};
type Params = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export function hasPracticeOverride(params: Params) {
  return (
    first(params.view) === "practice" || Boolean(first(params.club) && first(params.club) !== "all")
  );
}

/** Select owned activity before loading the practice-only analytics. Empty imports do not win. */
export async function getTodayRound(
  userId: string,
  params: Params = {},
): Promise<TodayRound | null> {
  if (hasPracticeOverride(params)) return null;
  const selectedSession = first(params.session);
  const date = first(params.date);
  const selectedDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  const round = sql<boolean>`${sessions.type} in ('real_round', 'round', 'simulated_course', 'simulator')`;
  const activityAt = sql<Date>`case when ${round} then ${sessions.date} else
    (select max(${shots.shotAt}) from ${shots} where ${shots.sessionId} = ${sessions.id} and ${shots.userId} = ${userId}) end`;
  const activityDate = sql<string>`to_char(${activityAt} at time zone 'Europe/London', 'YYYY-MM-DD')`;
  const [latest] = await getDb()
    .select({
      session: {
        id: sessions.id,
        date: sessions.date,
        type: sessions.type,
        courseName: sessions.courseName,
        location: sessions.location,
        scorecardJson: sessions.scorecardJson,
        notes: sessions.notes,
        weatherJson: sessions.weatherJson,
        equipmentNotes: sessions.equipmentNotes,
      },
      tee: teeSets,
    })
    .from(sessions)
    .leftJoin(teeSets, eq(teeSets.id, sessions.teeSetId))
    .where(
      and(
        eq(sessions.userId, userId),
        selectedSession && selectedSession !== "all" ? eq(sessions.id, selectedSession) : undefined,
        selectedDate
          ? sql`${activityDate} = ${selectedDate}`
          : sql`${activityDate} <= to_char(now() at time zone 'Europe/London', 'YYYY-MM-DD')`,
        sql`((${round} and ${sessions.roundStatus} = 'complete' and jsonb_array_length(coalesce(${sessions.scorecardJson}, '[]'::jsonb)) between 1 and 18
        and not exists (select 1 from jsonb_array_elements(${sessions.scorecardJson}) h
          where case when jsonb_typeof(h->'score') = 'number' then (h->>'score')::numeric < 1 or (h->>'score')::numeric <> trunc((h->>'score')::numeric) else true end
          or case when jsonb_typeof(h->'holeNumber') = 'number' then (h->>'holeNumber')::numeric not between 1 and 18 or (h->>'holeNumber')::numeric <> trunc((h->>'holeNumber')::numeric) else true end)
        and (select count(distinct (h->>'holeNumber')::numeric) from jsonb_array_elements(${sessions.scorecardJson}) h) = jsonb_array_length(${sessions.scorecardJson}))
        or (not ${round} and exists (select 1 from ${shots} where ${shots.sessionId} = ${sessions.id} and ${shots.userId} = ${userId})))`,
      ),
    )
    .orderBy(desc(activityAt), desc(sessions.createdAt), desc(sessions.id))
    .limit(1);
  return latest && isRoundSessionType(latest.session.type) ? latest : null;
}
