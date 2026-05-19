import { test } from "@playwright/test";

import { authStorageState, expectNoCriticalAxeViolations, skipWhenNoAuth } from "./helpers";

test.describe("accessibility smoke checks", () => {
  test("login has no critical or serious axe violations", async ({ page }) => {
    await page.goto("/login");
    await expectNoCriticalAxeViolations(page);
  });

  test("privacy notice has no critical or serious axe violations", async ({ page }) => {
    await page.goto("/privacy");
    await expectNoCriticalAxeViolations(page);
  });
});

test.describe("authenticated accessibility smoke checks", () => {
  test.use(authStorageState ? { storageState: authStorageState } : {});

  for (const route of [
    "/dashboard",
    "/import",
    "/shots",
    "/bag",
    "/rounds",
    "/handicap",
    "/coach",
    "/achievements",
  ]) {
    test(`${route} has no critical or serious axe violations`, async ({ page }) => {
      skipWhenNoAuth();

      await page.goto(route);
      await expectNoCriticalAxeViolations(page);
    });
  }
});
