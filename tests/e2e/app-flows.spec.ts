import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

import { authStorageState, expectPageReady, skipWhenNoAuth } from "./helpers";

test.describe("authenticated app flows", () => {
  test.use(authStorageState ? { storageState: authStorageState } : {});
  test.setTimeout(90_000);

  const routes = [
    { path: "/dashboard", text: /Dashboard|Sessions|Shots/i },
    { path: "/shots", text: /Shot explorer/i },
    { path: "/bag", text: /Bag health|Bag score trend|Strongest club/i },
    { path: "/rounds/new", text: /Add Round/i },
    { path: "/handicap", text: /Handicap/i },
    { path: "/coach", text: /Coach/i },
    { path: "/achievements", text: /Achievements/i },
    { path: "/equipment", text: /Equipment/i },
    { path: "/strokes-gained", text: /Strokes gained/i },
  ];

  for (const route of routes) {
    test(`loads ${route.path}`, async ({ page }) => {
      skipWhenNoAuth();

      await gotoAppRoute(page, route.path);
      await expectPageReady(page, route.text);
    });
  }

  test("previews a changed CSV format through manual column mapping", async ({ page }) => {
    skipWhenNoAuth();

    await gotoAppRoute(page, "/import");
    await expectPageReady(page, /Import launch monitor shots/i);
    await expect(page.locator('[data-import-ready="true"]')).toBeVisible();

    const fixturePath = path.join(
      process.cwd(),
      "tests",
      "e2e",
      "fixtures",
      "manual-column-map.csv",
    );
    await page.setInputFiles("#csv-file", fixturePath);

    await expect(page.getByText("Manual column mapping")).toBeVisible();
    await page.getByRole("button", { name: /apply suggestions/i }).click();
    await expect(page.getByText("Driver").first()).toBeVisible();
    await expect(page.getByText("CSV file selected")).toBeVisible();
  });

  test("queues a CSV import while offline and shows retry status", async ({ context, page }) => {
    skipWhenNoAuth();

    await gotoAppRoute(page, "/import");
    await expectPageReady(page, /Import launch monitor shots/i);
    await expect(page.locator('[data-import-ready="true"]')).toBeVisible();

    const fixturePath = path.join(
      process.cwd(),
      "tests",
      "e2e",
      "fixtures",
      "standard-rapsodo.csv",
    );
    await page.setInputFiles("#csv-file", fixturePath);
    await expect(page.getByText("Driver").first()).toBeVisible();

    await context.setOffline(true);
    await page.getByRole("button", { name: /queue offline/i }).click();
    await expect(page.getByText(/queued 1 csv file/i)).toBeVisible();
    await expect(page.getByText(/pending offline action/i)).toBeVisible();
  });

  test("shot explorer keeps a mobile-friendly review surface", async ({ page }) => {
    skipWhenNoAuth();

    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAppRoute(page, "/shots");

    await expectPageReady(page, /Shot explorer/i);
    await expect(page.getByRole("link", { name: /import/i }).first()).toBeVisible();
  });

  test("coach chat UI is ready without generating a paid response", async ({ page }) => {
    skipWhenNoAuth();

    await gotoAppRoute(page, "/coach");
    await expectPageReady(page, /AI coach chat/i);
    const chatCard = page.locator('[data-coach-chat-ready="true"]').filter({ visible: true });
    await expect(chatCard).toBeVisible();
    const coachQuestion = chatCard.locator("#coach-question");
    await coachQuestion.fill("How can I improve my 7 iron dispersion?");
    await expect(chatCard.getByRole("button", { name: /ask coach/i })).toBeEnabled();
  });
});

async function gotoAppRoute(page: Page, path: string) {
  try {
    await page.goto(path, { waitUntil: "domcontentloaded", timeout: 60_000 });
  } catch (error) {
    const message = String(error);
    if (
      !message.includes("net::ERR_ABORTED") &&
      !message.includes("net::ERR_NETWORK_IO_SUSPENDED")
    ) {
      throw error;
    }
    await page.goto(path, { waitUntil: "domcontentloaded", timeout: 60_000 });
  }

  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
}
