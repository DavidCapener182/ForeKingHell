import { expect, test, type Locator, type Page } from "@playwright/test";

import { authStorageState, expectPageReady, skipWhenNoAuth } from "./helpers";

const mobileRoutes = [
  { path: "/dashboard", ready: /AI caddie|Start today's practice|Dashboard/i },
  { path: "/today", ready: /Latest session|Today/i },
  { path: "/analyse", ready: /Evidence hub|Analyse/i },
  { path: "/bag", ready: /Bag health|Bag confidence ladder|Bag score trend/i },
  { path: "/practice", ready: /Active session mode|Practice/i },
] as const;

test.describe("site-wide Apple mobile presentation", () => {
  test.use(authStorageState ? { storageState: authStorageState } : {});
  test.setTimeout(180_000);

  test("keeps the public homepage and signed-out login native, neutral and touch friendly", async ({
    browserName,
    context,
    page,
  }, testInfo) => {
    runOnceInBaseChromium(browserName, testInfo.project.name);
    await context.clearCookies();
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/", { waitUntil: "commit" });
    await expect(page.getByRole("heading", { name: /Turn every measured shot/i })).toBeVisible();
    await expectAppleFont(page.locator("main#product"));
    await expectAppleFont(page.locator("h1:visible").first());
    await expectNeutralSurface(page.locator("main#product"), "public homepage canvas");
    await expectNoHorizontalOverflow(page);

    const publicMenu = page.getByRole("button", { name: "Open navigation" });
    await expect(publicMenu).toBeVisible();
    await expectMinimumTouchTarget(publicMenu, "public menu button");

    await page.goto("/login", { waitUntil: "commit" });
    await expect(page.getByRole("heading", { name: "Sign in or join" })).toBeVisible();
    const loginShell = page.locator("main#main-content");
    await expectAppleFont(loginShell);
    await expectAppleFont(page.locator("h1:visible").first());
    await expectNeutralSurface(loginShell, "login canvas");
    await expectNoHorizontalOverflow(page);

    for (const control of [
      page.getByRole("button", { name: /sign in with password/i }),
      page.getByRole("button", { name: /continue with google/i }),
      page.getByRole("button", { name: /continue with apple/i }),
      page.getByRole("button", { name: /email me a secure link/i }),
    ]) {
      await expectMinimumTouchTarget(control, await control.innerText());
    }
  });

  test("uses the neutral Apple shell across representative authenticated mobile routes", async ({
    browserName,
    page,
  }, testInfo) => {
    runOnceInBaseChromium(browserName, testInfo.project.name);
    skipWhenNoAuth();
    await page.setViewportSize({ width: 390, height: 844 });

    for (const route of mobileRoutes) {
      await gotoAuthenticatedRoute(page, route.path, route.ready);

      const appFrame = page.locator("div[data-mobile-platform='apple']").first();
      const mobileNav = page.getByRole("navigation", { name: "Mobile primary" });
      const mobileAppBar = page.getByRole("banner", { name: "Mobile app bar" });

      await expect(appFrame).toBeVisible();
      await expectAppleFont(page.locator("body"));
      await expectAppleFont(
        page
          .locator(
            "main [data-mobile-route-label]:visible, main h1:visible, main h2:visible, main h3:visible",
          )
          .first(),
      );
      await expectNeutralSurface(page.locator("body"), `${route.path} body`);
      await expectNeutralSurface(appFrame, `${route.path} app frame`);
      await expectNeutralSurface(mobileAppBar, `${route.path} app bar`);
      await expectNeutralSurface(mobileNav.locator(".ios-tab-bar"), `${route.path} tab bar`);
      await expect(mobileNav).toBeVisible();
      await expect(mobileNav.locator(".ios-tab-item")).toHaveCount(5);
      await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeHidden();
      await expectNoHorizontalOverflow(page);
    }

    const mobileNav = page.getByRole("navigation", { name: "Mobile primary" });
    for (const [index, control] of (await mobileNav.locator(".ios-tab-item").all()).entries()) {
      await expectMinimumTouchTarget(control, `primary tab ${index + 1}`);
    }
    await expectMinimumTouchTarget(
      page.getByRole("button", { name: "Open navigation" }),
      "authenticated menu button",
    );
    await expectMinimumTouchTarget(
      page.getByRole("link", { name: "Import launch-monitor data" }),
      "authenticated import button",
    );
  });

  test("retains the same Apple shell when a phone rotates to landscape", async ({
    browserName,
    page,
  }, testInfo) => {
    runOnceInBaseChromium(browserName, testInfo.project.name);
    skipWhenNoAuth();
    await page.setViewportSize({ width: 844, height: 390 });
    await gotoAuthenticatedRoute(page, "/today", /Latest session|Today/i);

    const appFrame = page.locator("div[data-mobile-platform='apple']").first();
    const mobileNav = page.getByRole("navigation", { name: "Mobile primary" });

    await expectAppleFont(page.locator("body"));
    await expectNeutralSurface(appFrame, "landscape app frame");
    await expectNeutralSurface(mobileNav.locator(".ios-tab-bar"), "landscape tab bar");
    await expect(mobileNav).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeHidden();
    await expectNoHorizontalOverflow(page);
  });

  test("follows the OS appearance on mobile and ignores the saved product theme", async ({
    browserName,
    page,
  }, testInfo) => {
    runOnceInBaseChromium(browserName, testInfo.project.name);
    skipWhenNoAuth();
    await page.setViewportSize({ width: 390, height: 844 });

    for (const appearance of [
      {
        scheme: "light" as const,
        theme: "light",
        canvas: "rgb(242, 242, 247)",
        group: "rgb(255, 255, 255)",
      },
      {
        scheme: "dark" as const,
        theme: "dark",
        canvas: "rgb(0, 0, 0)",
        group: "rgb(28, 28, 30)",
      },
    ]) {
      await page.emulateMedia({ colorScheme: appearance.scheme });
      await gotoAuthenticatedRoute(
        page,
        "/dashboard",
        /AI caddie|Start today's practice|Dashboard/i,
      );

      await expect(page.locator("html")).toHaveAttribute("data-theme", appearance.theme);
      await expect(page.locator("html")).toHaveAttribute("data-theme-preference", /.+/);
      await expectExactSurface(page.locator("body"), appearance.canvas, `${appearance.theme} body`);
      await expectExactSurface(
        page.locator("[data-mobile-platform='apple']").first(),
        appearance.canvas,
        `${appearance.theme} app frame`,
      );
      await expectExactSurface(
        page.locator("[data-mobile-surface='grouped']").first(),
        appearance.group,
        `${appearance.theme} grouped surface`,
      );
      await expect(page.getByRole("banner", { name: "Mobile app bar" })).toContainText("Dashboard");
      await expect(page.getByText("Home", { exact: true }).filter({ visible: true })).toHaveCount(
        0,
      );
      await expectNoHorizontalOverflow(page);
    }
  });

  test("restores the existing desktop workbench at 1024px and above", async ({
    browserName,
    page,
  }, testInfo) => {
    runOnceInBaseChromium(browserName, testInfo.project.name);
    skipWhenNoAuth();

    for (const viewport of [
      { width: 1024, height: 768 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await gotoAuthenticatedRoute(page, "/today", /Latest session|Today/i);

      await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Mobile primary" })).toBeHidden();
      await expect(page.locator(".ios-mobile-screen")).toBeHidden();
      await expectNoHorizontalOverflow(page);

      const desktopFont = await page
        .locator("body")
        .evaluate((element) => getComputedStyle(element).fontFamily);
      expect(desktopFont).not.toContain("-apple-system");
      expect(desktopFont).not.toContain("SF Pro Text");
    }
  });
});

function runOnceInBaseChromium(browserName: string, projectName: string) {
  test.skip(
    browserName !== "chromium" || projectName !== "chromium",
    "The explicit site-wide viewport matrix runs once in the base Chromium project.",
  );
}

async function gotoAuthenticatedRoute(page: Page, path: string, expectedText: RegExp | string) {
  await page.goto(path, { waitUntil: "commit" });
  await page.waitForLoadState("networkidle", { timeout: 2_000 }).catch(() => {});
  test.skip(/\/login(?:\?|$)/.test(page.url()), "Stored auth state redirected to login.");
  await expectPageReady(page, expectedText);
}

async function expectAppleFont(locator: Locator) {
  await expect(locator).toBeVisible();
  const fontFamily = await locator.evaluate((element) => getComputedStyle(element).fontFamily);
  expect(fontFamily).toContain("-apple-system");
  expect(fontFamily).toContain("SF Pro");
}

async function expectNeutralSurface(locator: Locator, label: string) {
  await expect(locator, `${label} should be visible`).toBeVisible();
  const surface = await locator.evaluate((element) => {
    const colour = getComputedStyle(element).backgroundColor;
    const channels =
      colour
        .match(/[\d.]+/g)
        ?.slice(0, 3)
        .map(Number) ?? [];
    return {
      colour,
      channelCount: channels.length,
      spread: channels.length === 3 ? Math.max(...channels) - Math.min(...channels) : 255,
    };
  });

  expect(surface.channelCount, `${label} should resolve to an RGB surface: ${surface.colour}`).toBe(
    3,
  );
  expect(
    surface.spread,
    `${label} should be white, grey or black: ${surface.colour}`,
  ).toBeLessThanOrEqual(12);
}

async function expectExactSurface(locator: Locator, expected: string, label: string) {
  await expect(locator, `${label} should be visible`).toBeVisible();
  const colour = await locator.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(colour, label).toBe(expected);
}

async function expectNoHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));

  expect(widths.document).toBeLessThanOrEqual(widths.viewport + 2);
  expect(widths.body).toBeLessThanOrEqual(widths.viewport + 2);
}

async function expectMinimumTouchTarget(locator: Locator, label: string) {
  await expect(locator, `${label} should be visible`).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${label} should have a measurable touch target`).not.toBeNull();
  expect(box?.width ?? 0, `${label} width`).toBeGreaterThanOrEqual(44);
  expect(box?.height ?? 0, `${label} height`).toBeGreaterThanOrEqual(44);
}
