import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { expectPageReady, hasLocalAuthBypass } from "./helpers";
import {
  canRunMutatingCompanionE2e,
  MutatingCompanionFixture,
  mutatingCompanionSkipReason,
} from "./mutating-companion-fixture";

test.describe("redesigned flagship workflows", () => {
  test.skip(
    !hasLocalAuthBypass,
    "Run against the isolated local database with the local test identity.",
  );
  test.setTimeout(180_000);

  test("a failed drill save rolls back the plan and preserves the editable recommendation", async ({
    page,
  }) => {
    const databaseUrl = process.env.DATABASE_URL;
    const target = databaseUrl ? new URL(databaseUrl) : null;
    test.skip(
      !canRunMutatingCompanionE2e ||
        !target ||
        !["localhost", "127.0.0.1"].includes(target.hostname) ||
        target.pathname !== "/fkh_redesign",
      "Fault injection is restricted to the isolated fkh_redesign database.",
    );
    const sql = postgres(databaseUrl!, { max: 1 });
    const userId = process.env.PLAYWRIGHT_MUTATING_TEST_USER_ID!;
    const triggerName = `fkh_redesign_reject_${crypto.randomUUID().replaceAll("-", "")}`;
    try {
      const [{ count: before }] =
        await sql`select count(*)::int as count from fkh_practice_plans where user_id = ${userId}`;
      await sql.unsafe(
        `CREATE FUNCTION ${triggerName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS (SELECT 1 FROM fkh_practice_plans WHERE id=NEW.practice_plan_id AND user_id='${userId}'::uuid) THEN RAISE EXCEPTION 'Synthetic drill write failure'; END IF; RETURN NEW; END; $$; CREATE TRIGGER ${triggerName} BEFORE INSERT ON fkh_practice_blocks FOR EACH ROW EXECUTE FUNCTION ${triggerName}();`,
      );
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(
        "/surface/companion?next=" + encodeURIComponent("/practice?club=7i&time=20"),
        { waitUntil: "domcontentloaded" },
      );
      const title = await page.locator("[data-current-practice-plan] h2").innerText();
      await page.getByRole("button", { name: "Start practice", exact: true }).click();
      await expect(page.getByRole("status")).toContainText(
        "Could not save practice. Your plan is still here",
      );
      await expect(page.locator("[data-current-practice-plan] h2")).toHaveText(title);
      await expect(page.getByRole("button", { name: "Start practice", exact: true })).toBeEnabled();
      const [{ count: after }] =
        await sql`select count(*)::int as count from fkh_practice_plans where user_id = ${userId}`;
      expect(after).toBe(before);
    } finally {
      await sql.unsafe(
        `DROP TRIGGER IF EXISTS ${triggerName} ON fkh_practice_blocks; DROP FUNCTION IF EXISTS ${triggerName}();`,
      );
      await sql.end();
    }
  });

  test("Today keeps its primary action and evidence readable at every requested width", async ({
    page,
  }) => {
    await page.goto("/surface/workbench?next=%2Ftoday", { waitUntil: "domcontentloaded" });
    await expectPageReady(page, /Today/i);
    const panel = page.locator("[data-today-decision-hero]");
    for (const width of [320, 390, 430, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(panel).toBeVisible();
      await expect(panel.getByRole("heading", { level: 1 })).toBeVisible();
      const evidence = await panel.locator("[data-decision-evidence]").boundingBox();
      expect(evidence).not.toBeNull();
      for (const link of await panel.getByRole("link").all()) {
        await expect(link).toBeVisible();
        const box = await link.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.height).toBeGreaterThanOrEqual(44);
        const intersects =
          box!.x < evidence!.x + evidence!.width &&
          box!.x + box!.width > evidence!.x &&
          box!.y < evidence!.y + evidence!.height &&
          box!.y + box!.height > evidence!.y;
        expect(intersects, `Action overlaps evidence at ${width}px`).toBe(false);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
        `Document overflow at ${width}px`,
      ).toBeLessThanOrEqual(2);
    }
    await expect(panel.getByRole("progressbar")).toHaveCount(0);
  });

  test("practice retains its exact activity through pause, reload and resume", async ({ page }) => {
    test.skip(!canRunMutatingCompanionE2e, mutatingCompanionSkipReason);
    const fixture = new MutatingCompanionFixture();
    try {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(
        "/surface/companion?next=" +
          encodeURIComponent("/practice?club=7i&time=20&source=redesign-e2e"),
        { waitUntil: "domcontentloaded" },
      );
      await expectPageReady(page, "Practice");
      await page.getByRole("button", { name: "Start practice", exact: true }).click();
      const range = page.locator("[data-active-range-mode]");
      await expect(range).toBeVisible();
      const id = await range.getAttribute("data-practice-plan-id");
      expect(id).toBeTruthy();
      fixture.trackPracticePlan(id);
      await page.getByRole("button", { name: "Complete Block", exact: true }).click();
      const block = await page.locator("[data-current-range-block]").innerText();
      await page.getByRole("button", { name: "Session options", exact: true }).click();
      await page.getByRole("button", { name: "Pause session", exact: true }).click();
      await expect(page.getByText("Practice paused", { exact: true })).toBeVisible();
      await page.goto(`/practice?planId=${id}`, { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Resume Range Mode", exact: true }).click();
      await expect(range).toHaveAttribute("data-practice-plan-id", id!);
      await expect(page.locator("[data-current-range-block]")).toHaveText(block, {
        useInnerText: true,
      });
    } finally {
      await fixture.cleanup();
    }
  });
});
