import { test } from "@playwright/test";

import {
  authStorageState,
  expectNoCriticalAxeViolations,
  expectNoWcagAaAxeViolations,
  hasAuthenticatedE2e,
  skipWhenNoAuth,
} from "./helpers";

test.use({ bypassCSP: true });

test.describe("accessibility smoke checks", () => {
  test("login has no critical or serious axe violations", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/login");
    await expectNoCriticalAxeViolations(page);
  });

  test("privacy notice has no critical or serious axe violations", async ({ page }) => {
    await page.goto("/privacy");
    await expectNoCriticalAxeViolations(page);
  });
});

test.describe("central analysis loop WCAG A and AA checks", () => {
  test.skip(!hasAuthenticatedE2e, "Set PLAYWRIGHT_AUTH_STATE to run authenticated Axe checks.");
  test.use(authStorageState ? { storageState: authStorageState } : {});

  for (const route of ["/today", "/sessions", "/analyse", "/analyse/workspace", "/bag", "/coach"]) {
    test(`${route} has no automated WCAG A or AA violations`, async ({ page }) => {
      skipWhenNoAuth();

      await page.goto(route);
      await expectNoWcagAaAxeViolations(page);
    });
  }
});

test.describe("authenticated accessibility smoke checks", () => {
  test.skip(!hasAuthenticatedE2e, "Set PLAYWRIGHT_AUTH_STATE to run authenticated Axe checks.");
  test.use(authStorageState ? { storageState: authStorageState } : {});

  for (const route of [
    "/dashboard",
    "/today",
    "/sessions",
    "/analyse",
    "/analyse/session-impact",
    "/analyse/workspace",
    "/import",
    "/rapsodo",
    "/shots",
    "/bag",
    "/rounds",
    "/handicap",
    "/practice",
    "/coach",
    "/feed",
    "/challenges",
    "/leaderboard",
    "/achievements",
  ]) {
    test(`${route} has no critical or serious axe violations`, async ({ page }) => {
      skipWhenNoAuth();

      await page.goto(route);
      await expectNoCriticalAxeViolations(page);
    });
  }
});
