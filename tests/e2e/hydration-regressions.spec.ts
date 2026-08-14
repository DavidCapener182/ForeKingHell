import { expect, test, type ConsoleMessage, type Page } from "@playwright/test";

import { authStorageState, expectPageReady, hasAuthenticatedE2e, skipWhenNoAuth } from "./helpers";

test.describe("hydration regressions", () => {
  test.skip(!hasAuthenticatedE2e, "Set PLAYWRIGHT_AUTH_STATE to run hydration checks.");
  test.use(authStorageState ? { storageState: authStorageState } : {});

  test("Bag confidence controls hydrate without replacing server markup", async ({ page }) => {
    skipWhenNoAuth();
    const errors = captureHydrationErrors(page);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/surface/workbench?next=${encodeURIComponent("/bag")}`, {
      waitUntil: "commit",
    });
    await expectPageReady(page, /Bag confidence ladder/i);
    const findingsTrigger = page.getByRole("button", { name: "Review all gap findings" });
    await expect(findingsTrigger).toBeVisible();
    await findingsTrigger.click();
    await expect(findingsTrigger).toHaveAttribute("data-state", "open");

    expect(errors).toEqual([]);
  });

  test("Play companion actions hydrate without replacing server markup", async ({ page }) => {
    skipWhenNoAuth();
    const errors = captureHydrationErrors(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/surface/companion?next=${encodeURIComponent("/play")}`, {
      waitUntil: "commit",
    });
    const actionsTrigger = page.getByRole("button", { name: "More play actions" });
    await expect(actionsTrigger).toBeVisible();
    await actionsTrigger.click();
    await expect(page.getByText("Play actions", { exact: true })).toBeVisible();

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
      ["/today", /Latest Practice Review|Today/i],
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
