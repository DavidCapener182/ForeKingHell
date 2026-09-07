import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { randomUUID, createHash } from "node:crypto";
test("Shared round keeps public scorecard complete on every surface and rejects invalid links", async ({
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
      process.env.PLAYWRIGHT_BASE_URL !== "http://localhost:3116" ||
      info.project.name !== "chromium",
  );
  test.setTimeout(240000);
  page.setDefaultTimeout(15000);
  const db = postgres(value!, { max: 1 });
  let owner = "";
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    owner = (
      await db`insert into fkh_users(name) values('Synthetic shared golfer') returning id`
    )[0].id;
    const card = Array.from({ length: 18 }, (_, i) => ({
      holeNumber: i + 1,
      par: 4,
      yards: 401,
      name: null,
      score: i === 0 ? 5 : null,
      putts: i === 0 ? 2 : null,
      puttsSource: "manual",
      penalties: 0,
      fairwayHit: null,
      gir: false,
    }));
    const session = (
      await db`insert into fkh_sessions(user_id,source,type,date,raw_csv_text,course_name,scorecard_json,round_status,equipment_notes) values(${owner},'manual','real_round',now(),'synthetic','Synthetic public scorecard',${db.json(card)},'in_progress','Shared equipment note') returning id`
    )[0].id;
    const token = randomUUID();
    const hash = createHash("sha256").update(token).digest("hex");
    const link = (
      await db`insert into fkh_share_links(user_id,token_hash,resource_type,resource_id) values(${owner},${hash},'round',${session}) returning id`
    )[0].id;
    for (const surface of ["workbench", "companion"]) {
      await context.addCookies([
        { name: "fkh-app-surface", value: surface, domain: "localhost", path: "/" },
      ]);
      for (const [width, height] of [
        [1440, 900],
        [1280, 800],
        [390, 844],
        [360, 800],
        [1023, 800],
        [1024, 800],
      ]) {
        await page.setViewportSize({ width, height });
        await page.goto(`/share/${token}`, { waitUntil: "domcontentloaded", timeout: 90000 });
        await expect(
          page.getByRole("heading", { name: "Synthetic public scorecard", level: 1, exact: true }),
        ).toBeVisible({ timeout: 60000 });
        await expect(page.getByText("Partial recorded score", { exact: true })).toBeVisible();
        await expect(page.getByText("Needs complete scorecard", { exact: true })).toBeVisible();
        await expect(page.getByText(/1 of 18 holes have a recorded score/)).toBeVisible();
        await expect(page.getByRole("rowheader", { name: "Hole 18", exact: true })).toBeAttached();
        await expect(page.getByRole("cell", { name: "2 · manual", exact: true })).toBeAttached();
        await expect(page.getByRole("button", { name: /edit|delete/i })).toHaveCount(0);
        if (surface === "companion") {
          await page.locator("summary").filter({ hasText: "Round details" }).click();
          const table = page.getByRole("region", { name: "Shared scorecard table", exact: true });
          await table.focus();
          await page.keyboard.press("ArrowRight");
          await expect(page.getByRole("rowheader", { name: "Hole 18", exact: true })).toBeVisible();
        }
        await expect(page.getByText("Shared equipment note", { exact: true })).toBeVisible();
        await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        await page.screenshot({ path: info.outputPath(`P88-${surface}-${width}.png`) });
      }
    }
    await db`update fkh_share_links set revoked_at=now() where id=${link}`;
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Shared round unavailable", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Synthetic public scorecard", { exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    if (owner) await db`delete from fkh_users where id=${owner}`;
    await db.end();
  }
});
