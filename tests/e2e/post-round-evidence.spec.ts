import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { hasLocalAuthBypass, injectAxe } from "./helpers";
import { canRunMutatingCompanionE2e, MutatingCompanionFixture } from "./mutating-companion-fixture";

test("round evidence keeps empty states honest and carries measured club context into practice", async ({
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
    "Requires isolated redesign database and disposable account.",
  );
  test.setTimeout(180_000);
  const sql = postgres(databaseUrl!, { max: 1 });
  const user = process.env.PLAYWRIGHT_MUTATING_TEST_USER_ID!;
  const fixture = new MutatingCompanionFixture();
  const key = `round-evidence-${Date.now()}`;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    const [club] =
      await sql`insert into fkh_clubs(user_id,type,normalized_club_key) values(${user},'7i',${key}) returning id`;
    const rounds: string[] = [];
    for (const [index, date] of ["2026-09-03T12:00:00Z", "2026-09-04T12:00:00Z"].entries()) {
      const [round] =
        await sql`insert into fkh_sessions(user_id,source,type,play_context,date,file_name,raw_csv_text,round_status,course_name)
        values(${user},'csv','simulated_course','course',${date},${key + index},'Synthetic round evidence','complete',${index ? "Measured fixture round" : "Empty fixture round"}) returning id`;
      rounds.push(round.id);
      fixture.trackSession(round.id);
    }
    for (const [index, side] of [10, -12, 14].entries()) {
      await sql`insert into fkh_shots(user_id,session_id,club_id,club_type,play_context,shot_at,shot_number,carry_yd,side_carry_yd,review_status,source_raw_json)
        values(${user},${rounds[1]},${club.id},'7i','course','2026-09-04T12:00:00Z',${index + 1},150,${side},'included','{}'::jsonb)`;
    }
    for (const [surface, width] of [
      ["companion", 390],
      ["workbench", 1440],
    ] as const) {
      await page.setViewportSize({ width, height: 900 });
      const route = `/courses/strategy?mode=post&roundId=${rounds[0]}`;
      await page.goto(`/surface/${surface}?next=${encodeURIComponent(route)}`);
      const results = page.getByRole("region", { name: "Your scorecard tells part of the story" });
      await expect(results).toContainText("No club has three eligible directional readings yet");
      await expect(results.getByText("Measured", { exact: true })).toHaveCount(0);
      await expect(results.getByRole("link", { name: "Plan this club’s practice" })).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath(`empty-${surface}.png`), fullPage: true });
      await page
        .getByRole("combobox", { name: "Round to review", exact: true })
        .selectOption(rounds[1]);
      await page.getByRole("button", { name: "Load round", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`roundId=${rounds[1]}`));
      const measured = page.getByRole("region", { name: "What the measured shots show" });
      if (surface === "companion") {
        const disclosure = measured.locator("summary");
        await expect(
          measured.getByText("12.0 yd average lateral miss · 3 measured shots.", { exact: true }),
        ).not.toBeVisible();
        await disclosure.focus();
        await page.keyboard.press("Enter");
        await expect(
          measured.getByText("12.0 yd average lateral miss · 3 measured shots.", { exact: true }),
        ).toBeVisible();
        expect(
          (await page
            .getByRole("textbox", { name: "What worked or felt different?", exact: true })
            .boundingBox())!.height,
        ).toBeGreaterThanOrEqual(96);
      }
      await expect(measured).toContainText("12.0 yd average lateral miss");
      await expect(measured).toContainText("No same-club baseline");
      await expect(measured).toContainText("Suggested");
      const practice = measured.getByRole("link", { name: "Plan this club’s practice" });
      await expect(practice).toHaveAttribute(
        "href",
        `/practice?sourceSessionId=${rounds[1]}&club=7i`,
      );
      if (surface === "companion") {
        await measured.locator("summary").click();
      }
      await page.screenshot({
        path: testInfo.outputPath(`measured-${surface}.png`),
        fullPage: true,
      });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
      ).toBeLessThanOrEqual(1);
      await injectAxe(page);
      const violations = await page.evaluate(async () => {
        const axe = (
          window as unknown as {
            axe: { run: (context: string, options: unknown) => Promise<{ violations: unknown[] }> };
          }
        ).axe;
        return (
          await axe.run('section[aria-labelledby="post-round-results-title"]', {
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] },
          })
        ).violations;
      });
      expect(violations).toEqual([]);
      await practice.click();
      await expect(page.locator(`[data-practice-source-session="${rounds[1]}"]`)).toBeVisible({
        timeout: 60_000,
      });
      await expect(page).toHaveURL(new RegExp(`sourceSessionId=${rounds[1]}.*club=7i`));
    }
    expect(errors).toEqual([]);
  } finally {
    await fixture.cleanup();
    await sql`delete from fkh_clubs where user_id=${user} and normalized_club_key=${key} and not exists(select 1 from fkh_shots where club_id=fkh_clubs.id)`;
    await sql.end();
  }
});
