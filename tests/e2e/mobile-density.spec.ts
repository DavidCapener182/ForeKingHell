import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

import { authStorageState, expectPageReady, hasAuthenticatedE2e, skipWhenNoAuth } from "./helpers";

const phoneViewports = [
  { name: "320x568", width: 320, height: 568 },
  { name: "375x667", width: 375, height: 667 },
  { name: "390x844", width: 390, height: 844 },
  { name: "430x932", width: 430, height: 932 },
  { name: "iphone-landscape", width: 844, height: 390 },
] as const;

const workbenchViewports = [
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1024", width: 1024, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
] as const;

test.describe("companion and workbench density contract", () => {
  test.skip(!hasAuthenticatedE2e, "Set PLAYWRIGHT_AUTH_STATE to run density checks.");
  test.use(authStorageState ? { storageState: authStorageState } : {});
  test.setTimeout(360_000);

  test("keeps the five-task companion usable at every required phone viewport", async ({
    browserName,
    page,
  }, testInfo) => {
    test.skip(
      browserName !== "chromium" || testInfo.project.name !== "chromium",
      "The explicit viewport matrix runs once in Chromium.",
    );
    skipWhenNoAuth();
    const outputDirectory = path.join(process.cwd(), "output", "playwright");
    mkdirSync(outputDirectory, { recursive: true });

    for (const viewport of phoneViewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openSurface(page, "companion", "/today", /Today/i);

      const mobileNav = page.getByRole("navigation", { name: "Mobile primary" });
      await expect(mobileNav).toBeVisible();
      await expect(mobileNav.getByRole("link", { name: "Today" })).toBeVisible();
      await expect(mobileNav.getByRole("link", { name: "Practice" })).toBeVisible();
      await expect(mobileNav.getByRole("link", { name: "Play" })).toBeVisible();
      await expect(mobileNav.getByRole("link", { name: "Sessions" })).toBeVisible();
      await expect(mobileNav.getByRole("button", { name: "Open more navigation" })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeHidden();
      await expectNoHorizontalOverflow(page);
      if (viewport.height > viewport.width) {
        const primaryAction = page.locator("[data-primary-recommendation] a").first();
        await expect(primaryAction).toBeVisible();
        const actionBottom = await primaryAction.evaluate(
          (element) => element.getBoundingClientRect().bottom,
        );
        const tabTop = await mobileNav.evaluate((element) => element.getBoundingClientRect().top);
        expect(actionBottom).toBeLessThanOrEqual(tabTop);
      }

      await page.screenshot({
        path: path.join(outputDirectory, `companion-today-${viewport.name}.png`),
        fullPage: true,
      });
    }

    await page.setViewportSize({ width: 390, height: 844 });
    const routes = [
      {
        name: "practice",
        route: "/practice",
        ready: /Recommended session|Active Range Mode/i,
        answer: "[data-current-practice-plan], [data-active-range-mode]",
      },
      {
        name: "play",
        route: "/play",
        ready: /Play/i,
        answer: "[data-active-round], [data-selected-course]",
      },
      {
        name: "sessions",
        route: "/sessions",
        ready: /Your golf history/i,
        answer: '[role="radiogroup"][aria-label="Session type"]',
      },
    ];
    for (const route of routes) {
      await openSurface(page, "companion", route.route, route.ready);
      const answer = page.locator(route.answer).first();
      await expect(answer).toBeVisible();
      const answerTop = await answer.evaluate((element) => element.getBoundingClientRect().top);
      const tabTop = await page
        .getByRole("navigation", { name: "Mobile primary" })
        .evaluate((element) => element.getBoundingClientRect().top);
      expect(answerTop).toBeLessThan(tabTop);
      await expect(page.locator("[data-companion-image-hero]")).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: path.join(outputDirectory, `companion-${route.name}-390x844.png`),
        fullPage: true,
      });
    }
  });

  test("keeps tablets and desktop on the full workbench", async ({
    browserName,
    page,
  }, testInfo) => {
    test.skip(
      browserName !== "chromium" || testInfo.project.name !== "chromium",
      "The explicit viewport matrix runs once in Chromium.",
    );
    skipWhenNoAuth();

    for (const viewport of workbenchViewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openSurface(page, "workbench", "/today", /Session verdict|Latest practice/i);

      await expect(page.locator('[data-app-surface="workbench"]')).toBeVisible();
      if (viewport.width >= 1024) {
        await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
      }
      await expect(page.getByRole("navigation", { name: "Mobile primary" })).toBeHidden();
      await expect(page.locator("[data-desktop-workbench-hydrated]")).toHaveAttribute(
        "data-desktop-workbench-hydrated",
        "true",
      );
      await expectNoHorizontalOverflow(page);
    }
  });
});

async function openSurface(
  page: Page,
  surface: "companion" | "workbench",
  destination: string,
  ready: RegExp,
) {
  await page.goto(`/surface/${surface}?next=${encodeURIComponent(destination)}`, {
    waitUntil: "commit",
  });
  await expectPageReady(page, ready);
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    )
    .toBeLessThanOrEqual(1);
}
