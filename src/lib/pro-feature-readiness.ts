import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";

/** Allows code rollout before the separately authorised migration, without querying absent tables. */
export async function proFeatureStorageReady(
  executor: Pick<ReturnType<typeof getDb>, "execute"> = getDb(),
) {
  const [row] = await executor.execute(sql`
    select to_regclass('public.fkh_billing_trials') is not null
      and to_regclass('public.fkh_course_twin_round_plans') is not null as ready
  `);
  return row?.ready === true;
}
