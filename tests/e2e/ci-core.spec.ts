import { expect, test } from "@playwright/test";

import { hasLocalAuthBypass } from "./helpers";

test.describe("clean-database companion smoke", () => {
  test.skip(!hasLocalAuthBypass, "Enable the local Playwright auth bypass for the CI smoke.");
  test.setTimeout(240_000);

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test("navigates the core companion on a clean database", async ({ page }) => {
    await page.goto("/surface/companion?next=%2Ftoday", { waitUntil: "commit" });
    await expectCompanionRoute(page, "Today", /\/today(?:\?|$)/);

    const primaryNavigation = page.getByRole("navigation", { name: "Mobile primary" });
    await expect(primaryNavigation).toBeVisible();

    for (const destination of [
      { navigationLabel: "Practice", routeLabel: "Practice Planner", path: /\/practice(?:\?|$)/ },
      { navigationLabel: "Play", routeLabel: "Play", path: /\/play(?:\?|$)/ },
      { navigationLabel: "Sessions", routeLabel: "Sessions", path: /\/sessions(?:\?|$)/ },
    ]) {
      await primaryNavigation
        .getByRole("link", { name: destination.navigationLabel, exact: true })
        .click();
      await expectCompanionRoute(page, destination.routeLabel, destination.path);
    }

    await page.goto("/bag", { waitUntil: "commit" });
    await expectCompanionRoute(page, "Bag map", /\/bag(?:\?|$)/);
    await expect(
      page
        .getByText("No clubs imported yet", { exact: true })
        .or(page.getByRole("tablist", { name: "Bag views" })),
    ).toBeVisible();

    await page.getByRole("link", { name: "Import launch-monitor data" }).click();
    await expectCompanionRoute(page, "Import data", /\/import(?:\?|$)/);
  });
});

async function expectCompanionRoute(
  page: import("@playwright/test").Page,
  routeLabel: string,
  path: RegExp,
) {
  await expect(page).toHaveURL(path);
  await expect(page.locator("[data-mobile-route-label]:visible").first()).toHaveText(routeLabel, {
    timeout: 60_000,
  });
  await expect(page.locator("main#main-content:visible").first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/Internal Server Error|Application error/i);
}
