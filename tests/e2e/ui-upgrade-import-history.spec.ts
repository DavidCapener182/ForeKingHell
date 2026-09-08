import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { readFile } from "node:fs/promises";
test("Import history searches beyond50 and preserves pages, filters and export scope", async ({
  page,
  context,
}, info) => {
  const value = process.env.DATABASE_URL;
  const target = value ? new URL(value) : null;
  test.skip(
    process.env.RUN_REDESIGN_DB_TESTS !== "1" ||
      target?.hostname !== "127.0.0.1" ||
      target.port !== "55432" ||
      target.pathname !== "/fkh_redesign" ||
      process.env.PLAYWRIGHT_BASE_URL !== "http://localhost:3116",
    "Designated fixture only",
  );
  test.skip(info.project.name !== "chromium");
  test.setTimeout(240000);
  page.setDefaultTimeout(15000);
  const db = postgres(value!, { max: 1 });
  let owner: string | undefined;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    owner = (
      await db`insert into fkh_users(name) values('Synthetic import history browser') returning id`
    )[0].id;
    await db`insert into fkh_import_files(user_id,source,file_name,raw_csv_hash,status,created_at)
      select ${owner!},'rapsodo','recent-file-'||i||'.csv',lpad(i::text,64,'0'),'saved','2026-09-01'::timestamptz from generate_series(1,52) i`;
    await db`insert into fkh_import_files(user_id,source,file_name,raw_csv_hash,status,created_at)
      select ${owner!},'rapsodo','archived-file-'||i||'.csv',lpad((i+100)::text,64,'0'),'archived','2026-09-02'::timestamptz from generate_series(1,60) i`;
    await db`insert into fkh_import_files(user_id,source,file_name,raw_csv_hash,status,created_at) values(${owner!},'csv','older-unique.csv',${"z".repeat(64)},'saved','2024-01-01')`;
    const enc = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
    await context.clearCookies();
    await context.addCookies([
      {
        name: "sb-playwright-auth-token",
        value: encodeURIComponent(
          JSON.stringify({
            access_token: [
              enc({ alg: "none" }),
              enc({ sub: owner, email: "fixture@example.invalid" }),
              "playwright",
            ].join("."),
          }),
        ),
        domain: "localhost",
        path: "/",
      },
    ]);
    for (const surface of ["workbench", "companion"])
      for (const [width, height] of [
        [1440, 900],
        [1280, 800],
        [390, 844],
        [360, 800],
        [1023, 800],
        [1024, 800],
      ]) {
        await page.setViewportSize({ width, height });
        await page.goto(`/surface/${surface}?next=${encodeURIComponent("/import#import-library")}`);
        const library = page.locator("[data-import-library-card]");
        await expect(
          library.getByRole("status").filter({ hasText: /^\d+ matching files/ }),
        ).toContainText("53 matching files", {
          timeout: 60000,
        });
        await library.getByRole("link", { name: "Next files", exact: true }).click();
        await expect(
          library.getByRole("status").filter({ hasText: /^\d+ matching files/ }),
        ).toContainText("Page 2 of 3");
        await library.getByRole("link", { name: "Next files", exact: true }).click();
        await expect(
          library.getByRole("status").filter({ hasText: /^\d+ matching files/ }),
        ).toContainText("Page 3 of 3");
        await expect(library).toContainText("older-unique.csv");
        const downloadReady = page.waitForEvent("download");
        await library.locator('[data-export-table-id="import-library"]').click();
        const csv = await readFile((await (await downloadReady).path())!, "utf8");
        expect(csv).toContain("older-unique.csv");
        expect(csv).not.toContain("archived-file");
        expect(csv.match(/recent-file-/g)).toHaveLength(2);
        await library
          .getByRole("textbox", { name: "Search all files", exact: true })
          .fill("older-unique");
        await library
          .getByRole("combobox", { name: "Import source", exact: true })
          .selectOption("csv");
        await library.getByRole("button", { name: "Apply history filters", exact: true }).click();
        await expect(page).toHaveURL(/importSource=csv/);
        await expect(
          library.getByRole("status").filter({ hasText: /^\d+ matching files/ }),
        ).toContainText("1 matching files");
        await expect(
          library.getByRole("status").filter({ hasText: /^\d+ matching files/ }),
        ).toContainText("Page 1 of 1");
        await page.reload();
        await expect(
          library.getByRole("textbox", { name: "Search all files", exact: true }),
        ).toHaveValue("older-unique");
        await expect(
          library.getByRole("combobox", { name: "Import source", exact: true }),
        ).toHaveValue("csv");
        await library
          .getByRole("textbox", { name: "Search all files", exact: true })
          .fill("absent");
        await library.getByRole("button", { name: "Apply history filters", exact: true }).click();
        await expect(
          library.getByRole("status").filter({ hasText: /^\d+ matching files/ }),
        ).toContainText("0 matching files");
        await page.goBack();
        await expect(
          library.getByRole("status").filter({ hasText: /^\d+ matching files/ }),
        ).toContainText("1 matching files");
        await expect(
          library.getByRole("textbox", { name: "Search all files", exact: true }),
        ).toHaveValue("older-unique");
        await library.screenshot({ path: info.outputPath(`P35-C10-${surface}-${width}.png`) });
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        await library.getByRole("button", { name: "Clear history filters", exact: true }).click();
        await expect(
          library.getByRole("status").filter({ hasText: /^\d+ matching files/ }),
        ).toContainText("53 matching files");
        await library
          .getByRole("combobox", { name: "Import outcome", exact: true })
          .selectOption("archived");
        await library.getByRole("button", { name: "Apply history filters", exact: true }).click();
        await expect(
          library.getByRole("status").filter({ hasText: /^\d+ matching files/ }),
        ).toContainText("60 matching files");
      }
    expect(errors).toEqual([]);
    expect((await db`select id from fkh_import_files where user_id=${owner!}`).length).toBe(113);
  } finally {
    if (owner) await db`delete from fkh_users where id=${owner}`;
    await db.end();
  }
});
