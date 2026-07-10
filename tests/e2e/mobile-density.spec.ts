import { existsSync, readFileSync } from "node:fs";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { authStorageState, expectPageReady, skipWhenNoAuth } from "./helpers";

const routeGotoTimeoutMs = 120_000;

test.describe("mobile density screenshots", () => {
  test.use(authStorageState ? { storageState: authStorageState } : {});
  test.setTimeout(1_200_000);

  const mobileViewports = [
    { name: "mobile-320x568", width: 320, height: 568 },
    { name: "mobile-375x667", width: 375, height: 667 },
    { name: "mobile-390x844", width: 390, height: 844 },
    { name: "mobile-393x852", width: 393, height: 852 },
    { name: "mobile-430x932", width: 430, height: 932 },
  ];

  const desktopViewports = [
    { name: "desktop-1440x900", width: 1440, height: 900 },
    { name: "desktop-1728x1117", width: 1728, height: 1117 },
  ];

  const mobileRouteGroups = [
    {
      name: "dashboard-data",
      routes: [
        { name: "dashboard", path: "/dashboard", text: /Dashboard|Today/i },
        { name: "today", path: "/today", text: /Today/i },
        { name: "sessions", path: "/sessions", text: /Sessions/i },
        { name: "analyse", path: "/analyse", text: /Evidence hub|Analyse/i },
        {
          name: "session-impact",
          path: "/analyse/session-impact",
          text: /Session impact|Reversible analysis/i,
        },
        { name: "import", path: "/import", text: /Import|Rapsodo|Upload CSV/i },
        { name: "rapsodo", path: "/rapsodo", text: /Rapsodo Inbox|cloud sync/i },
        { name: "shots", path: "/shots", text: /Your shots|Shot explorer/i },
        { name: "bag", path: "/bag", text: /Bag health|Bag confidence ladder|Bag score trend/i },
        { name: "equipment", path: "/equipment", text: /Equipment/i },
        { name: "coach", path: "/coach", text: /Coach/i },
        { name: "progress", path: "/progress", text: /Progress/i },
      ],
    },
    {
      name: "play-records",
      routes: [
        { name: "rounds", path: "/rounds", text: /Rounds/i },
        { name: "handicap", path: "/handicap", text: /Handicap/i },
        { name: "courses", path: "/courses", text: /Courses/i },
        {
          name: "course-records",
          path: "/course-records",
          text: /Course records|Course Champion/i,
        },
        { name: "challenges", path: "/challenges", text: /Challenges/i },
        { name: "tournaments", path: "/tournaments", text: /Tournaments|Daily, weekly/i },
        { name: "leaderboard", path: "/leaderboard", text: /Leaderboards/i },
      ],
    },
    {
      name: "social-platform",
      routes: [
        { name: "feed", path: "/feed", text: /Feed/i },
        { name: "friends", path: "/friends", text: /Friends/i },
        { name: "groups", path: "/groups", text: /Groups/i },
        { name: "profile", path: "/profile", text: /Profile|You/i },
        { name: "settings", path: "/settings", text: /Settings/i },
        { name: "billing", path: "/billing", text: /Pricing|Current plan/i },
        { name: "providers", path: "/providers", text: /Launch monitor providers|Providers/i },
      ],
    },
  ];

  const desktopRoutes = [
    { name: "dashboard", path: "/dashboard", text: /Dashboard|Today/i },
    { name: "feed", path: "/feed", text: /Feed/i },
    { name: "courses", path: "/courses", text: /Courses/i },
    { name: "course-records", path: "/course-records", text: /Course records|Course Champion/i },
    { name: "challenges", path: "/challenges", text: /Challenges/i },
    { name: "tournaments", path: "/tournaments", text: /Tournaments|Daily, weekly/i },
    { name: "bag", path: "/bag", text: /Bag health|Bag confidence ladder|Bag score trend/i },
    { name: "equipment", path: "/equipment", text: /Equipment/i },
    { name: "coach", path: "/coach", text: /Coach/i },
    { name: "profile", path: "/profile", text: /Profile|You/i },
    { name: "settings", path: "/settings", text: /Settings/i },
    { name: "billing", path: "/billing", text: /Pricing|Current plan/i },
    { name: "providers", path: "/providers", text: /Launch monitor providers|Providers/i },
  ];

  test("captures requested mobile and desktop routes", async ({ page }, testInfo) => {
    skipWhenNoAuth();

    let capturedRoutes = 0;
    let authenticatedCaptures = 0;
    const allMobileRoutes = mobileRouteGroups.flatMap((group) => group.routes);
    const coreMobilePaths = new Set(["/today", "/sessions", "/analyse", "/bag", "/profile"]);
    const coreMobileRoutes = allMobileRoutes.filter((route) => coreMobilePaths.has(route.path));
    const secondaryMobileRoutes = allMobileRoutes.filter(
      (route) => !coreMobilePaths.has(route.path),
    );

    for (const viewport of mobileViewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      for (const route of coreMobileRoutes) {
        if (!(await gotoRouteOrSkip(page, route.path, false))) {
          continue;
        }
        if (!(await expectReadyOrSkip(page, route.text, false))) {
          continue;
        }
        await capture(page, testInfo, `${route.name}-${viewport.name}`);
        capturedRoutes += 1;
        authenticatedCaptures += 1;
      }
    }

    const referenceMobileViewport = mobileViewports.find(
      (viewport) => viewport.width === 390 && viewport.height === 844,
    );
    if (referenceMobileViewport) {
      await page.setViewportSize({
        width: referenceMobileViewport.width,
        height: referenceMobileViewport.height,
      });
      for (const route of secondaryMobileRoutes) {
        if (!(await gotoRouteOrSkip(page, route.path, false))) {
          continue;
        }
        if (!(await expectReadyOrSkip(page, route.text, false))) {
          continue;
        }
        await capture(page, testInfo, `${route.name}-${referenceMobileViewport.name}`);
        capturedRoutes += 1;
        if (route.path !== "/rapsodo") {
          authenticatedCaptures += 1;
        }
      }
    }

    for (const viewport of desktopViewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      for (const route of desktopRoutes) {
        if (!(await gotoRouteOrSkip(page, route.path, false))) {
          continue;
        }
        if (!(await expectReadyOrSkip(page, route.text, false))) {
          continue;
        }
        await capture(page, testInfo, `${route.name}-${viewport.name}`);
        capturedRoutes += 1;
        authenticatedCaptures += 1;
      }
    }

    test.skip(capturedRoutes === 0, "Stored auth state redirected every route to login.");
    test.skip(
      authenticatedCaptures === 0,
      "Stored auth state only allowed public signed-out routes.",
    );

    for (const viewport of [...mobileViewports, ...desktopViewports]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      if (
        (await gotoRouteOrSkip(page, "/bag", false)) &&
        (await expectReadyOrSkip(page, /Bag health|Bag confidence ladder|Bag score trend/i, false))
      ) {
        const clubHref = await firstHref(page, 'a[href^="/bag/"]', /^\/bag\/(?!longest$)[^/]+$/);
        if (clubHref) {
          await gotoRouteOrSkip(page, clubHref);
          await expectReadyOrSkip(page, /Club analysis|Stock yardage|Stock carry|Summary/i);
          await expect(page).toHaveURL(/\/bag\/[^/]+$/);
          await capture(page, testInfo, `club-detail-${viewport.name}`);
        } else {
          testInfo.annotations.push({
            type: "detail-screenshot",
            description: `No club detail link exposed for ${viewport.name}.`,
          });
        }
      }

      if (
        (await gotoRouteOrSkip(page, "/rounds", false)) &&
        (await expectReadyOrSkip(page, /Rounds/i, false))
      ) {
        const roundHref = await firstHref(page, 'a[href^="/rounds/"]', /^\/rounds\/(?!new$)[^/]+$/);
        if (roundHref) {
          await gotoRouteOrSkip(page, roundHref);
          await expectReadyOrSkip(page, /Round review|Round context|Hole|Scorecard/i);
          await expect(page).toHaveURL(/\/rounds\/[^/]+$/);
          await capture(page, testInfo, `round-detail-${viewport.name}`);
        } else {
          testInfo.annotations.push({
            type: "detail-screenshot",
            description: `No round detail link exposed for ${viewport.name}.`,
          });
        }
      }
    }
  });
});

type StorageCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
};

let cachedAuthCookies: StorageCookie[] | null = null;

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    animations: "disabled",
  });
}

async function gotoRouteOrSkip(page: Page, path: string, skipOnLogin = true) {
  try {
    await restoreAuthCookies(page);
    await page.goto(path, { waitUntil: "commit", timeout: routeGotoTimeoutMs });
  } catch (error) {
    const message = String(error);
    if (
      message.includes("net::ERR_ABORTED") ||
      message.includes("net::ERR_CONNECTION_RESET") ||
      message.includes("net::ERR_NETWORK_IO_SUSPENDED") ||
      message.includes("net::ERR_CONNECTION_REFUSED")
    ) {
      await page.waitForTimeout(750);
      await page.goto(path, { waitUntil: "commit", timeout: routeGotoTimeoutMs });
      return true;
    }

    await page.waitForLoadState("domcontentloaded").catch(() => {});
    const bodyText = await page
      .locator("body")
      .innerText()
      .catch(() => "");
    if (/\/login(?:\?|$)/.test(page.url()) || /Sign in or join/i.test(bodyText)) {
      if (skipOnLogin) {
        test.skip(true, "Stored auth state redirected to login.");
      }
      return false;
    }

    throw error;
  }

  return true;
}

async function firstHref(page: Page, selector: string, pattern: RegExp) {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  const readHrefs = () =>
    page
      .locator(selector)
      .evaluateAll((links) =>
        links
          .map((link) => link.getAttribute("href"))
          .filter((href): href is string => Boolean(href)),
      );

  let hrefs: string[];
  try {
    hrefs = await readHrefs();
  } catch (error) {
    if (!String(error).includes("Execution context was destroyed")) {
      throw error;
    }
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    hrefs = await readHrefs();
  }

  return hrefs.find((href) => pattern.test(href)) ?? null;
}

async function expectReadyOrSkip(page: Page, expectedText: RegExp | string, skipOnLogin = true) {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  const initialBodyText = await page
    .locator("body")
    .innerText()
    .catch(() => "");
  if (/\/login(?:\?|$)/.test(page.url()) || /Sign in or join/i.test(initialBodyText)) {
    if (skipOnLogin) {
      test.skip(true, "Stored auth state redirected to login.");
    }
    return false;
  }

  try {
    await expectPageReady(page, expectedText);
  } catch (error) {
    const bodyText = await page
      .locator("body")
      .innerText()
      .catch(() => "");
    if (/\/login(?:\?|$)/.test(page.url()) || /Sign in or join/i.test(bodyText)) {
      if (skipOnLogin) {
        test.skip(true, "Stored auth state redirected to login.");
      }
      return false;
    }
    throw error;
  }

  return true;
}

async function restoreAuthCookies(page: Page) {
  const currentUrl = page.url();
  const cookieOrigin = currentUrl.startsWith("http")
    ? new URL(currentUrl).origin
    : (process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100");
  const currentCookies = await page.context().cookies(cookieOrigin);
  const now = Math.floor(Date.now() / 1000);
  const hasLiveSupabaseCookie = currentCookies.some(
    (cookie) =>
      cookie.name.startsWith("sb-") &&
      cookie.name.endsWith("-auth-token") &&
      (cookie.expires === -1 || cookie.expires > now + 30),
  );
  if (hasLiveSupabaseCookie) {
    return;
  }

  const cookies = getStoredAuthCookies();
  if (cookies.length === 0) {
    return;
  }

  const futureExpiry = now + 60 * 60;
  await page.context().addCookies(
    cookies.map((cookie) => ({
      ...cookie,
      expires:
        cookie.name.startsWith("sb-") && cookie.name.endsWith("-auth-token")
          ? Math.max(cookie.expires ?? 0, futureExpiry)
          : cookie.expires,
    })),
  );
}

function getStoredAuthCookies() {
  if (cachedAuthCookies) {
    return cachedAuthCookies;
  }

  if (!authStorageState || !existsSync(authStorageState)) {
    cachedAuthCookies = [];
    return cachedAuthCookies;
  }

  const state = JSON.parse(readFileSync(authStorageState, "utf8")) as {
    cookies?: StorageCookie[];
  };
  cachedAuthCookies = state.cookies ?? [];
  return cachedAuthCookies;
}
