import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { authStorageState, expectPageReady, skipWhenNoAuth } from "./helpers";

test.describe("mobile density screenshots", () => {
  test.use(authStorageState ? { storageState: authStorageState } : {});

  const viewports = [
    { name: "390x844", width: 390, height: 844 },
    { name: "430x932", width: 430, height: 932 },
    { name: "desktop", width: 1440, height: 1000 },
  ];

  const routes = [
    { name: "dashboard", path: "/dashboard", text: /Dashboard|Today/i },
    { name: "today", path: "/today", text: /Today/i },
    { name: "import", path: "/import", text: /Import launch monitor shots|CSV import/i },
    { name: "rapsodo", path: "/rapsodo", text: /Rapsodo cloud sync/i },
    { name: "shots", path: "/shots", text: /Shot database|Shot explorer/i },
    { name: "bag", path: "/bag", text: /Stock yardages/i },
    { name: "rounds", path: "/rounds", text: /Rounds/i },
    { name: "rounds-new", path: "/rounds/new", text: /Add Round|New round/i },
    { name: "handicap", path: "/handicap", text: /Handicap/i },
    { name: "courses", path: "/courses", text: /Courses/i },
    { name: "courses-new", path: "/courses/new", text: /New Course|Manual course setup/i },
    { name: "coach", path: "/coach", text: /Coach/i },
    { name: "progress", path: "/progress", text: /Progress/i },
    { name: "achievements", path: "/achievements", text: /Progress worth tracking|Achievements/i },
    { name: "equipment", path: "/equipment", text: /Equipment inventory/i },
    { name: "leaderboard", path: "/leaderboard", text: /Leaderboards/i },
    { name: "settings", path: "/settings", text: /Settings/i },
  ];

  for (const viewport of viewports) {
    test(`captures primary routes at ${viewport.name}`, async ({ page }, testInfo) => {
      skipWhenNoAuth();

      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      let capturedRoutes = 0;
      for (const route of routes) {
        if (!(await gotoRouteOrSkip(page, route.path, false))) {
          continue;
        }
        if (!(await expectReadyOrSkip(page, route.text, false))) {
          continue;
        }
        await capture(page, testInfo, `${route.name}-${viewport.name}`);
        capturedRoutes += 1;
      }
      test.skip(capturedRoutes === 0, "Stored auth state redirected every primary route to login.");
    });

    test(`captures data-dependent detail routes at ${viewport.name}`, async ({ page }, testInfo) => {
      skipWhenNoAuth();

      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      await gotoRouteOrSkip(page, "/bag");
      await expectReadyOrSkip(page, /Stock yardages/i);
      const clubHref = await firstHref(page, 'a[href^="/bag/"]', /^\/bag\/(?!longest$)[^/]+$/);
      test.skip(!clubHref, "No club detail route available for screenshot.");
      await gotoRouteOrSkip(page, clubHref as string);
      await expectReadyOrSkip(page, /Club analysis|Stock yardage|Stock carry/i);
      await expect(page).toHaveURL(/\/bag\/[^/]+$/);
      await capture(page, testInfo, `club-detail-${viewport.name}`);

      await gotoRouteOrSkip(page, "/rounds");
      await expectReadyOrSkip(page, /Rounds/i);
      const roundHref = await firstHref(page, 'a[href^="/rounds/"]', /^\/rounds\/(?!new$)[^/]+$/);
      test.skip(!roundHref, "No round detail route available for screenshot.");
      await gotoRouteOrSkip(page, roundHref as string);
      await expectReadyOrSkip(page, /Round review|Round context|Hole/i);
      await expect(page).toHaveURL(/\/rounds\/[^/]+$/);
      await capture(page, testInfo, `round-detail-${viewport.name}`);
    });
  }
});

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    animations: "disabled",
  });
}

async function gotoRouteOrSkip(page: Page, path: string, skipOnLogin = true) {
  try {
    await page.goto(path, { waitUntil: "domcontentloaded" });
  } catch (error) {
    if (String(error).includes("net::ERR_ABORTED")) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      return;
    }

    await page.waitForLoadState("domcontentloaded").catch(() => {});
    const bodyText = await page.locator("body").innerText().catch(() => "");
    if (/\/login(?:\?|$)/.test(page.url()) || /Sign in to ForeKingHell/i.test(bodyText)) {
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
    page.locator(selector).evaluateAll((links) =>
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
  const initialBodyText = await page.locator("body").innerText().catch(() => "");
  if (/\/login(?:\?|$)/.test(page.url()) || /Sign in to ForeKingHell/i.test(initialBodyText)) {
    if (skipOnLogin) {
      test.skip(true, "Stored auth state redirected to login.");
    }
    return false;
  }

  try {
    await expectPageReady(page, expectedText);
  } catch (error) {
    const bodyText = await page.locator("body").innerText().catch(() => "");
    if (/\/login(?:\?|$)/.test(page.url()) || /Sign in to ForeKingHell/i.test(bodyText)) {
      if (skipOnLogin) {
        test.skip(true, "Stored auth state redirected to login.");
      }
      return false;
    }
    throw error;
  }

  return true;
}
