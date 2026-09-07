import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { requireCurrentUserId } from "@/lib/current-user";

/** Review metadata only: never changes shot eligibility, carry, speed or source values. */
export async function getDirectionAttention() {
  const userId = await requireCurrentUserId();
  const rows = await getDb().execute<{
    id: string;
    label: string;
    date: string;
    alignment: string | null;
    questionableShots: number;
    totalSessions: number;
  }>(sql`
    with attention as (
      select s.id,
        coalesce(nullif(s.file_name, ''), nullif(s.course_name, ''), 'Recorded session') as label,
        s.date::text as date,
        s.data_confidence_json->>'alignment' as alignment,
        (select count(*)::int from fkh_shots sh
          where sh.session_id = s.id and sh.user_id = ${userId}
            and s.data_confidence_json->'directionReviews'->(sh.id::text)->>'status' = 'questionable'
        ) as "questionableShots"
      from fkh_sessions s where s.user_id = ${userId}
    )
    select *, count(*) over()::int as "totalSessions" from attention
    where alignment in ('possibly_misaligned', 'misaligned') or "questionableShots" > 0
    order by date::timestamptz desc, id
    limit 100
  `);
  return {
    totalSessions: Number(rows[0]?.totalSessions ?? 0),
    sessions: rows.map((row) => ({
      id: row.id,
      label: row.label,
      date: new Date(row.date).toISOString(),
      alignment: row.alignment,
      alignmentNeedsReview: ["possibly_misaligned", "misaligned"].includes(row.alignment ?? ""),
      questionableShots: Number(row.questionableShots),
      href: `/sessions/${row.id}`,
    })),
  };
}
