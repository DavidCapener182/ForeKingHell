import { expect, test } from "@playwright/test";

import { authStorageState, expectPageReady, hasAuthenticatedE2e, skipWhenNoAuth } from "./helpers";

test.describe("accessible mobile interactions", () => {
  test.skip(!hasAuthenticatedE2e, "Set PLAYWRIGHT_AUTH_STATE to run mobile interaction checks.");
  test.use(authStorageState ? { storageState: authStorageState } : {});

  test.beforeEach(async ({ page }) => {
    skipWhenNoAuth();
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test("primary tabs expose current state, 44px targets and a visible keyboard focus ring", async ({
    page,
  }) => {
    await openCompanionRoute(page, "/today", /Today/i);

    const navigation = page.getByRole("navigation", { name: "Mobile primary" });
    const destinations = navigation.locator(".ios-tab-item");
    await expect(destinations).toHaveCount(5);
    await expect(navigation.getByRole("link", { name: "Today" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    const firstDestination = destinations.first();
    await firstDestination.focus();
    await expect(firstDestination).toBeFocused();
    const focusEvidence = await firstDestination.evaluate((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        activeClass: element.className,
        focusVisible: element.matches(":focus-visible"),
        height: rect.height,
        width: rect.width,
        outlineWidth: Number.parseFloat(style.outlineWidth),
        outlineStyle: style.outlineStyle,
      };
    });

    expect(focusEvidence).toMatchObject({
      focusVisible: true,
      outlineStyle: "solid",
      outlineWidth: 3,
    });
    expect(focusEvidence.activeClass).toContain("ios-tab-item");
    expect(focusEvidence.height).toBeGreaterThanOrEqual(44);
    expect(focusEvidence.width).toBeGreaterThanOrEqual(44);
  });

  test("reduced motion removes navigation and segmented-control transitions", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openCompanionRoute(page, "/sessions", /Recent sessions/i);

    const transitionDurations = await page.evaluate(() => {
      const elements = [
        document.querySelector(".ios-tab-item"),
        document.querySelector('[role="group"] button'),
      ].filter(Boolean) as HTMLElement[];
      return elements.map((element) => getComputedStyle(element).transitionDuration);
    });

    expect(transitionDurations.every((duration) => Number.parseFloat(duration) <= 0.001)).toBe(
      true,
    );
  });

  test("flight paths expose a labelled visual and plain-language non-chart summary", async ({
    page,
  }) => {
    await page.goto(`/surface/workbench?next=${encodeURIComponent("/analyse/session-impact")}`);
    await expectPageReady(page, /Session impact/i);

    const chart = page.getByRole("img", { name: /Top-down summary of .* shot paths/i });
    await expect(chart).toBeVisible();
    await expect(chart).toHaveAttribute("aria-describedby", "flight-path-summary");
    await expect(page.locator("[data-flight-path-summary]")).toContainText(/included paths/i);
    await expect(page.locator("[data-flight-path-summary]")).toContainText(
      /left|right|centred on the target line/i,
    );
  });
});

async function openCompanionRoute(
  page: import("@playwright/test").Page,
  destination: string,
  ready: RegExp,
) {
  await page.goto(`/surface/companion?next=${encodeURIComponent(destination)}`);
  await expectPageReady(page, ready);
}
