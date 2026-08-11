import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

import { authStorageState, expectPageReady, skipWhenNoAuth } from "./helpers";

test.describe("phone companion journeys", () => {
  test.use(authStorageState ? { storageState: authStorageState } : {});
  test.describe.configure({ mode: "serial" });
  test.setTimeout(360_000);

  test.beforeEach(async ({ browserName, page }, testInfo) => {
    test.skip(
      browserName !== "chromium" || testInfo.project.name !== "chromium",
      "The companion journey suite runs once in Chromium.",
    );
    skipWhenNoAuth();
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test("1-6: recommends, builds, runs, finishes and reviews measured practice", async ({
    page,
  }) => {
    await openCompanion(page, "/today", /Today's recommendation/i);
    await expect(page.getByRole("heading", { name: /Practise .+ control/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Plan range session" })).toBeVisible();

    await page.getByRole("link", { name: "Plan range session" }).click();
    await expectPageReady(page, /Recommended session/i);
    await expect(page.getByRole("button", { name: /Quick adjustments/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await page.getByRole("button", { name: "30 min", exact: true }).click();
    await expect(page.locator("[data-current-practice-plan]")).toContainText("30 min");
    await expect(
      page.getByRole("toolbar", { name: "Practice blocks" }).getByRole("button"),
    ).toHaveCount(3);
    await page.getByRole("button", { name: "Latest weakness", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Latest weakness", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Save & Start Practice" }).click();
    await expect(page.locator("[data-active-range-mode]")).toBeVisible();
    await expect(page.getByText(/Range Mode · Block 1 of 3/i)).toBeVisible();
    await expect(page.getByText(/activity only/i)).toBeVisible();

    await page.getByRole("button", { name: "Complete block" }).click();
    await expect(page.getByText(/Range Mode · Block 2 of 3/i)).toBeVisible();
    await page.getByRole("button", { name: "Next block" }).click();
    await expect(page.getByText(/Range Mode · Block 3 of 3/i)).toBeVisible();
    await page.getByRole("button", { name: "Previous block" }).click();
    await expect(page.getByText(/Range Mode · Block 2 of 3/i)).toBeVisible();

    await page.getByRole("button", { name: "Finish without upload" }).click();
    await expect(page.locator("[data-practice-finished]")).toContainText("Practice complete");
    await expect(page.locator("[data-practice-finished]")).toContainText(
      "No block has been marked as measured success",
    );
    await page
      .locator("[data-practice-finished]")
      .getByRole("link", { name: "Upload CSV" })
      .click();
    await expect(page).toHaveURL(/\/import(?:\?|$)/);
    await expectPageReady(page, /Import|Upload CSV|Rapsodo/i);

    await page.goto("/sessions", { waitUntil: "commit" });
    await expectPageReady(page, /Recent sessions/i);
    await page.getByRole("button", { name: "Practice", exact: true }).click();
    const measuredReview = page.locator('a[href^="/sessions/"]').first();
    await expect(measuredReview).toContainText(/measured|Practice usefulness/i);
    await measuredReview.click();
    await expectPageReady(page, /Practice review/i);
    await expect(page.getByRole("heading", { name: "Four important numbers" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Dispersion" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Flight trajectory" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Build next plan" })).toBeVisible();
  });

  test("7-10: prepares a course, changes holes, opens Strategy and checks Quick Bag", async ({
    page,
  }) => {
    await openCompanion(page, "/play", /Selected course/i);
    await expect(page.getByRole("link", { name: "Change course" })).toBeVisible();
    await page.getByRole("link", { name: "Course Strategy" }).click();
    await expectPageReady(page, /Overall game plan/i);
    await expect(page.getByText("Hole 1", { exact: true })).toBeVisible();
    await expect(page.getByText("Recommended club", { exact: true })).toBeVisible();

    const nextHole = page.getByRole("button", { name: "Next hole" });
    await expect(nextHole).toBeEnabled();
    await nextHole.click();
    await expect(page.getByText("Hole 2", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Download for Round" }).click();
    await expect(page.getByRole("button", { name: "Available for this round" })).toBeVisible();

    await page.getByRole("link", { name: /View this hole in Course Twin/i }).click();
    await expectPageReady(page, /Course Twin/i);
    const modeGroup = page.getByRole("group", { name: "Course Twin mode" });
    await expect(modeGroup.getByRole("button", { name: "Strategy" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("navigation", { name: "Mobile primary" })).toHaveCount(0);
    await expect(page.getByText(/Hole 2 ·/i)).toBeVisible();

    await page.goto("/quick-bag", { waitUntil: "commit" });
    await expectPageReady(page, /Which number can you trust/i);
    await expect(page.getByRole("searchbox", { name: "Search by club" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Target distance" })).toBeVisible();
    await page.getByRole("searchbox", { name: "Search by club" }).fill("Driver");
    await expect(page.getByLabel("Quick Bag trusted numbers")).toContainText("Driver");
    await page.getByRole("searchbox", { name: "Search by club" }).fill("");
    await page.getByRole("textbox", { name: "Target distance" }).fill("165");
    await expect(page.getByLabel("Quick Bag trusted numbers")).toContainText(/5i|6i/i);
  });

  test("11-12: hands desktop-only work off and persists Full Site", async ({ page }) => {
    await openCompanion(page, "/strokes-gained", /available on the full desktop site/i);
    await expect(page.getByText("Strokes Gained needs detailed shot-event tables.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Review latest round" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open Quick Bag" })).toBeVisible();

    await page.getByRole("link", { name: "Open Full Site" }).click();
    await expectPageReady(page, /Expected-strokes baseline|Scoring diagnosis/i);
    await expect(page.locator('[data-app-surface="workbench"]')).toBeVisible();
    await expect(page.locator("[data-desktop-workbench-hydrated]")).toHaveAttribute(
      "data-desktop-workbench-hydrated",
      "true",
    );
    await expect(page.getByRole("navigation", { name: "Mobile primary" })).toHaveCount(0);

    await page.reload({ waitUntil: "commit" });
    await expectPageReady(page, /Expected-strokes baseline|Scoring diagnosis/i);
    await expect(page.locator('[data-app-surface="workbench"]')).toBeVisible();
    await expect(page.locator("[data-desktop-workbench-hydrated]")).toHaveAttribute(
      "data-desktop-workbench-hydrated",
      "true",
    );
    await expect(page.getByText(/available on the full desktop site/i)).toHaveCount(0);

    const outputDirectory = path.join(process.cwd(), "output", "playwright");
    mkdirSync(outputDirectory, { recursive: true });
    await page.screenshot({
      path: path.join(outputDirectory, "full-site-persisted-on-phone.png"),
      fullPage: true,
    });
  });
});

async function openCompanion(page: Page, destination: string, ready: RegExp) {
  await page.goto(`/surface/companion?next=${encodeURIComponent(destination)}`, {
    waitUntil: "commit",
  });
  await expectPageReady(page, ready);
}
