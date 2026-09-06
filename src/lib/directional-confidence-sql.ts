import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/** Correlated and owner-scoped. Explicit outer identifiers are essential: Drizzle strips
 * column qualifiers in single-table SELECTs, which would bind id/user_id to the inner session.
 * Raw inspection views deliberately do not use this projection. */
export function directionalMetricSql(column: AnyPgColumn) {
  return sql<number | null>`case when exists (
    select 1 from fkh_sessions direction_session
    where direction_session.id = "fkh_shots"."session_id"
      and direction_session.user_id = "fkh_shots"."user_id"
      and (direction_session.data_confidence_json->>'alignment' in ('possibly_misaligned', 'misaligned')
        or direction_session.data_confidence_json->'directionReviews'->("fkh_shots"."id"::text)->>'status' = 'questionable')
  ) then null else ${column} end`.as(`trusted_${column.name}`);
}
