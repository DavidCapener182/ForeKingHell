import { expect, test, type Page } from "@playwright/test";
import { prepareFlightPathFixture } from "./flight-path-fixture";
const fixtureCleanup = new WeakMap<Page, () => Promise<void>>();
test.beforeEach(async ({ page }, info) => {
  fixtureCleanup.set(
    page,
    await prepareFlightPathFixture(page, String(info.project.use.baseURL), true),
  );
});
test.afterEach(async ({ page }) => {
  await fixtureCleanup.get(page)?.();
});

import { expectPageReady, hasAuthenticatedE2e, skipWhenNoAuth } from "./helpers";

test.describe("Today exact-shot chart inspection", () => {
  test.skip(!hasAuthenticatedE2e, "Enable an authenticated local state for Today chart checks.");

  test("selects a chart shot and exposes guarded review controls without mutating it", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    skipWhenNoAuth();
    let mutationPosts = 0;

    await page.route("**/today**", async (route) => {
      if (route.request().method() === "POST") {
        mutationPosts += 1;
        await route.abort();
        return;
      }
      await route.continue();
    });

    await page.goto("/surface/workbench?next=%2Ftoday%3Ftab%3Devidence", {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    if (/\/login(?:\?|$)/.test(page.url())) {
      test.skip(true, "The configured authenticated browser state has expired.");
    }
    await expectPageReady(page, /Today|Home/i);
    await expect(page.getByRole("tab", { name: "Shot evidence", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await page
      .getByRole("navigation", { name: "Practice views" })
      .getByRole("link", { name: "Dispersion & ball flight" })
      .click();

    // SVG paint order puts later markers above coincident shots in this fixture.
    const point = page.locator("[data-today-shot-point]").last();
    // The owned measured-shot fixture is populated; the charts load in a client chunk.
    await expect(point).toBeVisible();

    await expect(page.locator("[data-today-quick-delete]")).toHaveCount(0);
    const shotId = await point.getAttribute("data-today-shot-point");
    expect(shotId).toBeTruthy();
    await point.click();

    const detail = page.locator(`[data-today-selected-shot="${shotId}"]`);
    await expect(detail).toBeVisible();
    await expect(detail.getByRole("region", { name: "Selected shot detail" })).toBeVisible();
    await expect(
      detail.getByRole("button", { name: /Exclude from stats|Keep in stats|Restore to stats/ }),
    ).toBeVisible();

    const quickDelete = page.locator(`[data-today-quick-delete="${shotId}"]`);
    if ((await detail.locator("[data-course-shot-delete-restricted]").count()) > 0) {
      await expect(page.locator("[data-today-quick-delete]")).toHaveCount(0);
      await expect(detail.locator("[data-course-shot-delete-restricted]")).toContainText(
        "score stays correct",
      );
    } else {
      await expect(page.getByRole("button", { name: "Delete shot permanently" })).toHaveCount(1);
      const permanentDelete = quickDelete.getByRole("button", { name: "Delete shot permanently" });
      // Assert before clicking, since Playwright can otherwise scroll a hidden in-flow control into view.
      await expect(permanentDelete).toBeInViewport({ ratio: 1 });
      await permanentDelete.click();
      await expect(
        page.getByRole("heading", { name: "Permanently delete this shot?" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Keep shot" }).click();
      await expect(permanentDelete).toBeInViewport({ ratio: 1 });
    }

    await detail.getByRole("tab", { name: "Source" }).click();
    await expect(detail.getByText("Source record", { exact: true })).toBeVisible();
    await detail.getByRole("tab", { name: "History" }).click();
    await expect(detail.getByText("Current review", { exact: true })).toBeVisible();

    await detail.getByRole("button", { name: "Close selected shot details" }).click();
    await expect(detail).toBeHidden();
    await expect(page.locator("[data-today-quick-delete]")).toHaveCount(0);

    await point.focus();
    await point.press("Enter");
    await expect(page.locator(`[data-today-selected-shot="${shotId}"]`)).toBeVisible();
    expect(mutationPosts).toBe(0);
  });
});
