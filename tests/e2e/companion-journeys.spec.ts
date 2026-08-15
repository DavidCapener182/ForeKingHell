import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

import { authStorageState, expectPageReady, hasAuthenticatedE2e, skipWhenNoAuth } from "./helpers";
import {
  canRunMutatingCompanionE2e,
  MutatingCompanionFixture,
  mutatingCompanionSkipReason,
} from "./mutating-companion-fixture";

test.describe("phone companion journeys", () => {
  test.skip(!hasAuthenticatedE2e, "Set PLAYWRIGHT_AUTH_STATE to run companion journeys.");
  test.use(authStorageState ? { storageState: authStorageState } : {});
  test.describe.configure({ mode: "serial" });
  test.setTimeout(360_000);

  let mutatingFixture: MutatingCompanionFixture | null = null;

  test.beforeEach(async ({ browserName, page }, testInfo) => {
    test.skip(
      browserName !== "chromium" || testInfo.project.name !== "chromium",
      "The companion journey suite runs once in Chromium.",
    );
    skipWhenNoAuth();
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test.afterEach(async () => {
    await mutatingFixture?.cleanup();
    mutatingFixture = null;
  });

  test("1-6: builds, runs, uploads and immediately reviews measured practice", async ({ page }) => {
    test.skip(!canRunMutatingCompanionE2e, mutatingCompanionSkipReason);
    mutatingFixture = new MutatingCompanionFixture();
    await openCompanion(
      page,
      "/practice?intent=latest_weakness&club=driver&time=30&source=e2e",
      /Recommended session|Active Range Mode/i,
    );
    await expectPageReady(page, /Recommended session/i);
    await expect(page.getByRole("button", { name: /Quick adjustments/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await page.getByRole("button", { name: "30 min", exact: true }).click();
    await page.getByRole("button", { name: "Apply adjustments" }).click();
    await expect(page.locator("[data-current-practice-plan]")).toContainText("30 min");
    await expect(page.locator("[data-practice-block-carousel] button[aria-pressed]")).toHaveCount(
      3,
    );
    await page.getByRole("button", { name: "Save & Start Practice" }).click();
    const rangeMode = page.locator("[data-active-range-mode]");
    await expect(rangeMode).toBeVisible();
    mutatingFixture.trackPracticePlan(await rangeMode.getAttribute("data-practice-plan-id"));
    await expect(page.getByText(/Range Mode · Block 1 of 3/i)).toBeVisible();
    await expect(page.getByText(/activity only/i)).toBeVisible();

    await page.getByRole("button", { name: "Complete Block" }).click();
    await expect(page.getByText(/Range Mode · Block 2 of 3/i)).toBeVisible();
    await page.getByRole("button", { name: "Next practice block" }).click();
    await expect(page.getByText(/Range Mode · Block 3 of 3/i)).toBeVisible();
    await page.getByRole("button", { name: "Previous practice block" }).click();
    await expect(page.getByText(/Range Mode · Block 2 of 3/i)).toBeVisible();

    await page.getByRole("button", { name: "Finish Practice" }).click();
    await expect(page.getByRole("heading", { name: "Add measured evidence?" })).toBeVisible();
    await page.getByRole("link", { name: "Choose CSV" }).click();
    await expect(page).toHaveURL(/\/import\?source=csv&practicePlanId=/);
    await expectPageReady(page, /Choose a range CSV/i);

    const importToken = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const csvRows = [
      "Shot Number,Session ID,Club Type,Carry Distance (yd),Total Distance (yd),Ball Speed,Launch Angle,Apex (yd),Side Carry (yd)",
      ...Array.from({ length: 18 }, (_, index) =>
        [
          index + 1,
          importToken,
          "Driver",
          218 + (index % 7),
          235 + (index % 8),
          143 + (index % 5),
          12 + (index % 4) * 0.4,
          31 + (index % 5),
          -8 + index,
        ].join(","),
      ),
      ...Array.from({ length: 12 }, (_, index) =>
        [
          index + 19,
          importToken,
          "7 Iron",
          151 + (index % 6),
          158 + (index % 6),
          112 + (index % 4),
          17 + (index % 3) * 0.5,
          27 + (index % 4),
          -5 + index,
        ].join(","),
      ),
    ].join("\n");
    const fileName = `companion-range-${importToken}.csv`;
    mutatingFixture.trackFileName(fileName);
    await page.locator("#companion-csv-file").setInputFiles({
      name: fileName,
      mimeType: "text/csv",
      buffer: Buffer.from(csvRows),
    });

    const confirmation = page.locator("[data-companion-csv-confirmation]");
    await expect(confirmation).toBeVisible();
    await expect(confirmation).toContainText("30");
    await expect(confirmation).toContainText(/Driver/i);
    await expect(confirmation).toContainText(/7 Iron/i);
    await expect(page.locator("[data-uncertain-club-mappings]")).toHaveCount(0);
    await expect(confirmation.getByText("New session", { exact: true })).toBeVisible();
    const saveImport = confirmation.getByRole("button", { name: "Save and build review" });
    await expect(saveImport).toBeVisible();
    await expect(saveImport).toBeEnabled();
    await saveImport.dispatchEvent("click");
    await expect(page).toHaveURL(/\/import\/result\?sessionId=[0-9a-f-]+/, { timeout: 120_000 });
    const savedSessionId = new URL(page.url()).searchParams.get("sessionId");
    expect(savedSessionId).toBeTruthy();
    mutatingFixture.trackSession(savedSessionId);

    await expect(page.locator("[data-session-verdict]")).toBeVisible();
    await expect(page.locator("[data-mobile-shot-pattern]")).toHaveAttribute(
      "data-mobile-shot-pattern-hydrated",
      "true",
    );
    await expect(page.getByRole("img", { name: /Dispersion chart/i })).toBeVisible();
    await page.getByRole("button", { name: "Flight", exact: true }).click();
    await expect(page.getByRole("img", { name: /Flight chart/i })).toBeVisible();
    await expect(page.getByText("Plan versus actual", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Build next plan" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Bag confidence|Shot rows/i })).toHaveCount(0);

    await page.goto("/sessions", { waitUntil: "commit" });
    await expectPageReady(page, /Your golf history/i);
    await page.getByRole("button", { name: "Practice", exact: true }).click();
    const measuredReview = page.locator(`a[href="/sessions/${savedSessionId}"]`).first();
    await expect(measuredReview).toBeVisible();
    await measuredReview.click();
    await expectPageReady(page, /Practice review/i);
    await expect(page.getByRole("heading", { name: "Four important numbers" })).toBeVisible();
    await expect(page.locator("[data-mobile-shot-pattern]")).toHaveAttribute(
      "data-mobile-shot-pattern-hydrated",
      "true",
    );
    await expect(page.getByRole("img", { name: /Dispersion chart/i })).toBeVisible();
    await page.getByRole("button", { name: "Flight", exact: true }).click();
    await expect(page.getByRole("img", { name: /Flight chart/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Build next plan" })).toBeVisible();
  });

  test("7-10: prepares a course, changes holes, opens Strategy and checks Quick Bag", async ({
    page,
  }) => {
    await openCompanion(page, "/play", /Selected course/i);
    await expect(page.getByRole("button", { name: /Change course or tee/i })).toBeVisible();
    await page.getByRole("link", { name: "Course Strategy" }).click();
    await expectPageReady(page, /Overall game plan/i);
    await expect(page.getByText("Hole 1", { exact: true })).toBeVisible();
    await expect(page.getByText("Recommended club", { exact: true })).toBeVisible();

    const nextHole = page.getByRole("button", { name: "Next hole" });
    await expect(nextHole).toBeEnabled();
    await nextHole.click();
    await expect(page.getByText("Hole 2", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: /^(?:Save Strategy on This Device|Refresh Saved Strategy)$/ })
      .click();
    await expect(page.getByRole("button", { name: "Refresh Saved Strategy" })).toBeVisible();

    const courseTwinLink = page.getByRole("link", { name: /View this hole in Course Twin/i });
    if ((await courseTwinLink.count()) > 0) {
      await courseTwinLink.click();
      await expectPageReady(page, /Course Twin/i);
      const modeGroup = page.getByRole("group", { name: "Course Twin mode" });
      await expect(modeGroup.getByRole("button", { name: "Strategy" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(page.getByRole("navigation", { name: "Mobile primary" })).toHaveCount(0);
      await expect(page.getByText(/Hole 2 ·/i)).toBeVisible();
    } else {
      await expect(page.getByText("Course Twin unavailable", { exact: true })).toBeVisible();
      await expect(page).toHaveURL(/\/courses\/strategy/);
    }

    await page.goto("/quick-bag", { waitUntil: "commit" });
    await expectPageReady(page, /Quick Bag/i);
    await expect(page.getByRole("textbox", { name: "Target distance" })).toBeVisible();
    await expect(page.locator("[data-quick-bag-hydrated]")).toHaveAttribute(
      "data-quick-bag-hydrated",
      "true",
    );
    await page.getByRole("button", { name: "Search club" }).click();
    await page.getByRole("searchbox", { name: "Search by club" }).fill("Driver");
    const driverEvidence = page.getByRole("button", { name: /Open Driver evidence/i }).first();
    await expect(driverEvidence).toBeVisible();
    await driverEvidence.click();
    await expect(page.getByRole("heading", { name: /Driver/i }).first()).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Target distance" }).click();
    await page.getByRole("textbox", { name: "Target distance" }).fill("165");
    await expect(page.locator("[data-quick-bag-best-match]")).toContainText(/Best match for 165/i);
  });

  test("local companion controls preserve the current document", async ({ page }) => {
    await openCompanion(page, "/sessions", /Your golf history/i);
    const sessionsDocument = await markCurrentDocument(page);
    const sessionsUrl = page.url();
    await page.getByRole("radio", { name: "Practice", exact: true }).click();
    await expect(page.getByRole("radio", { name: "Practice", exact: true })).toBeChecked();
    await expectCurrentDocument(page, sessionsDocument);
    expect(page.url()).toBe(sessionsUrl);

    await openCompanion(page, "/quick-bag", /Quick Bag/i);
    const bagDocument = await markCurrentDocument(page);
    const bagUrl = page.url();
    await page.getByRole("radio", { name: "Target distance", exact: true }).click();
    await expect(page.getByRole("radio", { name: "Target distance", exact: true })).toBeChecked();
    await expectCurrentDocument(page, bagDocument);
    expect(page.url()).toBe(bagUrl);
  });

  test("mocked R-Cloud inbox previews uncertain matches and opens the common review", async ({
    page,
  }) => {
    test.skip(!canRunMutatingCompanionE2e, mutatingCompanionSkipReason);
    test.skip(
      process.env.RAPSODO_E2E_FIXTURE !== "1",
      "Set RAPSODO_E2E_FIXTURE=1 with the local auth bypass to run the mocked R-Cloud journey.",
    );
    mutatingFixture = new MutatingCompanionFixture();
    mutatingFixture.trackFileName("playwright-rcloud-range.csv");
    await openCompanion(page, "/rapsodo", /Session inbox/i);
    const inbox = page.locator("[data-rapsodo-companion-inbox]");
    await expect(inbox).toHaveAttribute("data-hydrated", "true");
    await expect(inbox.getByText("Playwright range session", { exact: true })).toBeVisible();
    await inbox.getByRole("button", { name: /Playwright range session/i }).click();

    const preview = page.locator("[data-rapsodo-companion-preview]");
    await expect(preview).toHaveAttribute("data-hydrated", "true");
    await expect(preview).toContainText("18 shots");
    const uncertain = preview.locator("[data-uncertain-club-mappings]");
    await expect(uncertain.locator("select")).toHaveCount(1);
    await uncertain.locator("select").selectOption("7i");
    await preview.getByRole("button", { name: "Import and review" }).click();

    await expect(page).toHaveURL(/\/import\/result\?sessionId=[0-9a-f-]+/);
    mutatingFixture.trackSession(new URL(page.url()).searchParams.get("sessionId"));
    await expect(page.locator("[data-session-verdict]")).toBeVisible();
    await expect(page.getByRole("img", { name: /Dispersion chart/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Shot Explorer|Shot rows/i })).toHaveCount(0);
    expect(page.url()).not.toContain("/shots");
  });

  test("11-12: hands desktop-only work off and persists Full Site", async ({ page }) => {
    await openCompanion(page, "/strokes-gained", /available on the full desktop site/i);
    await expect(page.getByText("Strokes Gained needs detailed shot-event tables.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Review latest round" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open Quick Bag" })).toBeVisible();

    await page.getByRole("link", { name: "Open Full Site" }).click();
    await expectPageReady(page, /Expected-strokes baseline|Scoring diagnosis/i);
    await expect(page.locator('[data-app-surface="workbench"]')).toBeVisible();
    await expect(page.locator("[data-desktop-workbench-hydrated]")).toHaveAttribute(
      "data-desktop-workbench-hydrated",
      "true",
    );
    await expect(page.getByRole("navigation", { name: "Mobile primary" })).toHaveCount(0);

    await page.reload({ waitUntil: "commit" });
    await expectPageReady(page, /Expected-strokes baseline|Scoring diagnosis/i);
    await expect(page.locator('[data-app-surface="workbench"]')).toBeVisible();
    await expect(page.locator("[data-desktop-workbench-hydrated]")).toHaveAttribute(
      "data-desktop-workbench-hydrated",
      "true",
    );
    await expect(page.getByText(/available on the full desktop site/i)).toHaveCount(0);

    const outputDirectory = path.join(process.cwd(), "output", "playwright");
    mkdirSync(outputDirectory, { recursive: true });
    await page.screenshot({
      path: path.join(outputDirectory, "full-site-persisted-on-phone.png"),
      fullPage: true,
    });
  });
});

async function openCompanion(page: Page, destination: string, ready: RegExp) {
  await page.goto(`/surface/companion?next=${encodeURIComponent(destination)}`, {
    waitUntil: "commit",
  });
  await expectPageReady(page, ready);
}

async function markCurrentDocument(page: Page) {
  return page.evaluate(() => {
    const marker = crypto.randomUUID();
    document.documentElement.dataset.companionDocumentMarker = marker;
    return marker;
  });
}

async function expectCurrentDocument(page: Page, marker: string) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.companionDocumentMarker))
    .toBe(marker);
}
