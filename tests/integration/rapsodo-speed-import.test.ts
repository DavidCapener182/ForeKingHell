import { afterAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import { importRapsodoSpeedSession } from "@/lib/rapsodo/import-speed-session";
const provider = vi.hoisted(() => ({
  connected: true,
  listed: true,
  empty: false,
  detailCalls: 0,
  count: 2 as number | null,
  capped: false,
}));
vi.mock("@/lib/rapsodo/token-cookie", () => ({
  getStoredRapsodoToken: async () => (provider.connected ? { token: "synthetic" } : null),
}));
vi.mock("@/lib/rapsodo/cloud-client", () => ({
  RapsodoCloudClient: class {
    async listSpeedSessions() {
      return provider.listed
        ? [
            {
              providerSessionId: "speed-one",
              dateIso: "2026-09-01T12:00:00Z",
              title: "Synthetic R-Speed",
              swingCount: provider.count,
              speedSystem: null,
              raw: { original: true },
            },
          ]
        : [];
    }
    async listSpeedSessionSwings() {
      provider.detailCalls++;
      if (provider.capped)
        return Array.from({ length: 500 }, (_, i) => ({
          clubSpeedMph: 100,
          swingNumber: i + 1,
          rapsodoSwingId: String(i),
          raw: {},
        }));
      return provider.empty
        ? []
        : [
            {
              clubSpeedMph: 100.123,
              swingNumber: 4,
              rapsodoSwingId: "a",
              raw: { side: "left", speed: 100.123 },
            },
            { clubSpeedMph: 102.456, swingNumber: 8, rapsodoSwingId: "b", raw: { speed: 102.456 } },
          ];
    }
  },
}));
const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const url = process.env.DATABASE_URL;
if (enabled) {
  const t = url ? new URL(url) : null;
  if (!t || t.hostname !== "127.0.0.1" || t.port !== "55432" || t.pathname !== "/fkh_redesign")
    throw new Error("Disposable database required");
}
describe.skipIf(!enabled)("R-Speed import", () => {
  afterAll(closeDb);
  it("fails closed without readings or access and atomically deduplicates actual provider details", async () => {
    const db = postgres(url!, { max: 1 });
    const id = crypto.randomUUID();
    try {
      await db`insert into fkh_users(id,name) values(${id},'Synthetic speed import')`;
      provider.connected = false;
      await expect(importRapsodoSpeedSession(id, "speed-one")).rejects.toThrow("Connect R-Cloud");
      provider.connected = true;
      provider.listed = false;
      await expect(importRapsodoSpeedSession(id, "speed-one")).rejects.toThrow("not available");
      expect(provider.detailCalls).toBe(0);
      provider.listed = true;
      provider.empty = true;
      await expect(importRapsodoSpeedSession(id, "speed-one")).rejects.toThrow(
        "no usable individual readings",
      );
      expect(await db`select id from fkh_speed_training_sessions where user_id=${id}`).toHaveLength(
        0,
      );
      provider.empty = false;
      provider.count = 3;
      await expect(importRapsodoSpeedSession(id, "speed-one")).rejects.toThrow(
        "incomplete or invalid",
      );
      provider.count = null;
      provider.capped = true;
      await expect(importRapsodoSpeedSession(id, "speed-one")).rejects.toThrow(
        "incomplete or invalid",
      );
      provider.capped = false;
      provider.count = 2;
      expect(await db`select id from fkh_speed_training_sessions where user_id=${id}`).toHaveLength(
        0,
      );

      const ids = await Promise.all([
        importRapsodoSpeedSession(id, "speed-one"),
        importRapsodoSpeedSession(id, "speed-one"),
      ]);
      expect(ids[0]).toBe(ids[1]);
      expect(await importRapsodoSpeedSession(id, "speed-one")).toBe(ids[0]);
      expect(await db`select id from fkh_speed_training_sessions where user_id=${id}`).toHaveLength(
        1,
      );
      const rows =
        await db`select club_speed_mph,swing_side,source_raw_json from fkh_speed_training_swings where speed_session_id=${ids[0]} order by swing_number`;
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({
        club_speed_mph: 100.123,
        swing_side: "left",
        source_raw_json: { providerSwingNumber: 4, rapsodoSwingId: "a" },
      });
      expect(rows[1].swing_side).toBeNull();
    } finally {
      await db`delete from fkh_users where id=${id}`;
      await db.end();
    }
  });
});
