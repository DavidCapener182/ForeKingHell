import { afterAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import { GET } from "@/app/api/desktop-workbench/commands/route";
const actor = vi.hoisted(() => ({ id: "", fail: false }));
vi.mock("@/lib/current-user", () => ({
  getCurrentUser: async () => (actor.id ? { id: actor.id } : null),
}));
vi.mock("@/lib/social", () => ({
  getFriendIds: async () => {
    if (actor.fail) throw new Error("Synthetic lookup failure");
    return [];
  },
}));
const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const url = process.env.DATABASE_URL;
if (enabled) {
  const t = new URL(url!);
  if (t.hostname !== "127.0.0.1" || t.port !== "55432" || t.pathname !== "/fkh_redesign")
    throw new Error("Disposable local database required");
}
afterAll(async () => {
  if (enabled) await closeDb();
});
describe.skipIf(!enabled)("navigation command account and entity identity", () => {
  it("returns exact owned entity destinations and reports lookup failures as retryable", async () => {
    const db = postgres(url!, { max: 1 });
    const users: string[] = [];
    try {
      users.push(
        ...(
          await db`insert into fkh_users(name) values('Synthetic command owner'),('Synthetic foreign command owner') returning id`
        ).map((row) => row.id),
      );
      actor.id = users[0];
      const ids: string[] = [];
      for (const owner of users) {
        ids.push(
          (
            await db`insert into fkh_sessions(user_id,source,type,date,raw_csv_text,file_name) values(${owner},'manual','range',now(),'Synthetic','Navigation fixture.csv') returning id`
          )[0].id,
        );
      }
      const club = (
        await db`insert into fkh_clubs(user_id,type,normalized_club_key) values(${users[0]},'7i','command-owned') returning id`
      )[0];
      const foreign = (
        await db`insert into fkh_clubs(user_id,type,normalized_club_key) values(${users[1]},'7i','command-foreign') returning id`
      )[0];
      const response = await GET(new Request("http://localhost/api/desktop-workbench/commands"));
      expect(response.status).toBe(200);
      const { items } = await response.json();
      expect(items.some((item: { href: string }) => item.href === `/sessions/${ids[0]}`)).toBe(
        true,
      );
      expect(
        items.some((item: { href: string }) => item.href === `/bag/${club.id}/analytics`),
      ).toBe(true);
      expect(JSON.stringify(items)).not.toContain(ids[1]);
      expect(JSON.stringify(items)).not.toContain(foreign.id);
      // These matching records precede every original recent-only window.
      await db`insert into fkh_sessions(user_id,source,type,date,raw_csv_text,file_name)
        select ${users[0]},'manual',case when n%2=0 then 'round' else 'range' end,now(),'Synthetic','Recent distractor ' || n from generate_series(1,40) n`;
      const historical =
        await db`insert into fkh_sessions(user_id,source,type,date,raw_csv_text,file_name)
        values(${users[0]},'manual','range','2020-01-01','Synthetic','Archive needle 100%_ session'),
        (${users[0]},'manual','round','2020-01-01','Synthetic','Archive needle 100%_ round'),
        (${users[1]},'manual','round','2020-01-01','Synthetic','Archive needle 100%_ foreign') returning id,user_id,type`;
      const courseRows =
        await db`insert into fkh_courses(name,created_by_user_id,visibility,updated_at)
        values('Archive needle 100%_ course',${users[0]},'private','2020-01-01'),
        ('Archive needle 100%_ forbidden',${users[1]},'private','2020-01-01') returning id,created_by_user_id`;
      try {
        const searched = await GET(
          new Request(
            "http://localhost/api/desktop-workbench/commands?q=Archive%20needle%20100%25_",
          ),
        );
        const result = (await searched.json()).items as { href: string }[];
        expect(result.length).toBeLessThanOrEqual(32);
        for (const row of historical.filter((row) => row.user_id === users[0])) {
          expect(
            result.some(
              (item) => item.href === `/${row.type === "round" ? "rounds" : "sessions"}/${row.id}`,
            ),
          ).toBe(true);
        }
        expect(result.some((item) => item.href === `/courses/${courseRows[0].id}/records`)).toBe(
          true,
        );
        expect(JSON.stringify(result)).not.toContain(courseRows[1].id);
        expect(JSON.stringify(result)).not.toContain(historical[2].id);
        const noMatch = await GET(
          new Request("http://localhost/api/desktop-workbench/commands?q=no-such-archive-record"),
        );
        expect((await noMatch.json()).items).toEqual([]);
      } finally {
        await db`delete from fkh_courses where id in ${db(courseRows.map((row) => row.id))}`;
      }
      const roundsOnly = await GET(
        new Request("http://localhost/api/desktop-workbench/commands?q=scorecard"),
      );
      expect(
        (await roundsOnly.json()).items.every((item: { type: string }) => item.type === "round"),
      ).toBe(true);
      const practiceOnly = await GET(
        new Request("http://localhost/api/desktop-workbench/commands?q=practice"),
      );
      expect(
        (await practiceOnly.json()).items.every(
          (item: { type: string }) => item.type === "session",
        ),
      ).toBe(true);
      const longName = "alpha bravo charlie delta echo foxtrot golf hotel india";
      const [longRecord] =
        await db`insert into fkh_sessions(user_id,source,type,date,raw_csv_text,file_name) values(${users[0]},'manual','range','2019-01-01','Synthetic',${longName}) returning id`;
      const longMatch = await GET(
        new Request(
          `http://localhost/api/desktop-workbench/commands?q=${encodeURIComponent(longName)}`,
        ),
      );
      expect(
        (await longMatch.json()).items.some(
          (item: { href: string }) => item.href === `/sessions/${longRecord.id}`,
        ),
      ).toBe(true);
      const ninthTermMiss = await GET(
        new Request(
          `http://localhost/api/desktop-workbench/commands?q=${encodeURIComponent(longName.replace("india", "absent"))}`,
        ),
      );
      expect((await ninthTermMiss.json()).items).toEqual([]);
      actor.fail = true;
      const failed = await GET(new Request("http://localhost/api/desktop-workbench/commands"));
      expect(failed.status).toBe(503);
      expect(await failed.json()).toEqual({ items: [] });
      actor.fail = false;
      expect(
        (await GET(new Request("http://localhost/api/desktop-workbench/commands"))).status,
      ).toBe(200);
    } finally {
      actor.id = "";
      actor.fail = false;
      if (users.length) await db`delete from fkh_users where id in ${db(users)}`;
      await db.end();
    }
  });
});
