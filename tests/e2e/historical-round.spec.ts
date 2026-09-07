import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { hasLocalAuthBypass, injectAxe } from "./helpers";

test("completed round entry preserves edits, validates hidden holes and saves actual tee facts", async ({
  page,
  context,
}, testInfo) => {
  const url = process.env.DATABASE_URL;
  const target = url ? new URL(url) : null;
  test.skip(
    !hasLocalAuthBypass ||
      process.env.RUN_REDESIGN_DB_TESTS !== "1" ||
      process.env.PLAYWRIGHT_BASE_URL !== "http://localhost:3116" ||
      !target ||
      target.hostname !== "127.0.0.1" ||
      target.port !== "55432" ||
      target.pathname !== "/fkh_redesign",
    "Requires isolated redesign fixtures.",
  );
  test.setTimeout(180_000);
  page.setDefaultTimeout(15_000);
  const sql = postgres(url!, { max: 1 });
  let userId: string | undefined;
  const trigger = `history_round_${Date.now()}`;
  let alternateTeeId: string | null = null;
  try {
    userId = (
      await sql`insert into fkh_users(name) values('Synthetic historical round') returning id`
    )[0].id;
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const token = [
      encode({ alg: "none" }),
      encode({ sub: userId, email: "synthetic-history@forekinghell.local" }),
      "playwright",
    ].join(".");
    await context.clearCookies();
    await context.addCookies([
      {
        name: "sb-playwright-auth-token",
        value: encodeURIComponent(JSON.stringify({ access_token: token })),
        domain: "localhost",
        path: "/",
      },
    ]);
    const tees =
      await sql`select t.id,t.course_id from fkh_tee_sets t join fkh_courses c on c.id=t.course_id where c.visibility='shared' and exists(select 1 from fkh_holes h where h.tee_set_id=t.id) order by t.id`;
    const tee = tees[0];
    const [alternate] =
      await sql`insert into fkh_tee_sets(course_id,name,par) values(${tee.course_id},${trigger},72) returning id`;
    alternateTeeId = alternate.id;
    const holes =
      await sql`select hole_number,par,yards from fkh_holes where tee_set_id=${tee.id} order by hole_number`;
    const route = `/rounds/new?mode=history&courseId=${tee.course_id}&teeSetId=${tee.id}`;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/surface/companion?next=${encodeURIComponent(route)}`);
    const form = page.locator('[data-round-entry-layout="companion"]');
    const id = await form.locator('input[name="creationId"]').inputValue();
    await expect(form.getByRole("combobox", { name: "Course / tee", exact: true })).toHaveValue(
      tee.id,
    );
    await form.getByLabel("Date", { exact: true }).fill("2026-09-02");
    await form.getByLabel("Notes", { exact: true }).fill("Historical round recovery test");
    await page.screenshot({ path: testInfo.outputPath("history-setup-phone.png"), fullPage: true });
    await form.getByRole("radio", { name: "Score", exact: true }).click();
    for (let index = 0; index < holes.length; index++) {
      await form
        .locator(`input[name="score-${index}"]`)
        .fill(index === 0 ? "-1" : String(holes[index].par));
      if (index < holes.length - 1)
        await form.getByRole("button", { name: "Next hole", exact: true }).click();
    }
    await form.getByRole("radio", { name: "Review", exact: true }).click();
    await expect(form.getByRole("button", { name: "Save round", exact: true })).toBeDisabled();
    await form
      .getByRole("button", { name: "Fix first missing or invalid score", exact: true })
      .click();
    await expect(form.locator('input[name="score-0"]')).toBeVisible();
    await form.locator('input[name="score-0"]').fill(String(holes[0].par));
    await form.locator('input[name="putts-0"]').fill("2");
    {
      await form.getByRole("radio", { name: "Setup", exact: true }).click();
      await form
        .getByRole("combobox", { name: "Course / tee", exact: true })
        .selectOption(alternate.id);
      await expect(page.getByRole("alertdialog")).toContainText("clears the hole scores");
      await page.getByRole("button", { name: "Keep this scorecard", exact: true }).click();
      await expect(form.getByRole("combobox", { name: "Course / tee", exact: true })).toHaveValue(
        tee.id,
      );
    }
    await form.getByRole("radio", { name: "Score", exact: true }).click();
    await expect(form.locator('input[name="score-0"]')).toHaveValue(String(holes[0].par));
    await form.getByRole("radio", { name: "Setup", exact: true }).click();
    await form
      .getByRole("combobox", { name: "Course / tee", exact: true })
      .selectOption(alternate.id);
    await page.getByRole("button", { name: "Change and clear holes", exact: true }).click();
    await form.getByRole("radio", { name: "Score", exact: true }).click();
    await expect(form).toContainText("Hole details needed");
    await expect(form.locator("[data-entry-hole]")).toHaveCount(0);
    await form.getByRole("radio", { name: "Setup", exact: true }).click();
    await form.getByRole("combobox", { name: "Course / tee", exact: true }).selectOption(tee.id);
    await form.getByRole("radio", { name: "Score", exact: true }).click();
    await expect(form.locator('input[name="score-0"]')).toHaveValue("");
    for (let index = 0; index < holes.length; index++) {
      await form.locator(`input[name="score-${index}"]`).fill(String(holes[index].par));
      if (index === 0) await form.locator('input[name="putts-0"]').fill("-1");
      if (index < holes.length - 1)
        await form.getByRole("button", { name: "Next hole", exact: true }).click();
    }
    await form.getByRole("radio", { name: "Review", exact: true }).click();
    await form.getByRole("button", { name: "Save round", exact: true }).click();
    await expect(form.locator('input[name="putts-0"]')).toBeVisible();
    await expect(form.locator('input[name="putts-0"]')).toBeFocused();
    await form.locator('input[name="putts-0"]').fill("2");
    for (const width of [320, 390, 768, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(form.locator("[data-entry-hole]:visible")).toHaveCount(1);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
        `overflow at${width}`,
      ).toBeLessThanOrEqual(1);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: testInfo.outputPath("history-score-phone.png"), fullPage: true });
    await injectAxe(page);
    const violations = await page.evaluate(async () => {
      const axe = (
        window as unknown as {
          axe: { run: (context: string, options: unknown) => Promise<{ violations: unknown[] }> };
        }
      ).axe;
      return (
        await axe.run('[data-round-entry-layout="companion"]', {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] },
        })
      ).violations;
    });
    expect(violations).toEqual([]);
    await form.getByRole("radio", { name: "Review", exact: true }).click();
    await sql.unsafe(
      `create function ${trigger}() returns trigger language plpgsql as $$ begin if new.id='${id}'::uuid then raise exception 'deliberate historical rejection'; end if; return new; end $$`,
    );
    await sql.unsafe(
      `create trigger ${trigger} before insert on fkh_sessions for each row execute function ${trigger}()`,
    );
    await form.getByRole("button", { name: "Save round", exact: true }).click();
    await expect(form.getByRole("alert")).toContainText("Your entries are still here");
    await expect(form.locator('input[name="score-0"]')).toHaveValue(String(holes[0].par));
    await expect(form.locator('input[name="notes"]')).toHaveValue("Historical round recovery test");
    await sql.unsafe(`drop function ${trigger}() cascade`);
    await form.getByRole("button", { name: "Save round", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/rounds/${id}`), { timeout: 60_000 });
    const [saved] =
      await sql`select scorecard_json,round_status,notes from fkh_sessions where id=${id}`;
    expect(saved.round_status).toBe("complete");
    expect(saved.notes).toBe("Historical round recovery test");
    expect(saved.scorecard_json).toHaveLength(holes.length);
    expect(saved.scorecard_json[0]).toMatchObject({
      par: holes[0].par,
      yards: holes[0].yards,
      score: holes[0].par,
      putts: 2,
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/surface/workbench?next=${encodeURIComponent(route)}`);
    const desktop = page.locator('[data-round-entry-layout="workbench"]');
    const desktopId = await desktop.locator('input[name="creationId"]').inputValue();
    await expect(desktop.getByRole("combobox", { name: "Course / tee", exact: true })).toHaveValue(
      tee.id,
    );
    await desktop.getByLabel("Date", { exact: true }).fill("2026-09-02");
    await desktop.getByLabel("Notes", { exact: true }).fill("Desktop historical test");
    for (let index = 0; index < holes.length; index++)
      await desktop.locator(`input[name="score-${index}"]`).fill(String(holes[index].par));
    for (const width of [1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
        `desktop overflow at${width}`,
      ).toBeLessThanOrEqual(1);
      await page.screenshot({
        path: testInfo.outputPath(`history-desktop-${width}.png`),
        fullPage: true,
      });
    }
    await expect(desktop.locator('input[name="creationId"]')).toHaveValue(desktopId);
    await desktop.getByRole("button", { name: "Save real round", exact: true }).click();
    await expect(page).toHaveURL(/\/rounds\/[a-f0-9-]{36}$/, { timeout: 60_000 });
    await expect(page).toHaveURL(new RegExp(`/rounds/${desktopId}`));
    const [desktopSaved] =
      await sql`select scorecard_json,round_status,notes from fkh_sessions where id=${desktopId}`;
    expect(desktopSaved.round_status).toBe("complete");
    expect(desktopSaved.notes).toBe("Desktop historical test");
    expect(desktopSaved.scorecard_json).toHaveLength(holes.length);
  } finally {
    await sql.unsafe(`drop function if exists ${trigger}() cascade`);
    if (userId) await sql`delete from fkh_users where id=${userId}`;
    if (alternateTeeId) await sql`delete from fkh_tee_sets where id=${alternateTeeId}`;
    await sql.end();
  }
});
