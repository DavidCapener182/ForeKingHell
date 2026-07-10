import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";

import { localAuthBypassEnabled } from "./local-auth";

const axePath = path.join(process.cwd(), "node_modules", "axe-core", "axe.min.js");

export const authStorageState = process.env.PLAYWRIGHT_AUTH_STATE;
export const hasLocalAuthBypass = localAuthBypassEnabled(
  process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100",
);

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
    !hasLocalAuthBypass && (!authStorageState || !existsSync(authStorageState)),
    "Set PLAYWRIGHT_AUTH_STATE to run authenticated app flows.",
  );
}

export async function expectPageReady(page: Page, expectedText: RegExp | string) {
  await expectWithOneReload(page, expectedText, 45_000);
  const desktopChrome = page.locator("[data-desktop-workbench-hydrated]");
  if ((await desktopChrome.count()) > 0) {
    try {
      await expect(desktopChrome).toHaveAttribute("data-desktop-workbench-hydrated", "true", {
        timeout: 45_000,
      });
    } catch (error) {
      if (page.isClosed()) {
        throw error;
      }
      await page.reload({ waitUntil: "commit", timeout: 45_000 });
      await expectWithOneReload(page, expectedText, 45_000);
      await expect(page.locator("[data-desktop-workbench-hydrated]")).toHaveAttribute(
        "data-desktop-workbench-hydrated",
        "true",
        { timeout: 45_000 },
      );
    }
  }
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
            violations: Array<{
              id: string;
              impact: string | null;
              nodes: Array<{
                target: string[];
                html: string;
                failureSummary?: string;
              }>;
            }>;
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
        nodes: violation.nodes.map((node) => ({
          target: node.target,
          html: node.html,
          failureSummary: node.failureSummary,
        })),
      }));
  });

  expect(violations).toEqual([]);
}

export async function expectNoWcagAaAxeViolations(page: Page) {
  await injectAxe(page);
  const violations = await page.evaluate(async () => {
    const axe = (
      window as typeof window & {
        axe: {
          run: (
            context?: unknown,
            options?: unknown,
          ) => Promise<{
            violations: Array<{
              id: string;
              impact: string | null;
              help: string;
              nodes: Array<{ target: string[]; html: string; failureSummary?: string }>;
            }>;
          }>;
        };
      }
    ).axe;
    const result = await axe.run(document, {
      resultTypes: ["violations"],
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
      },
    });

    return result.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.map((node) => ({
        target: node.target,
        html: node.html,
        failureSummary: node.failureSummary,
      })),
    }));
  });

  expect(violations).toEqual([]);
}
