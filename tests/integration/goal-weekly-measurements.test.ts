import { afterAll, beforeAll, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import GoalsPage from "@/app/(app)/goals/page";
import { isValidElement, type ReactNode } from "react";
vi.mock("@/lib/product-preferences", () => ({
  getProductPreferences: async () => ({
    seasonPlan: {
      outcome: "Synthetic",
      focus: "Test",
      successMeasure: "Measured",
      weeklySessions: 1,
    },
    goals: [],
  }),
  goalProgress: () => 0,
  goalTypeLabel: () => "Test",
}));
vi.mock("@/lib/goal-improvement-project", () => ({
  getGoalImprovementProjectData: async () => ({}),
}));
vi.mock("@/app/goals/goal-project-panel", () => ({ GoalProjectPanel: () => null }));
vi.mock("@/app/goals/goal-form-panels", () => ({
  GoalCreateDialog: () => null,
  GoalDeleteDialog: () => null,
  GoalEditSheet: () => null,
}));
vi.mock("@/app/goals/season-plan-editor", () => ({ SeasonPlanEditor: () => null }));
vi.mock("@/app/goals/goal-evidence-sheet", () => ({ GoalEvidenceSheet: () => null }));
vi.mock("@/lib/admin", () => ({ requireAdminUser: async () => ({}) }));
const actor = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: async () => actor.id }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const url = process.env.DATABASE_URL;
if (enabled) {
  const target = new URL(url!);
  if (
    target.hostname !== "127.0.0.1" ||
    target.port !== "55432" ||
    target.pathname !== "/fkh_redesign"
  )
    throw new Error("Disposable local database required");
}
let sql: ReturnType<typeof postgres>;
beforeAll(() => {
  if (enabled) sql = postgres(url!, { max: 1 });
});
afterAll(async () => {
  if (enabled) {
    await closeDb();
    await sql.end();
  }
});

function text(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(text).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return text(node.props.children);
  return typeof node === "string" || typeof node === "number" ? String(node) : "";
}
it.skipIf(!enabled)(
  "does not count invalid measurements toward the weekly practice commitment",
  async () => {
    actor.id = (
      await sql`insert into fkh_users(name) values('Synthetic goal weekly evidence') returning id`
    )[0].id;
    try {
      const session = (
        await sql`insert into fkh_sessions(user_id,source,type,date,raw_csv_text) values(${actor.id},'csv','range',now(),'synthetic') returning id`
      )[0].id;
      const club = (
        await sql`insert into fkh_clubs(user_id,type,normalized_club_key) values(${actor.id},'7i','goal-weekly') returning id`
      )[0].id;
      for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        await sql`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_at,carry_yd,review_status,source_raw_json) values(${actor.id},${session},${club},'7i',now(),${value},'included','{}')`;
      }
      expect(text(await GoalsPage())).toContain(
        "0 qualifying sessions · 0 eligible measured shots",
      );
      await sql`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_at,ball_speed_mph,review_status,source_raw_json) values(${actor.id},${session},${club},'7i',now(),100,'included','{}')`;
      expect(text(await GoalsPage())).toContain(
        "1 qualifying sessions · 1 eligible measured shots",
      );
    } finally {
      await sql`delete from fkh_users where id=${actor.id}`;
    }
  },
);
