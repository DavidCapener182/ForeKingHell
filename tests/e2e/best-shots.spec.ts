import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { hasLocalAuthBypass, injectAxe } from "./helpers";
import { canRunMutatingCompanionE2e, MutatingCompanionFixture } from "./mutating-companion-fixture";

test("best shots keeps carry, total, raw maxima and original evidence distinct", async ({
  page,
}, testInfo) => {
  const databaseUrl = process.env.DATABASE_URL;
  const target = databaseUrl ? new URL(databaseUrl) : null;
  test.skip(
    !hasLocalAuthBypass ||
      !canRunMutatingCompanionE2e ||
      !target ||
      !["localhost", "127.0.0.1"].includes(target.hostname) ||
      target.pathname !== "/fkh_redesign",
    "Requires the isolated redesign database and disposable identity.",
  );
  test.setTimeout(180_000);
  page.setDefaultTimeout(20_000);
  const sql = postgres(databaseUrl!, { max: 1 });
  const user = process.env.PLAYWRIGHT_MUTATING_TEST_USER_ID!;
  const fixture = new MutatingCompanionFixture();
  const file = `best-shots-e2e-${Date.now()}.csv`;
  fixture.trackFileName(file);
  try {
    const [club] =
      await sql`insert into fkh_clubs(user_id,type,normalized_club_key) values(${user},'3w',${file}) returning id`;
    const [session] =
      await sql`insert into fkh_sessions(user_id,source,type,play_context,date,file_name,raw_csv_text) values(${user},'csv','range','range','2026-09-06T12:00:00Z',${file},'Synthetic best-shot test evidence') returning id`;
    fixture.trackSession(session.id);
    const ids: string[] = [];
    for (const [index, carry, total, status] of [
      [1, 275, 290, "included"],
      [2, 260, 325, "included"],
      [3, 400, 450, "user_excluded"],
    ] as const) {
      const [shot] =
        await sql`insert into fkh_shots(user_id,session_id,club_id,club_type,play_context,shot_at,shot_number,carry_yd,total_yd,review_status,source_raw_json) values(${user},${session.id},${club.id},'3w','range','2026-09-06T12:00:00Z',${index},${carry},${total},${status},'{}'::jsonb) returning id`;
      ids.push(shot.id);
    }
    await page.goto(
      "/surface/workbench?next=" + encodeURIComponent("/bag/longest?club=3w&metric=carry"),
    );
    const record = page.locator("[data-selected-record]");
    await expect(record).toContainText("275 yd");
    await expect(record).toContainText("Shot 1");
    await expect(page.getByText(/A higher raw carry of 400 yd/)).toBeVisible();
    await page.getByRole("button", { name: "3W longest total: 325 yd", exact: true }).click();
    await expect(record).toContainText("325 yd");
    await expect(record).toContainText("Shot 2");
    await expect(page).toHaveURL(/metric=total/);
    await page.reload();
    await expect(record).toContainText("Shot 2");
    await page.goBack();
    await expect(record).toContainText("275 yd");
    await expect(page.getByRole("link", { name: "Inspect shot 1", exact: true })).toHaveAttribute(
      "href",
      new RegExp(`shotId=${ids[0]}`),
    );
    await page.getByRole("link", { name: "Inspect shot 1", exact: true }).click();
    await expect(page.locator("[data-single-shot-evidence]")).toContainText("exact shot");
    await expect(page.locator("[data-selected-shot=true]")).toHaveCount(1);
    await expect(page.locator("[data-selected-shot=true]")).toContainText("275");
    await page.goBack();
    await expect(record).toContainText("275 yd");
    for (const width of [320, 390, 430, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
        `overflow at ${width}`,
      ).toBeLessThanOrEqual(2);
      const button = page.getByRole("button", { name: "3W longest carry: 275 yd", exact: true });
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(
      "/surface/companion?next=" + encodeURIComponent("/bag/longest?club=3w&metric=carry"),
    );
    await page.getByLabel("Choose distance record").selectOption("total");
    await expect(record).toContainText("325 yd");
    await page.getByLabel("Choose distance record").selectOption("carry");
    await expect(record).toContainText("275 yd");
    await injectAxe(page);
    const violations = await page.evaluate(async () => {
      const axe = (
        window as unknown as {
          axe: { run: (context: string, options: unknown) => Promise<{ violations: unknown[] }> };
        }
      ).axe;
      return (
        await axe.run("[data-best-shots-board]", {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] },
        })
      ).violations;
    });
    await testInfo.attach("best-shots-accessibility.json", {
      body: JSON.stringify(violations, null, 2),
      contentType: "application/json",
    });
    expect(violations).toEqual([]);
  } finally {
    await fixture.cleanup();
    await sql`delete from fkh_clubs where user_id=${user} and normalized_club_key=${file} and not exists(select 1 from fkh_shots where club_id=fkh_clubs.id)`;
    await sql.end();
  }
});
