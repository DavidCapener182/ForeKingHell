import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { NextRequest } from "next/server";
import { closeDb } from "@/db/client";
import { runIdempotentOfflineOperation } from "@/lib/offline-operation-ledger";

const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const url = process.env.DATABASE_URL;
if (enabled) {
  const target = url ? new URL(url) : null;
  if (
    !target ||
    !["localhost", "127.0.0.1"].includes(target.hostname) ||
    target.pathname !== "/fkh_redesign"
  )
    throw new Error("Disposable offline ledger database required.");
}

describe.skipIf(!enabled)("offline ledger claim ownership", () => {
  let sql: ReturnType<typeof postgres>;
  beforeAll(() => {
    sql = postgres(url!, { max: 1 });
  });
  afterAll(async () => {
    await closeDb();
    await sql.end();
  });

  it("does not let an expired worker complete a newer worker's claim", async () => {
    const userId = (
      await sql`insert into fkh_users(name) values('Synthetic offline owner') returning id`
    )[0].id;
    let releaseFirst!: () => void;
    let releaseSecond!: () => void;
    let firstStarted!: () => void;
    let secondStarted!: () => void;
    const firstReady = new Promise<void>((resolve) => {
      firstStarted = resolve;
    });
    const secondReady = new Promise<void>((resolve) => {
      secondStarted = resolve;
    });
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const secondGate = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });
    const operationId = crypto.randomUUID();
    const run = (execute: () => Promise<{ status: number; body: Record<string, unknown> }>) =>
      runIdempotentOfflineOperation({
        request: new NextRequest("http://localhost/api/offline/round-edits", {
          headers: { "x-fkh-offline-operation": operationId },
        }),
        userId,
        kind: "round-edit",
        payload: { fixture: true },
        execute,
      });
    let first: Promise<Response> | undefined;
    let second: Promise<Response> | undefined;
    try {
      first = run(async () => {
        firstStarted();
        await firstGate;
        return { status: 200, body: { ok: true, worker: "expired" } };
      });
      await firstReady;
      await sql`update fkh_offline_operations set updated_at=now()-interval '6 minutes' where user_id=${userId}`;
      second = run(async () => {
        secondStarted();
        await secondGate;
        return { status: 200, body: { ok: true, worker: "current" } };
      });
      await secondReady;
      releaseFirst();
      await first;
      expect(
        (await sql`select status from fkh_offline_operations where user_id=${userId}`)[0].status,
      ).toBe("pending");
      releaseSecond();
      await second;
      const replay = await run(async () => {
        throw new Error("Replay must not execute");
      });
      expect(await replay.json()).toEqual({ ok: true, worker: "current" });
    } finally {
      releaseFirst();
      releaseSecond();
      await Promise.allSettled([first, second].filter(Boolean));
      await sql`delete from fkh_users where id=${userId}`;
    }
  });
});
