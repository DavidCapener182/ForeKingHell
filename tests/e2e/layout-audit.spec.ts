import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

import { authStorageState } from "./helpers";

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1728, height: 1117 },
] as const;

const publicRoutes = ["/login", "/privacy"];
const routeGotoTimeoutMs = 120_000;

const authenticatedStaticRoutes = discoverStaticAppRoutes().filter(
  (route) => route !== "/" && !publicRoutes.includes(route),
);

test.describe("layout audit", () => {
  test.setTimeout(300_000);

  test("public pages do not create document overflow", async ({ page }) => {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);

      for (const route of publicRoutes) {
        await gotoLayoutRoute(page, route);
        await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {});
        await expectLayoutBounds(page, route, viewport);
      }
    }
  });

  test.describe("authenticated pages", () => {
    test.use(authStorageState ? { storageState: authStorageState } : {});

    test("static app routes stay within their intended canvas", async ({ page }) => {
      test.skip(
        !authStorageState || !existsSync(authStorageState),
        "Set PLAYWRIGHT_AUTH_STATE to run authenticated layout audit.",
      );

      const firstRoute = authenticatedStaticRoutes[0];
      test.skip(!firstRoute, "No authenticated static routes discovered.");

      await page.setViewportSize(viewports[0]);
      await gotoLayoutRoute(page, firstRoute);
      await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {});
      test.skip(/\/login(?:\?|$)/.test(page.url()), "Stored auth state redirected to login.");

      for (const viewport of viewports) {
        await page.setViewportSize(viewport);

        for (const route of authenticatedStaticRoutes) {
          await gotoLayoutRoute(page, route);
          await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {});

          if (/\/login(?:\?|$)/.test(page.url())) {
            test.skip(true, "Stored auth state redirected to login.");
          }

          await expectLayoutBounds(page, route, viewport);
        }
      }
    });
  });
});

async function expectLayoutBounds(page: Page, route: string, viewport: (typeof viewports)[number]) {
  const metrics = await page.evaluate(() => {
    return {
      path: location.pathname,
      scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      viewportWidth: window.innerWidth,
    };
  });

  expect(
    metrics.scrollWidth,
    `${viewport.name} ${route} (${metrics.path}) should not horizontally overflow`,
  ).toBeLessThanOrEqual(metrics.viewportWidth + 2);
}

async function gotoLayoutRoute(page: Page, route: string) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto(route, { waitUntil: "commit", timeout: routeGotoTimeoutMs });
      await page.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => {});
      return;
    } catch (error) {
      const message = String(error);
      const retryable =
        message.includes("net::ERR_ABORTED") ||
        message.includes("net::ERR_CONNECTION_RESET") ||
        message.includes("net::ERR_NETWORK_IO_SUSPENDED") ||
        message.includes("frame was detached");

      if (!retryable || attempt === 1) {
        throw error;
      }

      await page.waitForTimeout(1_000);
    }
  }
}

function discoverStaticAppRoutes() {
  const appDir = path.join(process.cwd(), "src", "app");
  const pages: string[] = [];

  walk(appDir, pages);

  return pages
    .map((filePath) => {
      const relative = path.relative(appDir, filePath);
      const route = relative.replace(/\/page\.tsx$/, "");
      return route === "page.tsx" ? "/" : `/${route}`;
    })
    .filter((route) => !route.includes("["))
    .sort();
}

function walk(directory: string, pages: string[]) {
  for (const entry of readdirSync(directory)) {
    const entryPath = path.join(directory, entry);
    const stat = statSync(entryPath);

    if (stat.isDirectory()) {
      walk(entryPath, pages);
      continue;
    }

    if (entry === "page.tsx") {
      pages.push(entryPath);
    }
  }
}
