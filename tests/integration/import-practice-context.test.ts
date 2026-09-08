import { afterAll, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ImportPracticeContextBanner } from "@/app/import/import-practice-context-banner";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import { getImportPracticeContext } from "@/lib/import-practice-context";
import { isObservationOnlyPracticePlan } from "@/lib/practice-planner";
const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const value = process.env.DATABASE_URL;
if (enabled) {
  const target = new URL(value!);
  if (
    target.hostname !== "127.0.0.1" ||
    target.port !== "55432" ||
    target.pathname !== "/fkh_redesign"
  )
    throw new Error("Disposable database required");
}
afterAll(closeDb);
it.skipIf(!enabled)(
  "import context accepts only owned unlinked supported plans and keeps observation semantics",
  async () => {
    const db = postgres(value!, { max: 1 });
    const owners: string[] = [];
    try {
      owners.push(
        ...(
          await db`insert into fkh_users(name) values('Import context owner'),('Import context foreign') returning id`
        ).map((r) => r.id),
      );
      const [session] =
        await db`insert into fkh_sessions(user_id,source,type,date,raw_csv_text) values(${owners[0]},'manual','range',now(),'Synthetic context') returning id`;
      const [plan] =
        await db`insert into fkh_practice_plans(user_id,session_type,time_minutes,energy_level,intent,title,generated_summary) values(${owners[0]},'range',10,'normal','confidence','Exact import context','Synthetic') returning id`;
      await db`insert into fkh_practice_blocks(user_id,practice_plan_id,block_order,block_type,title,time_minutes,goal,drill,success_criteria,record_prompt,scoring_rules_json) values(${owners[0]},${plan.id},0,'custom','Observation',10,'Observe','Observe','Recorded','Notes','{"metric":"sg_category_observations","evidenceMode":"manual"}'::jsonb)`;
      const context = await getImportPracticeContext(owners[0], [plan.id, "ignored"]);
      expect(context?.id).toBe(plan.id);
      expect(isObservationOnlyPracticePlan(context!)).toBe(true);
      expect(
        renderToStaticMarkup(createElement(ImportPracticeContextBanner, { plan: context })),
      ).toContain("uploads will not automatically score it");
      expect(await getImportPracticeContext(owners[1], plan.id)).toBeNull();
      expect(await getImportPracticeContext(owners[0], "invalid")).toBeNull();
      expect(await getImportPracticeContext(owners[0], undefined)).toBeNull();
      await db`update fkh_practice_plans set status='abandoned' where id=${plan.id}`;
      expect(await getImportPracticeContext(owners[0], plan.id)).toBeNull();
      await db`update fkh_practice_plans set status='completed',source_session_id=${session.id} where id=${plan.id}`;
      expect(await getImportPracticeContext(owners[0], plan.id)).toBeNull();
      expect(
        await db`select id from fkh_practice_results where practice_plan_id=${plan.id}`,
      ).toHaveLength(0);
      expect(await db`select id from fkh_sessions where user_id=${owners[0]}`).toHaveLength(1);
    } finally {
      if (owners.length) await db`delete from fkh_users where id in ${db(owners)}`;
      await db.end();
    }
  },
);
