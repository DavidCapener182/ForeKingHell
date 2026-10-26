import { expect, test, type ConsoleMessage, type Page } from "@playwright/test";

import { prepareFlightPathFixture } from "./flight-path-fixture";
import { authStorageState, expectPageReady, hasAuthenticatedE2e, skipWhenNoAuth } from "./helpers";

test.describe("hydration regressions", () => {
  test.skip(!hasAuthenticatedE2e, "Set PLAYWRIGHT_AUTH_STATE to run hydration checks.");
  test.use(authStorageState ? { storageState: authStorageState } : {});

  test("Performance Lab confidence timeline hydrates its SVG descriptions", async ({
    page,
  }, info) => {
    const cleanup = await prepareFlightPathFixture(page, String(info.project.use.baseURL), true);
    try {
      const errors = captureHydrationErrors(page);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/surface/workbench?next=%2Fsimulator-lab");
      await expectPageReady(page, /Performance Lab/i);
      await expect(page.locator('[data-url-tabs][data-ready="true"]')).toBeVisible();
      await expect(
        page
          .locator("svg title")
          .filter({ hasText: /shots used across/ })
          .first(),
      ).toBeAttached();
      await page.getByRole("tab", { name: "Gapping", exact: true }).click();
      await expect(page.getByRole("tab", { name: "Gapping", exact: true })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(errors).toEqual([]);
    } finally {
      await cleanup();
    }
  });

  test("Bag confidence controls hydrate without replacing server markup", async ({
    page,
  }, info) => {
    skipWhenNoAuth();
    const cleanup = await prepareFlightPathFixture(page, String(info.project.use.baseURL), true);
    try {
      const errors = captureHydrationErrors(page);

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`/surface/workbench?next=${encodeURIComponent("/bag")}`, {
        waitUntil: "commit",
      });
      await expectPageReady(page, /Distance ladder/i);
      const findingsTrigger = page.getByRole("button", { name: /Review all gap findings/ });
      await expect(findingsTrigger).toBeVisible();
      await findingsTrigger.click();
      await expect(findingsTrigger).toHaveAttribute("data-state", "open");

      expect(errors).toEqual([]);
    } finally {
      await cleanup();
    }
  });

  test("Play companion actions hydrate without replacing server markup", async ({ page }) => {
    skipWhenNoAuth();
    const errors = captureHydrationErrors(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/surface/companion?next=${encodeURIComponent("/play")}`, {
      waitUntil: "commit",
    });
    const actionsTrigger = page.getByRole("button", { name: "Change course or tee" });
    await expect(actionsTrigger).toBeVisible();
    await actionsTrigger.click();
    await expect(page.getByRole("dialog", { name: "Course and tee" })).toBeVisible();

    expect(errors).toEqual([]);
  });

  test("server-authored workbench disclosures and menus preserve their rendered triggers", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    skipWhenNoAuth();
    const errors = captureHydrationErrors(page);
    const routes = [
      ["/import", /Import|Upload CSV/i],
      ["/handicap", /Handicap/i],
      ["/courses", /Courses/i],
      ["/today", /Latest Practice Review|Today|Home/i],
      ["/coach", /Coach/i],
      ["/feed", /Feed/i],
      ["/progress", /Progress/i],
    ] as const;

    await page.setViewportSize({ width: 1440, height: 900 });
    for (const [path, expectedText] of routes) {
      await page.goto(`/surface/workbench?next=${encodeURIComponent(path)}`, {
        waitUntil: "commit",
      });
      await expectPageReady(page, expectedText);
      await page.waitForTimeout(100);
    }

    expect(errors).toEqual([]);
  });
});

function captureHydrationErrors(page: Page) {
  const errors: string[] = [];

  page.on("console", (message: ConsoleMessage) => {
    if (message.type() === "error" && isHydrationError(message.text())) {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    if (isHydrationError(error.message)) {
      errors.push(error.message);
    }
  });

  return errors;
}

function isHydrationError(message: string) {
  return /hydration failed|hydration error|server rendered html didn't match|a tree hydrated/i.test(
    message,
  );
}
