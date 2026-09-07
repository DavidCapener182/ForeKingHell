import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import {
  addGoalAction,
  updateGoalAction,
  deleteGoalAction,
  addGoalWithStateAction,
  updateGoalWithStateAction,
  deleteGoalWithStateAction,
  saveSeasonPlanWithStateAction,
  saveGoalProjectWithStateAction,
} from "@/app/goals/actions";
import { getGoalImprovementProjectData } from "@/lib/goal-improvement-project";
import {
  getSavedPracticePlans,
  savedPracticePlanToPracticePlan,
  savePracticePlanForUser,
  completePracticePlanFromSelectedImport,
  updatePracticePlanStatusForUser,
} from "@/lib/practice-planner";
import {
  getProductPreferences,
  updateProductPreferences,
  goalProgress,
} from "@/lib/product-preferences";

const actor = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: async () => actor.userId }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const url = process.env.DATABASE_URL;
if (enabled) {
  const target = url ? new URL(url) : null;
  if (
    !target ||
    !["localhost", "127.0.0.1"].includes(target.hostname) ||
    target.pathname !== "/fkh_redesign"
  ) {
    throw new Error("Goal integration tests require the disposable local fkh_redesign database.");
  }
}

describe.skipIf(!enabled)("goal persistence with real actions and database", () => {
  let sql: ReturnType<typeof postgres>;
  let owner: string;
  let foreign: string;
  let trigger: string;
  beforeAll(() => {
    sql = postgres(url!, { max: 1 });
  });
  beforeEach(async () => {
    [owner, foreign] = (
      await sql`insert into fkh_users(name) values('Goal fixture owner'),('Goal fixture foreign') returning id`
    ).map((row) => row.id);
    actor.userId = owner;
    trigger = `goal_test_${Date.now()}`;
  });
  afterEach(async () => {
    await sql.unsafe(`drop function if exists ${trigger}() cascade`);
    await sql`delete from fkh_users where id in ${sql([owner, foreign])}`;
  });
  afterAll(async () => {
    await closeDb();
    await sql.end();
  });
  function goalForm(title: string) {
    const form = new FormData();
    Object.entries({
      type: "carry",
      title,
      club: "driver",
      startingValue: "190",
      currentValue: "195",
      targetValue: "210",
      unit: "yd",
      goalTargetDate: "2026-12-31",
      evidenceSource: "Manual review fixture",
      nextAction: "Practise driver carry",
    }).forEach(([key, value]) => form.set(key, value));
    return form;
  }
  async function redirected(action: Promise<unknown>) {
    const result = await action.catch((error: { digest?: string }) => error);
    expect(result).toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
    return (result as { digest: string }).digest;
  }

  async function seedProject() {
    await addGoalWithStateAction(goalForm("Linked improvement target"));
    const goal = (await getProductPreferences(owner)).goals[0];
    const [club] =
      await sql`insert into fkh_clubs(user_id,type,normalized_club_key) values(${owner},'7i','project_fixture') returning id`;
    const records: string[] = [];
    for (const date of [new Date(Date.now() - 86400000), new Date(Date.now() - 30000)]) {
      const [session] =
        await sql`insert into fkh_sessions(user_id,source,type,play_context,date,raw_csv_text,file_name) values(${owner},'csv','range','range',${date},'Synthetic project CSV','Project evidence') returning id`;
      records.push(session.id);
      for (const [index, carry] of [140, 150].entries()) {
        await sql`insert into fkh_shots(user_id,session_id,club_id,club_type,play_context,shot_at,shot_number,carry_yd,total_yd,side_carry_yd,ball_speed_mph,review_status,source_raw_json)
          values(${owner},${session.id},${club.id},'7i','range',${date},${index + 1},${carry},${carry + 10},2,100,'included','{"fixture":"project"}'::jsonb)`;
      }
    }
    const [plan] =
      await sql`insert into fkh_practice_plans(user_id,source_session_id,session_type,ball_count,time_minutes,energy_level,intent,focus_clubs_json,title,generated_summary,status,planned_at,started_at)
      values(${owner},${records[0]},'range',2,10,'normal','confidence','["7i"]'::jsonb,'Project practice','Existing practice service','planned',${new Date(Date.now() - 60000)},${new Date(Date.now() - 60000)}) returning id`;
    await sql`insert into fkh_practice_blocks(practice_plan_id,user_id,block_order,block_type,title,clubs_json,ball_count,time_minutes,goal,drill,success_criteria,record_prompt)
      values(${plan.id},${owner},1,'technical','Selected iron drill','["7i"]'::jsonb,2,10,'Control start line','Hit two measured iron shots','Repeat start line','Record evidence')`;
    const form = new FormData();
    form.set("goalId", goal.id);
    form.set("baselineSessionId", records[0]);
    form.append("practicePlanId", plan.id);
    return { goal, form, baselineId: records[0], evidenceId: records[1], planId: plan.id };
  }

  it("atomically saves new goal practice, preserves simultaneous links and rolls back a failed attachment", async () => {
    const fixture = await seedProject();
    await saveGoalProjectWithStateAction(fixture.form);
    const [saved] = await getSavedPracticePlans(owner, 1, fixture.planId);
    const draft = savedPracticePlanToPracticePlan(saved);
    const before = (await sql`select count(*) from fkh_practice_plans where user_id=${owner}`)[0]
      .count;
    await expect(
      savePracticePlanForUser(foreign, draft, { goalId: fixture.goal.id }),
    ).rejects.toThrow("no longer available");
    await sql.unsafe(
      `create function ${trigger}() returns trigger language plpgsql as $$ begin if NEW.user_id='${owner}'::uuid then raise exception 'project attachment failure'; end if; return NEW; end $$`,
    );
    await sql.unsafe(
      `create trigger ${trigger} before update on fkh_user_feature_preferences for each row execute function ${trigger}()`,
    );
    await expect(
      savePracticePlanForUser(owner, draft, { goalId: fixture.goal.id }),
    ).rejects.toThrow();
    expect(
      (await sql`select count(*) from fkh_practice_plans where user_id=${owner}`)[0].count,
    ).toBe(before);
    expect((await getProductPreferences(owner)).goals[0].project?.practicePlanIds).toEqual([
      fixture.planId,
    ]);
    await sql.unsafe(`drop function ${trigger}() cascade`);
    const ids = await Promise.all([
      savePracticePlanForUser(owner, draft, { goalId: fixture.goal.id }),
      savePracticePlanForUser(owner, draft, { goalId: fixture.goal.id, start: true }),
    ]);
    const goal = (await getProductPreferences(owner)).goals[0];
    expect(goal.project?.baselineSessionId).toBe(fixture.baselineId);
    expect(goal.project?.practicePlanIds).toEqual(expect.arrayContaining([fixture.planId, ...ids]));
    expect(goal.project?.practicePlanIds).toHaveLength(3);
    const plans = await getSavedPracticePlans(owner, 3, ids);
    expect(plans.map((plan) => plan.status).sort()).toEqual(["awaiting_import", "planned"]);
    expect(plans.every((plan) => plan.blocks.length === 1)).toBe(true);
    const project = (await getGoalImprovementProjectData(owner)).projects[0];
    const link = new URL(project.practiceFromBaselineHref, "http://localhost");
    expect(link.searchParams.get("goalId")).toBe(fixture.goal.id);
    expect(link.searchParams.get("sourceSessionId")).toBe(fixture.baselineId);
  });

  it("replays a stable practice creation request without duplicate plans, blocks or goal links", async () => {
    const fixture = await seedProject();
    await saveGoalProjectWithStateAction(fixture.form);
    const [saved] = await getSavedPracticePlans(owner, 1, fixture.planId);
    const draft = savedPracticePlanToPracticePlan(saved);
    const creationId = crypto.randomUUID();
    const context = { goalId: fixture.goal.id, creationId, start: true };
    expect(
      await Promise.all([
        savePracticePlanForUser(owner, draft, context),
        savePracticePlanForUser(owner, draft, context),
      ]),
    ).toEqual([creationId, creationId]);
    expect((await getProductPreferences(owner)).goals[0].project?.practicePlanIds).toEqual([
      fixture.planId,
      creationId,
    ]);
    expect(
      (await sql`select count(*) from fkh_practice_blocks where practice_plan_id=${creationId}`)[0]
        .count,
    ).toBe("1");
    await expect(
      savePracticePlanForUser(owner, { ...draft, title: "Different request" }, context),
    ).rejects.toThrow("different plan");
    await expect(savePracticePlanForUser(owner, draft, { creationId: "invalid" })).rejects.toThrow(
      "Invalid practice",
    );
    const standaloneId = crypto.randomUUID();
    expect(await savePracticePlanForUser(owner, draft, { creationId: standaloneId })).toBe(
      standaloneId,
    );
    expect(await savePracticePlanForUser(owner, draft, { creationId: standaloneId })).toBe(
      standaloneId,
    );
    expect((await getProductPreferences(owner)).goals[0].project?.practicePlanIds).toHaveLength(2);
  });

  it("connects an owned baseline, existing drills, completed activity and real later practice evidence without rewriting the target", async () => {
    const fixture = await seedProject();
    expect(await saveGoalProjectWithStateAction(fixture.form)).toEqual({ ok: true });
    let project = (await getGoalImprovementProjectData(owner)).projects[0];
    expect(project.status).toBe("practise");
    expect(project.baseline).toMatchObject({ id: fixture.baselineId, eligibleMeasuredShots: 2 });
    expect(project.plans[0].drills).toEqual([
      expect.objectContaining({
        title: "Selected iron drill",
        drill: "Hit two measured iron shots",
      }),
    ]);
    await updatePracticePlanStatusForUser(owner, fixture.planId, "completed");
    expect((await getGoalImprovementProjectData(owner)).projects[0].status).toBe(
      "awaiting_evidence",
    );
    await completePracticePlanFromSelectedImport(owner, fixture.planId, fixture.evidenceId);
    project = (await getGoalImprovementProjectData(owner)).projects[0];
    expect(project.status).toBe("review_ready");
    expect(project.plans[0].evidence[0]).toMatchObject({
      id: fixture.evidenceId,
      eligibleMeasuredShots: 2,
    });
    const comparison = new URL(project.plans[0].evidence[0].compareHref!, "http://localhost");
    expect(comparison.searchParams.get("baselineSessionId")).toBe(fixture.baselineId);
    expect(comparison.searchParams.get("sessionId")).toBe(fixture.evidenceId);
    expect((await getProductPreferences(owner)).goals[0].currentValue).toBe(
      fixture.goal.currentValue,
    );
    const edit = goalForm("Renamed linked target");
    edit.set("goalId", fixture.goal.id);
    expect(await updateGoalWithStateAction(edit)).toEqual({ ok: true });
    expect((await getProductPreferences(owner)).goals[0].project).toEqual({
      baselineSessionId: fixture.baselineId,
      practicePlanIds: [fixture.planId],
    });
    await sql`update fkh_shots set review_status='user_excluded' where session_id=${fixture.evidenceId}`;
    project = (await getGoalImprovementProjectData(owner)).projects[0];
    expect(project.status).toBe("awaiting_evidence");
    expect(project.plans[0].evidenceNeedsReview).toBe(true);
    await sql`update fkh_shots set review_status='included',carry_yd='NaN'::double precision,total_yd='Infinity'::double precision,ball_speed_mph='Infinity'::double precision,club_speed_mph=null where session_id=${fixture.evidenceId}`;
    expect((await getGoalImprovementProjectData(owner)).projects[0].status).toBe(
      "awaiting_evidence",
    );
    await sql`update fkh_shots set carry_yd=null,total_yd=null,ball_speed_mph=110 where session_id=${fixture.evidenceId}`;
    project = (await getGoalImprovementProjectData(owner)).projects[0];
    expect(project.status).toBe("review_ready");
    expect(project.plans[0].evidence[0]).toMatchObject({
      id: fixture.evidenceId,
      eligibleMeasuredShots: 2,
    });
    expect((await getProductPreferences(owner)).goals[0].currentValue).toBe(
      fixture.goal.currentValue,
    );
  });

  it("rejects foreign project references and recovers from deleted records without exposing foreign child data", async () => {
    const fixture = await seedProject();
    expect(await saveGoalProjectWithStateAction(fixture.form)).toEqual({ ok: true });
    const [privateSession] =
      await sql`insert into fkh_sessions(user_id,source,type,play_context,date,raw_csv_text,file_name) values(${foreign},'csv','range','range',now(),'Private CSV','Foreign secret session') returning id`;
    fixture.form.set("baselineSessionId", privateSession.id);
    expect(await saveGoalProjectWithStateAction(fixture.form)).toMatchObject({
      ok: false,
      code: "goal_project",
    });
    expect((await getProductPreferences(owner)).goals[0].project?.baselineSessionId).toBe(
      fixture.baselineId,
    );
    await expect(sql`insert into fkh_practice_blocks(practice_plan_id,user_id,block_order,block_type,title,clubs_json,time_minutes,goal,drill,success_criteria,record_prompt)
      values(${fixture.planId},${foreign},2,'technical','Foreign secret drill','[]'::jsonb,5,'Private','Private','Private','Private')`).rejects.toThrow(
      "Practice block owner does not match",
    );
    const [privatePlan] =
      await sql`insert into fkh_practice_plans(user_id,source_session_id,session_type,time_minutes,energy_level,intent,title,generated_summary)
      values(${foreign},${privateSession.id},'range',10,'normal','confidence','Foreign secret plan','Private') returning id`;
    await sql`insert into fkh_practice_results(practice_plan_id,user_id,source_session_id,verdict,next_action) values(${privatePlan.id},${foreign},${privateSession.id},'Foreign secret verdict','Private')`;
    fixture.form.set("baselineSessionId", fixture.baselineId);
    fixture.form.set("practicePlanId", privatePlan.id);
    expect(await saveGoalProjectWithStateAction(fixture.form)).toMatchObject({
      ok: false,
      code: "goal_project",
    });
    await updateProductPreferences(owner, {
      goals: [
        {
          ...fixture.goal,
          project: {
            baselineSessionId: fixture.baselineId,
            practicePlanIds: [fixture.planId, privatePlan.id],
          },
        },
      ],
    });
    let data = await getGoalImprovementProjectData(owner);
    expect(JSON.stringify(data)).not.toContain("Foreign secret");
    expect(data.projects[0].plans[0].review).toBeNull();
    expect(data.projects[0].plans[0].drills).toHaveLength(1);
    await sql`delete from fkh_sessions where id=${fixture.baselineId}`;
    data = await getGoalImprovementProjectData(owner);
    expect(data.projects[0]).toMatchObject({
      status: "choose_baseline",
      baseline: null,
      missingBaseline: true,
    });
    await sql`delete from fkh_practice_plans where id=${fixture.planId}`;
    expect((await getGoalImprovementProjectData(owner)).projects[0].unavailablePlanCount).toBe(2);
    fixture.form.set("baselineSessionId", "");
    fixture.form.delete("practicePlanId");
    expect(await saveGoalProjectWithStateAction(fixture.form)).toEqual({ ok: true });
    expect((await getGoalImprovementProjectData(owner)).projects[0].missingBaseline).toBe(false);
  });

  it("validates the season rhythm and deadline, preserves goals, and recovers from a failed season save", async () => {
    await redirected(addGoalAction(goalForm("Existing target")));
    const before = await getProductPreferences(owner);
    const form = new FormData();
    Object.entries({
      outcome: "Break 80",
      targetDate: "2026-12-31",
      focus: "Approaches",
      weeklySessions: "3",
      successMeasure: "Three measured sessions each week",
    }).forEach(([key, value]) => form.set(key, value));
    for (const invalid of ["", "0", "8", "2.5", "NaN"]) {
      form.set("weeklySessions", invalid);
      expect(await saveSeasonPlanWithStateAction(form)).toMatchObject({
        ok: false,
        code: "season_frequency",
      });
    }
    form.set("weeklySessions", "3");
    form.set("targetDate", "2026-02-31");
    expect(await saveSeasonPlanWithStateAction(form)).toMatchObject({
      ok: false,
      code: "goal_date",
    });
    expect(await getProductPreferences(owner)).toEqual(before);
    form.set("targetDate", "2026-12-31");
    await sql.unsafe(
      `create function ${trigger}() returns trigger language plpgsql as $$ begin if NEW.user_id='${owner}'::uuid then raise exception 'season persistence failure'; end if; return NEW; end $$`,
    );
    await sql.unsafe(
      `create trigger ${trigger} before update on fkh_user_feature_preferences for each row execute function ${trigger}()`,
    );
    expect(await saveSeasonPlanWithStateAction(form)).toMatchObject({
      ok: false,
      code: "goal_save_failed",
    });
    expect(await getProductPreferences(owner)).toEqual(before);
    await sql.unsafe(`drop function ${trigger}() cascade`);
    expect(await saveSeasonPlanWithStateAction(form)).toEqual({ ok: true });
    const after = await getProductPreferences(owner);
    expect(after.goals).toEqual(before.goals);
    expect(after.seasonPlan).toMatchObject({
      outcome: "Break 80",
      targetDate: "2026-12-31",
      weeklySessions: 3,
    });
  });

  it("returns recoverable form errors, rolls back failed writes, and retries without duplicate goals or movement", async () => {
    await updateProductPreferences(owner, { goals: [] });
    await sql`update fkh_user_feature_preferences set highlight_settings_json=highlight_settings_json || '{"otherFeatureSetting":"retain"}'::jsonb where user_id=${owner}`;
    const form = goalForm("Recoverable target");
    form.set("creationId", crypto.randomUUID());
    await sql.unsafe(
      `create function ${trigger}() returns trigger language plpgsql as $$ begin if NEW.user_id='${owner}'::uuid then raise exception 'goal persistence failure'; end if; return NEW; end $$`,
    );
    await sql.unsafe(
      `create trigger ${trigger} before update on fkh_user_feature_preferences for each row execute function ${trigger}()`,
    );
    expect(await addGoalWithStateAction(form)).toMatchObject({
      ok: false,
      code: "goal_save_failed",
      error: expect.any(String),
    });
    expect((await getProductPreferences(owner)).goals).toHaveLength(0);
    await sql.unsafe(`drop function ${trigger}() cascade`);
    expect(await addGoalWithStateAction(form)).toEqual({ ok: true });
    expect(await addGoalWithStateAction(form)).toEqual({ ok: true });
    const [saved] = (await getProductPreferences(owner)).goals;
    expect(saved.targetDate).toBe("2026-12-31");
    expect((await getProductPreferences(owner)).goals).toHaveLength(1);
    form.set("goalId", saved.id);
    form.set("currentValue", "");
    expect(await updateGoalWithStateAction(form)).toMatchObject({ ok: false, code: "goal_values" });
    expect((await getProductPreferences(owner)).goals[0].currentValue).toBe(195);
    form.set("currentValue", "200");
    expect(await updateGoalWithStateAction(form)).toEqual({ ok: true });
    expect(await updateGoalWithStateAction(form)).toEqual({ ok: true });
    const [settings] =
      await sql`select highlight_settings_json from fkh_user_feature_preferences where user_id=${owner}`;
    expect(settings.highlight_settings_json).toMatchObject({
      otherFeatureSetting: "retain",
      goalMovements: [expect.objectContaining({ from: 195, to: 200 })],
    });
    expect(await deleteGoalWithStateAction(form)).toEqual({ ok: true });
    expect((await getProductPreferences(owner)).goals).toHaveLength(0);
    expect(
      (
        await sql`select highlight_settings_json from fkh_user_feature_preferences where user_id=${owner}`
      )[0].highlight_settings_json,
    ).toMatchObject({ otherFeatureSetting: "retain", goalMovements: [] });
  });

  it("retries one creation id without duplicates and refuses to discard an existing goal at capacity", async () => {
    const form = goalForm("Retry target");
    form.set("creationId", crypto.randomUUID());
    await Promise.all([redirected(addGoalAction(form)), redirected(addGoalAction(form))]);
    expect((await getProductPreferences(owner)).goals).toHaveLength(1);
    const original = (await getProductPreferences(owner)).goals[0];
    form.set("targetValue", "220");
    expect(await redirected(addGoalAction(form))).toContain("goal_request");
    expect((await getProductPreferences(owner)).goals).toEqual([original]);
    const full = Array.from({ length: 12 }, (_, index) => ({
      ...original,
      id: `fixture-${index}`,
      title: `Saved target ${index}`,
    }));
    await updateProductPreferences(owner, { goals: full });
    expect(await redirected(addGoalAction(goalForm("Thirteenth target")))).toContain("goal_limit");
    expect((await getProductPreferences(owner)).goals).toEqual(full);
  });

  it("retains independent edits and their movement history, then deletes only the selected goal", async () => {
    await redirected(addGoalAction(goalForm("Carry target")));
    const lower = goalForm("Dispersion target");
    Object.entries({
      type: "dispersion",
      startingValue: "30",
      currentValue: "25",
      targetValue: "20",
    }).forEach(([key, value]) => lower.set(key, value));
    await redirected(addGoalAction(lower));
    const [carry, dispersion] = (await getProductPreferences(owner)).goals;
    expect(goalProgress(carry)).toBe(25);
    expect(goalProgress(dispersion)).toBe(50);
    const upperEdit = goalForm("Carry target");
    upperEdit.set("goalId", carry.id);
    upperEdit.set("currentValue", "205");
    lower.set("goalId", dispersion.id);
    lower.set("currentValue", "22");
    await Promise.all([
      redirected(updateGoalAction(upperEdit)),
      redirected(updateGoalAction(lower)),
    ]);
    const updated = (await getProductPreferences(owner)).goals;
    expect(updated.map(goalProgress)).toEqual([75, 80]);
    const [row] =
      await sql`select highlight_settings_json from fkh_user_feature_preferences where user_id=${owner}`;
    expect(row.highlight_settings_json.goalMovements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ goalId: carry.id, from: 195, to: 205 }),
        expect.objectContaining({ goalId: dispersion.id, from: 25, to: 22 }),
      ]),
    );
    const remove = new FormData();
    remove.set("goalId", carry.id);
    await deleteGoalAction(remove);
    expect((await getProductPreferences(owner)).goals).toEqual([updated[1]]);
    expect(
      (
        await sql`select highlight_settings_json from fkh_user_feature_preferences where user_id=${owner}`
      )[0].highlight_settings_json.goalMovements,
    ).toHaveLength(1);
  });

  it("keeps foreign goals unchanged and rejects invalid numbers and calendar dates without creating a goal", async () => {
    await redirected(addGoalAction(goalForm("Private target")));
    const original = await getProductPreferences(owner);
    actor.userId = foreign;
    const foreignEdit = goalForm("Wrong account edit");
    foreignEdit.set("goalId", original.goals[0].id);
    expect(await redirected(updateGoalAction(foreignEdit))).toContain("goal_not_found");
    expect(await updateGoalWithStateAction(foreignEdit)).toMatchObject({
      ok: false,
      code: "goal_not_found",
    });
    await deleteGoalAction(foreignEdit);
    expect(await getProductPreferences(owner)).toEqual(original);
    expect((await getProductPreferences(foreign)).goals).toHaveLength(0);
    actor.userId = owner;
    for (const invalid of ["", "NaN", "Infinity", "1e308"]) {
      const form = goalForm("Invalid target");
      form.set("currentValue", invalid);
      expect(await redirected(addGoalAction(form))).toContain("goal_values");
    }
    const form = goalForm("Invalid deadline");
    form.set("goalTargetDate", "2026-02-31");
    expect(await redirected(addGoalAction(form))).toContain("goal_date");
    expect(await getProductPreferences(owner)).toEqual(original);
  });

  it("keeps both independently added goals when two saves wait on the same preference row", async () => {
    await updateProductPreferences(owner, { goals: [] });
    const observer = postgres(url!, { max: 1 });
    let pending: Promise<string>[] = [];
    let waiting = 0;
    try {
      await sql.begin(async (lock) => {
        await lock`select user_id from fkh_user_feature_preferences where user_id=${owner} for update`;
        pending = [
          redirected(addGoalAction(goalForm("First target"))),
          redirected(addGoalAction(goalForm("Second target"))),
        ];
        const deadline = Date.now() + 5000;
        while (waiting < 2 && Date.now() < deadline) {
          waiting = Number(
            (
              await observer`select count(*) from pg_stat_activity where datname='fkh_redesign' and wait_event_type='Lock' and query like '%fkh_user_feature_preferences%'`
            )[0].count,
          );
          if (waiting < 2) await new Promise((resolve) => setTimeout(resolve, 10));
        }
      });
      await Promise.all(pending);
      expect(waiting).toBe(2);
      expect((await getProductPreferences(owner)).goals.map((goal) => goal.title).sort()).toEqual([
        "First target",
        "Second target",
      ]);
    } finally {
      await Promise.allSettled(pending);
      await observer.end();
    }
  });
});
