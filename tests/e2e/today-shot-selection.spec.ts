import { expect, test } from "@playwright/test";

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

    await page.goto("/today", { waitUntil: "domcontentloaded", timeout: 90_000 });
    if (/\/login(?:\?|$)/.test(page.url())) {
      test.skip(true, "The configured authenticated browser state has expired.");
    }
    await expectPageReady(page, /Shot patterns/i);

    const point = page.locator("[data-today-shot-point]").first();
    if ((await point.count()) === 0) {
      test.skip(true, "No chartable shot exists for the authenticated user's current Today view.");
    }

    const shotId = await point.getAttribute("data-today-shot-point");
    expect(shotId).toBeTruthy();
    await point.click();

    const detail = page.locator(`[data-today-selected-shot="${shotId}"]`);
    await expect(detail).toBeVisible();
    await expect(detail.getByRole("region", { name: "Selected shot detail" })).toBeVisible();
    await expect(
      detail.getByRole("button", { name: /Exclude from stats|Keep in stats|Restore to stats/ }),
    ).toBeVisible();

    await detail.getByRole("tab", { name: "Source" }).click();
    await expect(detail.getByText("Source record", { exact: true })).toBeVisible();
    await detail.getByRole("tab", { name: "History" }).click();
    await expect(detail.getByText("Current review", { exact: true })).toBeVisible();

    const permanentDelete = detail.getByRole("button", { name: "Delete shot permanently" }).first();
    if ((await permanentDelete.count()) > 0) {
      await permanentDelete.click();
      await expect(
        page.getByRole("heading", { name: "Permanently delete this shot?" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Keep shot" }).click();
    } else {
      await expect(detail.locator("[data-course-shot-delete-restricted]")).toContainText(
        "score stays correct",
      );
    }

    await detail.getByRole("button", { name: "Close selected shot details" }).click();
    await expect(detail).toBeHidden();

    await point.focus();
    await point.press("Enter");
    await expect(page.locator(`[data-today-selected-shot="${shotId}"]`)).toBeVisible();
    expect(mutationPosts).toBe(0);
  });
});
