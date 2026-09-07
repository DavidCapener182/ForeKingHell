import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { getRecentSessionHistory } from "./session-history";
import {
  resolveSessionHistorySearchParams,
  type SessionHistorySearchParamsInput,
} from "./session-history-search-params";

export const HISTORY_PAGE_SIZE = 24;
// Mirrors reviewed evidence eligibility; restored rows deliberately override legacy flags.
const eligible = sql`(sh.review_status = 'restored' or (coalesce(sh.review_status, 'included') = 'included'
  and lower(trim(coalesce(sh.quality_tag, ''))) not like 'exclude%'
  and lower(trim(coalesce(sh.quality_tag, ''))) not in ('exclude','excluded','delete','deleted','calibration','warm-up','warmup','warm_up','bad-data','bad_data','invalid','launch-monitor-error','misread','fat','mishit','thin','top','needs_review')
  and lower(trim(coalesce(sh.shot_category, ''))) not in ('warm-up','warmup','warm_up'))) `;
const label = (value: string) =>
  value.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export async function getSessionHistoryPage(
  userId: string,
  input: SessionHistorySearchParamsInput,
  includeShotPatterns: boolean,
) {
  const db = getDb();
  const [catalog] = await db.execute<{ total: number; sources: string[]; clubs: string[] }>(sql`
    select count(*)::int as total, coalesce(array_agg(distinct s.source), array[]::text[]) as sources,
      (select coalesce(array_agg(distinct sh.club_type), array[]::text[]) from fkh_shots sh
       join fkh_sessions own on own.id = sh.session_id and own.user_id = ${userId}
       where sh.user_id = ${userId} and ${eligible}) as clubs
    from fkh_sessions s where s.user_id = ${userId}`);
  const filterOptions = {
    sources: (catalog?.sources ?? []).map(label).sort(),
    clubs: (catalog?.clubs ?? []).sort(),
  };
  const resolved = resolveSessionHistorySearchParams(input, [], {
    ...filterOptions,
    preserveSelection: true,
  });
  const filters = resolved.filters;
  const history = sql`with history as (
    select s.id, s.date, s.type, s.source, s.course_name, s.file_name, s.play_context,
      coalesce((select array_agg(distinct sh.club_type) from fkh_shots sh
        where sh.session_id=s.id and sh.user_id=${userId} and ${eligible}), array[]::text[]) as clubs,
      case when (s.date at time zone 'Europe/London')::date = (now() at time zone 'Europe/London')::date then 'today'
        when (s.date at time zone 'Europe/London')::date >= date_trunc('week', now() at time zone 'Europe/London')::date
          and (s.date at time zone 'Europe/London')::date < (now() at time zone 'Europe/London')::date then 'week'
        else 'earlier' end as date_group
    from fkh_sessions s where s.user_id=${userId}
  ), matching as (select * from history where
    (${filters.type} = 'all' or (${filters.type} = 'round' and type in ('round','real_round')) or (${filters.type} = 'practice' and type not in ('round','real_round')))
    and (${filters.source} = 'all' or lower(regexp_replace(source, '[_-]+', ' ', 'g')) = lower(${filters.source}))
    and (${filters.club} = 'all' or ${filters.club} = any(clubs))
    and (${filters.date} = 'all' or date_group = ${filters.date})
    and (${filters.search ?? ""} = '' or strpos(lower(concat_ws(' ', course_name, file_name, source, regexp_replace(source, '[_-]+', ' ', 'g'), array_to_string(clubs, ' '),
      case when type in ('round','real_round') then 'Round' when lower(concat_ws(' ',type,source,play_context)) like '%simulat%' then 'Simulator' else 'Practice' end)), lower(${filters.search ?? ""})) > 0)
  )`;
  const [count] = await db.execute<{ total: number }>(
    sql`${history} select count(*)::int as total from matching`,
  );
  const total = count?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));
  const requested = Number(input.historyPage ?? 1);
  let page = Math.min(pages, Number.isSafeInteger(requested) && requested > 0 ? requested : 1);
  // A saved focused URL can reach its owned matching record beyond the first page.
  if (filters.sessionId && input.historyPage === undefined) {
    const [position] = await db.execute<{
      position: number;
    }>(sql`${history} select position::int from
      (select id, row_number() over(order by date desc, id desc) as position from matching) ranked where id::text=${filters.sessionId}`);
    if (position) page = Math.ceil(position.position / HISTORY_PAGE_SIZE);
  }
  const ids = await db.execute<{ id: string }>(
    sql`${history} select id from matching order by date desc, id desc limit ${HISTORY_PAGE_SIZE} offset ${(page - 1) * HISTORY_PAGE_SIZE}`,
  );
  const rows = ids.length
    ? await getRecentSessionHistory(userId, HISTORY_PAGE_SIZE, {
        includeShotPatterns,
        sessionIds: ids.map((row) => row.id),
      })
    : [];
  const canonical = resolveSessionHistorySearchParams(resolved.query, rows, {
    ...filterOptions,
    serverFiltered: true,
  });
  const query = new URLSearchParams(canonical.query);
  query.delete("historyLimit");
  if (page > 1) query.set("historyPage", String(page));
  else query.delete("historyPage");
  return {
    rows,
    total,
    savedTotal: catalog?.total ?? 0,
    page,
    pages,
    filterOptions,
    query: query.toString(),
  };
}
