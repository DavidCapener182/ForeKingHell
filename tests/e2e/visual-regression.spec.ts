import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

import { authStorageState, expectPageReady, hasAuthenticatedE2e, skipWhenNoAuth } from "./helpers";

const routes = [
  { name: "today", path: "/today", ready: /Today|recommendation/i },
  { name: "practice", path: "/practice", ready: /Practice|Recommended session/i },
  { name: "bag", path: "/bag", ready: /Bag|Yardages/i },
  { name: "sessions", path: "/sessions", ready: /Sessions|Recent history/i },
  { name: "play", path: "/play", ready: /Play|Selected course/i },
  { name: "import", path: "/import", ready: /Import|Rapsodo|Upload CSV/i },
] as const;

const viewports = [
  { name: "phone-320x568", width: 320, height: 568 },
  { name: "phone-390x844", width: 390, height: 844 },
  { name: "phone-430x932", width: 430, height: 932 },
  { name: "phone-landscape-844x390", width: 844, height: 390 },
  { name: "tablet-744x1133", width: 744, height: 1133 },
  { name: "desktop-1440x900", width: 1440, height: 900 },
] as const;

const themes = ["light", "dark", "range-night"] as const;
const visualStyle = path.join(process.cwd(), "tests/e2e/visual-regression.css");
const selectedRoutes = process.env.VISUAL_ROUTE
  ? routes.filter((route) => route.name === process.env.VISUAL_ROUTE)
  : routes;
const requestedViewports = new Set(process.env.VISUAL_VIEWPORTS?.split(",").filter(Boolean) ?? []);
const selectedViewports = requestedViewports.size
  ? viewports.filter((viewport) => requestedViewports.has(viewport.name))
  : viewports;

test.describe("companion visual regression matrix", () => {
  test.skip(!hasAuthenticatedE2e, "Set PLAYWRIGHT_AUTH_STATE or enable the local auth bypass.");
  test.use(authStorageState ? { storageState: authStorageState } : {});
  test.setTimeout(1_800_000);

  test("matches the approved route, viewport and theme baselines", async ({
    browserName,
    page,
  }, testInfo) => {
    test.skip(
      browserName !== "chromium" || testInfo.project.name !== "chromium",
      "Visual baselines are intentionally captured once in base Chromium.",
    );
    skipWhenNoAuth();

    for (const viewport of selectedViewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const surface = viewport.width >= 1024 ? "workbench" : "companion";

      for (const route of selectedRoutes) {
        await gotoSurface(page, surface, route.path, route.ready);

        for (const theme of themes) {
          await applyRegressionTheme(page, theme);
          await expectNoDocumentOverflow(page);
          await expect(page).toHaveScreenshot(`${route.name}-${viewport.name}-${theme}.png`, {
            animations: "disabled",
            caret: "hide",
            fullPage: false,
            maxDiffPixelRatio: 0.01,
            stylePath: visualStyle,
          });
        }
      }
    }
  });
});

async function gotoSurface(
  page: Page,
  surface: "companion" | "workbench",
  route: string,
  ready: RegExp,
) {
  await page.goto(`/surface/${surface}?next=${encodeURIComponent(route)}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {});
  await expectPageReady(page, ready);
  if (route === "/practice" && surface === "companion") {
    await expect(
      page.getByRole("button", { name: /Save & Start Practice|Start Practice/i }),
    ).toBeEnabled();
    await expect(page.getByRole("button", { name: "Next slide" })).toBeEnabled();
  }
  const mobilePattern = page.locator('[data-mobile-shot-pattern-hydrated="true"]');
  if ((await mobilePattern.count()) > 0) {
    await expect(mobilePattern.first()).toBeVisible();
  }
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.querySelectorAll("details[open]").forEach((element) => {
      element.removeAttribute("open");
    });
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.race([
      Promise.all(
        Array.from(document.images).map((image) => image.decode().catch(() => undefined)),
      ),
      new Promise<void>((resolve) => window.setTimeout(resolve, 2_000)),
    ]);
  });
  await page.locator("main").first().waitFor({ state: "visible" });
}

async function applyRegressionTheme(page: Page, theme: (typeof themes)[number]) {
  await page.emulateMedia({ colorScheme: theme === "light" ? "light" : "dark" });
  await page.evaluate((nextTheme) => {
    const root = document.documentElement;
    root.dataset.theme = nextTheme;
    root.dataset.themePreference = nextTheme;
    root.classList.toggle("dark", nextTheme !== "light");
    root.style.colorScheme = nextTheme === "light" ? "light" : "dark";
  }, theme);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
}

async function expectNoDocumentOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    )
    .toBeLessThanOrEqual(2);
}
