import { afterAll, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
const actor = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: async () => actor.id }));
import { getSharedAccountData } from "@/lib/shared-account-data";
const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const url = process.env.DATABASE_URL;
if (enabled) {
  const target = url ? new URL(url) : null;
  if (
    target?.hostname !== "127.0.0.1" ||
    target.port !== "55432" ||
    target.pathname !== "/fkh_redesign"
  )
    throw new Error("Disposable database required");
}
afterAll(closeDb);
it.skipIf(!enabled)(
  "shared overview isolates owner data and requires current membership",
  async () => {
    const db = postgres(url!, { max: 1 });
    const owners: string[] = [];
    try {
      owners.push(
        ...(
          await db`insert into fkh_users(name) values('Synthetic shared owner'),('Synthetic other owner'),('Synthetic reader') returning id`
        ).map((row) => row.id),
      );
      const sessionIds: string[] = [];
      for (const [index, owner] of owners.slice(0, 2).entries()) {
        const [club] =
          await db`insert into fkh_clubs(user_id,type,normalized_club_key) values(${owner},'driver','synthetic-driver') returning id`;
        const [session] =
          await db`insert into fkh_sessions(user_id,source,type,date,raw_csv_text,scorecard_json) values(${owner},'manual','round',now(),'Synthetic',${db.json(
            [
              { holeNumber: 1, par: 4, score: 5 },
              { holeNumber: 2, par: 4, score: 4 },
            ],
          )}) returning id`;
        sessionIds.push(session.id);
        await db`insert into fkh_shots(user_id,session_id,club_id,shot_at,club_type,total_yd,source_raw_json) values(${owner},${session.id},${club.id},now(),'driver',${index ? 400 : 200},'{}')`;
        await db`insert into fkh_shots(user_id,session_id,club_id,shot_at,club_type,total_yd,source_raw_json,review_status) values(${owner},${session.id},${club.id},now(),'driver',999,'{}','user_excluded')`;
      }
      const [partial] =
        await db`insert into fkh_sessions(user_id,source,type,date,raw_csv_text,scorecard_json) values(${owners[0]},'manual','round',now(),'Synthetic incomplete',${db.json(
          [
            { holeNumber: 1, par: 4, score: 5 },
            { holeNumber: 2, par: 4 },
          ],
        )}) returning id`;
      actor.id = owners[2];
      await expect(getSharedAccountData("not-a-uuid")).rejects.toMatchObject({
        digest: expect.stringContaining("404"),
      });
      await expect(getSharedAccountData(owners[0])).rejects.toMatchObject({
        digest: expect.stringContaining("404"),
      });
      for (const role of ["coach", "viewer", "editor"]) {
        await db`insert into fkh_account_memberships(owner_user_id,member_user_id,role) values(${owners[0]},${actor.id},${role}) on conflict(owner_user_id,member_user_id) do update set role=excluded.role`;
        const data = await getSharedAccountData(owners[0]);
        expect(data).toMatchObject({
          accessRole: role,
          sessionCount: 2,
          shotCount: 1,
          activeClubCount: 1,
          longestDriveYd: 200,
        });
        expect(Object.keys(data!.profile).sort()).toEqual(["email", "id", "name"]);
        expect(data!.recentRounds.find((row) => row.id === partial.id)?.totalScore).toBeNull();
        expect(data!.recentRounds.find((row) => row.id === sessionIds[0])?.totalScore).toBe(9);
        expect(data!.recentRounds.map((row) => row.id)).not.toContain(sessionIds[1]);
      }
      await db`delete from fkh_account_memberships where owner_user_id=${owners[0]}`;
      await expect(getSharedAccountData(owners[0])).rejects.toMatchObject({
        digest: expect.stringContaining("404"),
      });
      actor.id = owners[0];
      expect((await getSharedAccountData(owners[0]))?.accessRole).toBe("owner");
    } finally {
      if (owners.length) {
        await db`delete from fkh_shots where user_id in ${db(owners)}`;
        await db`delete from fkh_users where id in ${db(owners)}`;
      }
      await db.end();
    }
  },
);

it.skipIf(!enabled)(
  "shared longest drive requires a positive finite total without discarding other shot evidence",
  async () => {
    const db = postgres(url!, { max: 1 });
    let owner: string | undefined;
    try {
      const [user] =
        await db`insert into fkh_users(name) values('Synthetic finite shared driver') returning id`;
      owner = user.id;
      actor.id = user.id;
      const [club] =
        await db`insert into fkh_clubs(user_id,type,normalized_club_key) values(${user.id},'driver','finite-shared-driver') returning id`;
      const [session] =
        await db`insert into fkh_sessions(user_id,source,type,date,raw_csv_text) values(${user.id},'manual','range',now(),'Synthetic') returning id`;
      for (const total of ["NaN", "Infinity", "-Infinity", "0", "-1"]) {
        await db`insert into fkh_shots(user_id,session_id,club_id,shot_at,club_type,total_yd,source_raw_json) values(${user.id},${session.id},${club.id},now(),'driver',${total}::double precision,'{}')`;
      }
      expect(await getSharedAccountData(user.id)).toMatchObject({
        longestDriveYd: null,
        shotCount: 5,
      });
      await db`insert into fkh_shots(user_id,session_id,club_id,shot_at,club_type,total_yd,source_raw_json) values(${user.id},${session.id},${club.id},now(),'driver',215.4,'{}')`;
      expect(await getSharedAccountData(user.id)).toMatchObject({
        longestDriveYd: 215.4,
        shotCount: 6,
      });
    } finally {
      if (owner) {
        await db`delete from fkh_shots where user_id=${owner}`;
        await db`delete from fkh_users where id=${owner}`;
      }
      await db.end();
    }
  },
);
