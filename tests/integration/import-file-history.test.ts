import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import { getImportFileHistory } from "@/lib/import-file-history";
const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const value = process.env.DATABASE_URL;
if (enabled) {
  const url = new URL(value!);
  if (url.hostname !== "127.0.0.1" || url.port !== "55432" || url.pathname !== "/fkh_redesign")
    throw new Error("Disposable database required");
}
describe.skipIf(!enabled)("complete owned import history", () => {
  afterAll(closeDb);
  it("paginates beyond50 before filtering, keeps ties stable and never exposes another owner's linked session", async () => {
    const db = postgres(value!, { max: 1 });
    const owners: string[] = [];
    try {
      owners.push(
        ...(
          await db`insert into fkh_users(name) values('Synthetic history owner'),('Synthetic foreign history') returning id`
        ).map((row) => row.id),
      );
      const seeded =
        await db`insert into fkh_import_files(user_id,source,file_name,raw_csv_hash,status,created_at)
        select ${owners[0]},'rapsodo','file-'||i||'.csv',lpad(i::text,64,'0'),'saved','2026-09-01'::timestamptz from generate_series(1,57) i returning id`;
      await db`insert into fkh_import_files(user_id,source,file_name,raw_csv_hash,status,created_at)
        select ${owners[0]},'manual','archived-'||i||'.csv',lpad((100+i)::text,64,'0'),'archived','2026-09-02'::timestamptz from generate_series(1,60) i`;
      const [foreign] =
        await db`insert into fkh_sessions(user_id,source,type,date,file_name,raw_csv_text) values(${owners[1]},'manual','range','2026-09-01','private.csv','private raw') returning id`;
      await db`insert into fkh_import_files(user_id,session_id,source,file_name,raw_csv_hash,status,created_at) values(${owners[0]},${foreign.id},'csv','older_100%.csv',${"z".repeat(64)},'saved','2024-01-01'),(${owners[1]},${foreign.id},'secret-source','foreign.csv',${"x".repeat(64)},'saved','2026-09-02')`;
      const pages = await Promise.all(
        [1, 2, 3].map((page) => getImportFileHistory(owners[0], { importPage: String(page) })),
      );
      expect(pages.map((page) => page.files.length)).toEqual([25, 25, 8]);
      const ids = pages.flatMap((page) => page.files.map((file) => file.id));
      expect(new Set(ids).size).toBe(58);
      expect(ids.slice(0, 57)).toEqual(
        seeded
          .map((row) => row.id)
          .sort()
          .reverse(),
      );
      expect(pages[0].sources).not.toContain("secret-source");
      const match = await getImportFileHistory(owners[0], {
        importQ: "_100%",
        importSource: "csv",
      });
      expect(match.total).toBe(1);
      expect(match.files[0].sessionId).toBeNull();
      expect(match.files[0].sessionType).toBeNull();
      expect((await getImportFileHistory(owners[0], { importStatus: "archived" })).total).toBe(60);
      expect((await getImportFileHistory(owners[0], { importStatus: "all" })).total).toBe(118);
      expect((await getImportFileHistory(owners[0], { importPage: "999" })).page).toBe(3);
      expect(
        (await getImportFileHistory(owners[0], { importOrder: "oldest" })).files[0].fileName,
      ).toBe("older_100%.csv");
      expect((await getImportFileHistory(owners[0], { importQ: "not found" })).files).toEqual([]);
      expect(
        (await db`select raw_csv_text from fkh_sessions where id=${foreign.id}`)[0].raw_csv_text,
      ).toBe("private raw");
    } finally {
      if (owners.length) await db`delete from fkh_users where id in ${db(owners)}`;
      await db.end();
    }
  });
});
