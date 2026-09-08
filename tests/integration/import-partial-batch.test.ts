import { afterAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
const actor = vi.hoisted(() => ({ id: "", failReview: false }));
vi.mock("@/lib/current-user", () => ({
  requireCurrentUserId: async () => actor.id,
  getOptionalCurrentUserId: async () => actor.id,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: vi.fn(),
}));
vi.mock("@/lib/practice-planner", async (original) => ({
  ...(await original<typeof import("@/lib/practice-planner")>()),
  completeMatchingPracticePlanFromImport: async () => {
    if (actor.failReview) throw new Error("Synthetic postcommit practice failure");
    return null;
  },
}));
import {
  saveRapsodoImportBatch,
  type SaveRapsodoImportInput,
} from "@/lib/imports/save-rapsodo-import";
const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const value = process.env.DATABASE_URL;
if (enabled) {
  const target = new URL(value!);
  if (
    target.hostname !== "127.0.0.1" ||
    target.port !== "55432" ||
    target.pathname !== "/fkh_redesign"
  )
    throw new Error("Designated disposable database required");
}
afterAll(async () => {
  if (enabled) await closeDb();
});
const input = (name: string, carry: number): SaveRapsodoImportInput => {
  const rawCsvText = `Shot Number,Club,Carry Distance,Total Distance,Ball Speed\n1,7 Iron,${carry},${carry + 10},110\n2,7 Iron,${carry + 2},${carry + 12},111`;
  return {
    rawCsvText,
    fileName: name,
    fileSizeBytes: rawCsvText.length,
    source: "rapsodo",
    sessionType: "range",
    sessionDate: "2026-09-01",
    distanceUnit: "yards",
  };
};
describe.skipIf(!enabled)("truthful partial import batch receipts", () => {
  it("retains first committed receipt, identifies failed and pending files, then retries without duplicating data", async () => {
    const db = postgres(value!, { max: 1 });
    const trigger = `partial_import_${crypto.randomUUID().replaceAll("-", "")}`;
    try {
      actor.id = (
        await db`insert into fkh_users(name) values('Partial batch isolated') returning id`
      )[0].id;
      await db.unsafe(
        `create function ${trigger}() returns trigger language plpgsql as $$ begin if NEW.user_id='${actor.id}'::uuid and NEW.file_name='second-fails.csv' then raise exception 'Synthetic second-file failure'; end if; return NEW; end $$`,
      );
      await db.unsafe(
        `create trigger ${trigger} before insert on fkh_sessions for each row execute function ${trigger}()`,
      );
      const inputs = [
        input("first.csv", 150),
        input("second-fails.csv", 160),
        input("third-pending.csv", 170),
      ];
      const first = await saveRapsodoImportBatch(inputs);
      expect(first.ok).toBe(false);
      if (first.ok) throw new Error("Expected partial failure");
      expect(first).toMatchObject({
        retryable: true,
        sessionCount: 1,
        skippedCount: 0,
        shotCount: 2,
        rawRowCount: 3,
      });
      expect(first.fileResults?.map((file) => file.status)).toEqual(["saved", "failed", "pending"]);
      expect(first.fileResults?.map((file) => file.inputIndex)).toEqual([0, 1, 2]);
      const firstRows =
        await db`select id,raw_csv_hash from fkh_sessions where user_id=${actor.id}`;
      expect(firstRows).toHaveLength(1);
      expect(first.fileResults?.[0]).toMatchObject({
        fileName: "first.csv",
        sessionId: firstRows[0].id,
      });
      expect(first.savedSessionId).toBe(firstRows[0].id);
      const firstShots =
        await db`select id,carry_yd,total_yd,source_raw_json from fkh_shots where user_id=${actor.id} order by id`;
      expect(firstShots).toHaveLength(2);
      await db.unsafe(`drop function ${trigger}() cascade`);
      const retry = await saveRapsodoImportBatch(inputs);
      expect(retry.ok).toBe(true);
      if (!retry.ok) throw new Error(retry.message);
      expect(retry.fileResults?.map((file) => file.status)).toEqual([
        "duplicate",
        "saved",
        "saved",
      ]);
      expect(retry.skippedCount).toBe(1);
      expect(retry.sessionCount).toBe(2);
      expect(retry.fileResults?.[0].sessionId).toBe(firstRows[0].id);
      expect(await db`select id from fkh_sessions where user_id=${actor.id}`).toHaveLength(3);
      expect(await db`select id from fkh_shots where user_id=${actor.id}`).toHaveLength(6);
      expect(
        await db`select id,carry_yd,total_yd,source_raw_json from fkh_shots where session_id=${firstRows[0].id} order by id`,
      ).toEqual(firstShots);
      const replay = await saveRapsodoImportBatch(inputs);
      expect(replay.ok).toBe(true);
      expect(replay.fileResults?.map((file) => file.status)).toEqual([
        "duplicate",
        "duplicate",
        "duplicate",
      ]);
      expect(await db`select id from fkh_sessions where user_id=${actor.id}`).toHaveLength(3);
    } finally {
      await db.unsafe(`drop function if exists ${trigger}() cascade`);
      if (actor.id) await db`delete from fkh_users where id=${actor.id}`;
      actor.id = "";
      await db.end();
    }
  });
  it("marks validation failure without implying earlier files were saved", async () => {
    const db = postgres(value!, { max: 1 });
    try {
      actor.id = (
        await db`insert into fkh_users(name) values('Batch validation isolated') returning id`
      )[0].id;
      const failed = await saveRapsodoImportBatch([
        input("first.csv", 150),
        { ...input("empty.csv", 160), rawCsvText: "" },
        input("third.csv", 170),
      ]);
      expect(failed.ok).toBe(false);
      expect(failed.fileResults?.map((file) => file.status)).toEqual([
        "pending",
        "failed",
        "pending",
      ]);
      expect(await db`select id from fkh_sessions where user_id=${actor.id}`).toHaveLength(0);
    } finally {
      if (actor.id) await db`delete from fkh_users where id=${actor.id}`;
      actor.id = "";
      await db.end();
    }
  });
  it("preserves a committed session when practice review fails afterwards", async () => {
    const db = postgres(value!, { max: 1 });
    try {
      actor.id = (
        await db`insert into fkh_users(name) values('Batch postcommit isolated') returning id`
      )[0].id;
      actor.failReview = true;
      const result = await saveRapsodoImportBatch([input("saved-review-unavailable.csv", 180)]);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.message);
      expect(result.fileResults?.[0].status).toBe("saved");
      expect(result.practicePlanMatches).toEqual([]);
      expect(result.warnings.join(" ")).toContain("practice review could not be completed");
      expect(await db`select id from fkh_sessions where user_id=${actor.id}`).toHaveLength(1);
      expect(await db`select id from fkh_shots where user_id=${actor.id}`).toHaveLength(2);
    } finally {
      actor.failReview = false;
      if (actor.id) await db`delete from fkh_users where id=${actor.id}`;
      actor.id = "";
      await db.end();
    }
  });
});
