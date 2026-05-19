import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";

const axePath = path.join(process.cwd(), "node_modules", "axe-core", "axe.min.js");

export const authStorageState = process.env.PLAYWRIGHT_AUTH_STATE;

export function skipWhenNoAuth() {
  test.skip(
    !authStorageState || !existsSync(authStorageState),
    "Set PLAYWRIGHT_AUTH_STATE to run authenticated app flows.",
  );
}

export async function expectPageReady(page: Page, expectedText: RegExp | string) {
  await expect(page.locator("body")).toContainText(expectedText);
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
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
