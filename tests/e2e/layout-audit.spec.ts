import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

import { authStorageState } from "./helpers";

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1728, height: 1117 },
] as const;

const publicRoutes = ["/login", "/privacy"];

const authenticatedStaticRoutes = discoverStaticAppRoutes().filter(
  (route) => route !== "/" && !publicRoutes.includes(route),
);

test.describe("layout audit", () => {
  test("public pages do not create document overflow", async ({ page }) => {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);

      for (const route of publicRoutes) {
        await page.goto(route, { waitUntil: "domcontentloaded" });
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
      await page.goto(firstRoute, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {});
      test.skip(/\/login(?:\?|$)/.test(page.url()), "Stored auth state redirected to login.");

      for (const viewport of viewports) {
        await page.setViewportSize(viewport);

        for (const route of authenticatedStaticRoutes) {
          await page.goto(route, { waitUntil: "domcontentloaded" });
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
