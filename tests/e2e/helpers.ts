import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";

const axePath = path.join(process.cwd(), "node_modules", "axe-core", "axe.min.js");

export const authStorageState = process.env.PLAYWRIGHT_AUTH_STATE;

test.beforeEach(async ({ page }) => {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const headers = request.headers();
    const isPrefetch =
      headers["next-router-prefetch"] === "1" ||
      headers.purpose === "prefetch" ||
      headers["sec-purpose"]?.includes("prefetch");

    if (isPrefetch) {
      await route.abort();
      return;
    }

    await route.continue();
  });
});

test.afterEach(async ({ page }, testInfo) => {
  if (!authStorageState || !existsSync(authStorageState)) {
    return;
  }
  if (testInfo.status === "skipped" || page.isClosed()) {
    return;
  }
  if (/\/login(?:\?|$)/.test(page.url())) {
    return;
  }
  const authCookies = await page.context().cookies();
  const hasSupabaseAuthCookie = authCookies.some((cookie) => /^sb-.+-auth-token/.test(cookie.name));

  if (!hasSupabaseAuthCookie) {
    return;
  }

  await page.context().storageState({ path: authStorageState });
});

export function skipWhenNoAuth() {
  test.skip(
    !authStorageState || !existsSync(authStorageState),
    "Set PLAYWRIGHT_AUTH_STATE to run authenticated app flows.",
  );
}

export async function expectPageReady(page: Page, expectedText: RegExp | string) {
  await expectWithOneReload(page, expectedText, 45_000);
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
}

async function expectWithOneReload(page: Page, expectedText: RegExp | string, timeout: number) {
  try {
    await expect(page.locator("body")).toContainText(expectedText, { timeout });
  } catch (error) {
    if (page.isClosed()) {
      throw error;
    }

    await page.reload({ waitUntil: "commit", timeout: 45_000 });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    await expect(page.locator("body")).toContainText(expectedText, { timeout });
  }
}

export async function injectAxe(page: Page) {
  await page.addScriptTag({ content: readFileSync(axePath, "utf8") });
}

export async function expectNoCriticalAxeViolations(page: Page) {
  await injectAxe(page);
  const violations = await page.evaluate(async () => {
    const axe = (
      window as typeof window & {
        axe: {
          run: (
            context?: unknown,
            options?: unknown,
          ) => Promise<{
            violations: Array<{ id: string; impact: string | null; nodes: unknown[] }>;
          }>;
        };
      }
    ).axe;
    const result = await axe.run(document, {
      resultTypes: ["violations"],
      rules: {
        "color-contrast": { enabled: true },
      },
    });

    return result.violations
      .filter((violation) => violation.impact === "critical" || violation.impact === "serious")
      .map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.length,
      }));
  });

  expect(violations).toEqual([]);
}
