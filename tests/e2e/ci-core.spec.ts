import { expect, test } from "@playwright/test";

import { hasLocalAuthBypass } from "./helpers";

test.describe("clean-database companion smoke", () => {
  test.use({ actionTimeout: 15_000 });
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
    await expect(primaryNavigation.getByRole("link")).toHaveText([
      "Today",
      "Practice",
      "Play",
      "Progress",
      "Bag",
    ]);

    for (const destination of [
      { navigationLabel: "Practice", routeLabel: "Practice", path: /\/practice(?:\?|$)/ },
      { navigationLabel: "Play", routeLabel: "Play", path: /\/play(?:\?|$)/ },
      { navigationLabel: "Progress", routeLabel: "Progress", path: /\/progress(?:\?|$)/ },
      { navigationLabel: "Bag", routeLabel: "Bag", path: /\/bag(?:\?|$)/ },
    ]) {
      await primaryNavigation
        .getByRole("link", { name: destination.navigationLabel, exact: true })
        .click();
      await expectCompanionRoute(page, destination.routeLabel, destination.path);
    }

    await expect(
      page
        .getByText("No clubs imported yet", { exact: true })
        .or(page.getByRole("tablist", { name: "Bag views" })),
    ).toBeVisible();

    await page.getByRole("button", { name: /Open profile and navigation/ }).click();
    await page
      .getByRole("dialog")
      .getByRole("link", { name: "Import & Sync", exact: true })
      .click();
    await expectCompanionRoute(page, "Import data", /\/import(?:\?|$)/);
  });
});

async function expectCompanionRoute(
  page: import("@playwright/test").Page,
  routeLabel: string,
  path: RegExp,
) {
  // The CI dev server compiles each destination on its first visit.
  await expect(page).toHaveURL(path, { timeout: 60_000 });
  await expect(page.locator("[data-mobile-route-label]:visible").first()).toHaveText(routeLabel, {
    timeout: 60_000,
  });
  await expect(page.locator("main#main-content:visible").first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/Internal Server Error|Application error/i);
}
