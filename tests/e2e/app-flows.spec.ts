import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

import { authStorageState, expectPageReady, hasAuthenticatedE2e, skipWhenNoAuth } from "./helpers";

test.describe("authenticated app flows", () => {
  test.skip(!hasAuthenticatedE2e, "Set PLAYWRIGHT_AUTH_STATE to run authenticated app flows.");
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

    await gotoAppRoute(page, "/import?source=csv#csv-import");
    await expectPageReady(page, /Import launch monitor shots/i);
    const importSurface = responsiveImportSurface(page);
    await expect(importSurface.locator('[data-import-ready="true"]')).toBeVisible();

    const fixturePath = path.join(
      process.cwd(),
      "tests",
      "e2e",
      "fixtures",
      "manual-column-map.csv",
    );
    await importSurface.locator("#csv-file").setInputFiles(fixturePath);

    const mappingStep = importSurface.getByRole("button", {
      name: "3. Confirm mapping",
      exact: true,
    });
    if (await mappingStep.isVisible()) {
      await mappingStep.click();
    }
    await expect(importSurface.getByText("Manual column mapping")).toBeVisible();
    await importSurface.getByRole("button", { name: /apply suggestions/i }).click();
    const previewStep = importSurface.getByRole("button", {
      name: "2. Preview data",
      exact: true,
    });
    if (await previewStep.isVisible()) {
      await previewStep.click();
    }
    await expect(importSurface.getByText("Driver").filter({ visible: true }).first()).toBeVisible();
    await expect(importSurface.getByText("CSV file selected", { exact: true })).toBeVisible();
  });

  test("queues a CSV import while offline and shows retry status", async ({ context, page }) => {
    skipWhenNoAuth();

    await page.addInitScript(() => {
      window.localStorage.setItem("forekinghell:offline-import-storage-enabled", "1");
    });

    await gotoAppRoute(page, "/import?source=csv#csv-import");
    await expectPageReady(page, /Import launch monitor shots/i);
    const importSurface = responsiveImportSurface(page);
    await expect(importSurface.locator('[data-import-ready="true"]')).toBeVisible();

    const fixturePath = path.join(
      process.cwd(),
      "tests",
      "e2e",
      "fixtures",
      "standard-rapsodo.csv",
    );
    await importSurface.locator("#csv-file").setInputFiles(fixturePath);
    const previewStep = importSurface.getByRole("button", {
      name: "2. Preview data",
      exact: true,
    });
    if (await previewStep.isVisible()) {
      await previewStep.click();
    }
    await expect(importSurface.getByText("Driver").filter({ visible: true }).first()).toBeVisible();

    await context.setOffline(true);
    const importStep = importSurface.getByRole("button", {
      name: "4. Review & import",
      exact: true,
    });
    if (await importStep.isVisible()) {
      await importStep.click();
    }
    await importSurface.getByRole("button", { name: /queue offline/i }).click({ force: true });
    await expect(
      page.getByText(
        "Private analysis needs a connection. Queued imports and round edits stay on this device until sync succeeds.",
        { exact: true },
      ),
    ).toBeVisible();
  });

  test("shot explorer keeps a mobile-friendly review surface", async ({ page }) => {
    skipWhenNoAuth();

    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAppRoute(page, "/shots");

    await expectPageReady(page, /Shot explorer/i);
    await expect(page.getByRole("link", { name: /import/i }).first()).toBeVisible();
  });

  test("coach chat UI is ready without generating a paid response", async ({ page }) => {
    test.skip(
      (page.viewportSize()?.width ?? 0) < 1024,
      "AI coach tools require the desktop layout",
    );
    skipWhenNoAuth();

    await gotoAppRoute(page, "/coach");
    await expectPageReady(page, /AI coach tools|Ask from your shot data/i);
    await page.getByText("AI coach tools", { exact: true }).filter({ visible: true }).click();
    const chatCard = page.locator('[data-coach-chat-ready="true"]').filter({ visible: true });
    await expect(chatCard).toBeVisible();
    const coachQuestion = chatCard.getByLabel("Ask from your shot data");
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

function responsiveImportSurface(page: Page) {
  return page.locator((page.viewportSize()?.width ?? 0) < 1024 ? "#csv-import" : "#rapsodo-import");
}
