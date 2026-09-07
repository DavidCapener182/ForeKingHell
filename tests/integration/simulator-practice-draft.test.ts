import { afterAll, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import { getRangeRealityHandicapData } from "@/lib/reality-handicap";
import { simulatorPracticeFingerprint } from "@/lib/simulator-practice-handoff";
import {
  getSavedPracticePlan,
  completeOwnedPracticePlanFromImport,
  savedPracticePlanToPracticePlan,
} from "@/lib/practice-planner";
import { createSimulatorPracticeDraftAction } from "@/app/simulator-lab/practice-draft-action";
const actor = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/current-user", () => ({
  requireCurrentUserId: async () => actor.id,
  getOptionalCurrentUserId: async () => actor.id,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (href: string) => {
    throw new Error(`REDIRECT:${href}`);
  },
}));
const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const url = process.env.DATABASE_URL;
if (enabled) {
  const t = new URL(url!);
  if (t.hostname !== "127.0.0.1" || t.port !== "55432" || t.pathname !== "/fkh_redesign")
    throw new Error("Disposable DB required");
}
afterAll(closeDb);
it.skipIf(!enabled)(
  "persists exact owned Lab prescription once and rejects another account's evidence",
  async () => {
    const db = postgres(url!, { max: 1 });
    const users: string[] = [];
    try {
      users.push(
        ...(
          await db`insert into fkh_users(name) values('Synthetic Lab owner'),('Synthetic Lab stranger') returning id`
        ).map((row) => row.id),
      );
      actor.id = users[0];
      const session = (
        await db`insert into fkh_sessions(user_id,source,type,date,raw_csv_text) values(${actor.id},'manual','range',now(),'Synthetic Lab data') returning id`
      )[0].id;
      for (const type of ["7i", "driver"]) {
        const club = (
          await db`insert into fkh_clubs(user_id,type,normalized_club_key) values(${actor.id},${type},${type}) returning id`
        )[0].id;
        await db`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_at,carry_yd,total_yd,side_carry_yd,review_status,source_raw_json) select ${actor.id},${session},${club},${type},now(),150+n*3,160+n*3,n*5,'included','{}' from generate_series(1,4)n`;
      }
      const reality = await getRangeRealityHandicapData(actor.id);
      expect(reality.evidence?.sampleSize).toBe(8);
      const creationId = crypto.randomUUID();
      const form = new FormData();
      form.set("creationId", creationId);
      form.set("prescriptionId", "primary-club");
      form.set("fingerprint", simulatorPracticeFingerprint(reality, "primary-club"));
      await expect(createSimulatorPracticeDraftAction({ error: null }, form)).rejects.toThrow(
        `REDIRECT:/practice?planId=${creationId}`,
      );
      const saved = await getSavedPracticePlan(actor.id, creationId);
      expect(saved?.summary).toBe(reality.prescriptions[0].drill);
      expect(saved?.generation.prescriptionConfidence).toBe("Low");
      expect(savedPracticePlanToPracticePlan(saved!).confidenceLabel).toBe("Low");
      expect(saved?.generation.simulatorHandoff).toMatchObject({
        sampleSize: 8,
        sessionIds: [session],
      });
      expect(saved?.blocks[0].scoringRules.evidenceMode).toBe("manual");
      expect(await completeOwnedPracticePlanFromImport(actor.id, creationId, session)).toBeNull();
      expect(
        await db`select id from fkh_practice_results where practice_plan_id=${creationId}`,
      ).toHaveLength(0);
      await db`update fkh_shots set carry_yd=carry_yd+30 where user_id=${actor.id}`;
      await expect(createSimulatorPracticeDraftAction({ error: null }, form)).rejects.toThrow(
        `REDIRECT:/practice?planId=${creationId}`,
      );
      expect(await db`select id from fkh_practice_plans where user_id=${actor.id}`).toHaveLength(1);
      actor.id = users[1];
      form.set("creationId", crypto.randomUUID());
      expect((await createSimulatorPracticeDraftAction({ error: null }, form)).error).toContain(
        "evidence has changed",
      );
      expect(await db`select id from fkh_practice_plans where user_id=${actor.id}`).toHaveLength(0);
    } finally {
      actor.id = "";
      if (users.length) await db`delete from fkh_users where id in ${db(users)}`;
      await db.end();
    }
  },
);
