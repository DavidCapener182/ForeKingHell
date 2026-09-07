import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { NextRequest } from "next/server";
import { setAchievementUnlockFlash } from "@/lib/achievements/notification-flash";
import { closeDb } from "@/db/client";
import { POST } from "@/app/api/offline/imports/route";
const actor = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/current-user", () => ({
  requireCurrentUserId: async () => actor.id,
  getOptionalCurrentUserId: async () => actor.id,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: vi.fn(),
}));
vi.mock("@/lib/achievements/notification-flash", () => ({ setAchievementUnlockFlash: vi.fn() }));
const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const url = process.env.DATABASE_URL;
if (enabled) {
  const t = url ? new URL(url) : null;
  if (!t || !["localhost", "127.0.0.1"].includes(t.hostname) || t.pathname !== "/fkh_redesign")
    throw new Error("Disposable import database required.");
}
describe.skipIf(!enabled)("offline import recovery", () => {
  let sql: ReturnType<typeof postgres>;
  beforeAll(() => {
    sql = postgres(url!, { max: 1 });
  });
  afterAll(async () => {
    await closeDb();
    await sql.end();
  });
  it("keeps invalid empty imports terminal without writing a session", async () => {
    actor.id = (
      await sql`insert into fkh_users(name) values('Synthetic validation owner') returning id`
    )[0].id;
    const operationId = crypto.randomUUID();
    const request = () =>
      new NextRequest("http://localhost/api/offline/imports", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-fkh-offline-owner": actor.id,
          "x-fkh-offline-operation": operationId,
        },
        body: JSON.stringify({ inputs: [] }),
      });
    try {
      const first = await POST(request());
      expect(first.status).toBe(400);
      const body = await first.json();
      const replay = await POST(request());
      expect(replay.status).toBe(400);
      expect(replay.headers.get("x-fkh-offline-replayed")).toBe("1");
      expect(await replay.json()).toEqual(body);
      expect(await sql`select id from fkh_sessions where user_id=${actor.id}`).toHaveLength(0);
    } finally {
      await sql`delete from fkh_users where id=${actor.id}`;
    }
  });
  it.each(["notification", "database"])(
    "recovers from a %s failure without duplicate imports",
    async (failure) => {
      actor.id = (
        await sql`insert into fkh_users(name) values('Synthetic import owner') returning id`
      )[0].id;
      const rawCsvText =
        "Shot Number,Club,Carry Distance,Total Distance,Ball Speed\n1,7 Iron,150,160,110\n2,7 Iron,152,162,111";
      const operationId = crypto.randomUUID();
      const request = () =>
        new NextRequest("http://localhost/api/offline/imports", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-fkh-offline-owner": actor.id,
            "x-fkh-offline-operation": operationId,
          },
          body: JSON.stringify({
            inputs: [
              {
                rawCsvText,
                fileName: "synthetic.csv",
                fileSizeBytes: rawCsvText.length,
                source: "rapsodo",
                sessionType: "range",
                sessionDate: "2026-09-01",
                distanceUnit: "yards",
              },
            ],
          }),
        });
      const trigger = `import_failure_${crypto.randomUUID().replaceAll("-", "")}`;
      if (failure === "notification")
        vi.mocked(setAchievementUnlockFlash).mockImplementation(() => {
          throw new Error("Synthetic import refresh failure");
        });
      try {
        if (failure === "database") {
          await sql.unsafe(
            `create function ${trigger}() returns trigger language plpgsql as $$ begin if NEW.user_id='${actor.id}'::uuid then raise exception 'synthetic import DB failure'; end if; return NEW; end $$`,
          );
          await sql.unsafe(
            `create trigger ${trigger} before insert on fkh_sessions for each row execute function ${trigger}()`,
          );
        }
        const failed = await POST(request());
        expect(failed.status).toBe(failure === "database" ? 503 : 200);
        const imported = await sql`select id from fkh_sessions where user_id=${actor.id}`;
        expect(imported).toHaveLength(failure === "database" ? 0 : 1);
        if (failure === "database") await sql.unsafe(`drop function ${trigger}() cascade`);
        // Keep notification failure active: replay must return the saved receipt,
        // rather than requiring the notification subsystem to recover first.
        const retried = await POST(request());
        expect(retried.status).toBe(200);
        if (failure === "notification")
          expect(retried.headers.get("x-fkh-offline-replayed")).toBe("1");
        const body = await retried.json();
        expect(body.savedSessionId).toBe(
          (await sql`select id from fkh_sessions where user_id=${actor.id}`)[0].id,
        );
        expect(await sql`select id from fkh_sessions where user_id=${actor.id}`).toHaveLength(1);
        expect(await sql`select id from fkh_shots where user_id=${actor.id}`).toHaveLength(2);
        expect(await (await POST(request())).json()).toEqual(body);
      } finally {
        await sql.unsafe(`drop function if exists ${trigger}() cascade`);
        vi.mocked(setAchievementUnlockFlash).mockReset();
        await sql`delete from fkh_users where id=${actor.id}`;
      }
    },
  );
});
