import { expect, test, type Page } from "@playwright/test";

import { expectPageReady, skipWhenNoAuth } from "./helpers";

test.describe("Driver Speed Development", () => {
  test("connects the desktop programme, dashboard, Training Load and Practice", async ({
    page,
  }) => {
    skipWhenNoAuth();
    test.setTimeout(180_000);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/speed", { waitUntil: "domcontentloaded" });
    await expectPageReady(page, /Driver Speed Development/i);

    const programme = page.locator("[data-driver-speed-development]");
    await expect(programme).toBeVisible();
    await expect(programme.locator("[data-speed-project-readiness]")).toBeVisible();
    await expect(programme.locator("[data-speed-transfer-funnel]")).toBeVisible();
    await expect(programme.locator("[data-speed-chaos]")).toBeVisible();
    await expect(programme.locator("[data-speed-session-plan]")).toBeVisible();
    await expect(programme.locator("[data-speed-ladder]")).toBeVisible();
    await expect(
      programme.getByRole("link", { name: /Open recommended session/i }),
    ).toHaveAttribute("href", "/practice?session=speed&intent=speed&time=20");
    await expectNoHorizontalOverflow(page, "Speed Centre");

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expectPageReady(page, /Dashboard|Today/i);
    const dashboardCard = page.locator("[data-dashboard-speed-development]");
    await expect(dashboardCard).toBeVisible();
    await expect(dashboardCard).toContainText("Next physical target");
    await expect(dashboardCard).toContainText("Next performance target");
    await expect(dashboardCard).toContainText("Speed readiness");

    await page.goto("/stats/training-over-time", { waitUntil: "domcontentloaded" });
    await expectPageReady(page, /Training Load/i);
    const readiness = page.locator("#speed-readiness");
    await expect(readiness).toBeVisible();
    await expect(readiness).toContainText(/Readiness score|Speed Readiness/i);

    await page.goto("/practice?session=speed&intent=speed&time=20", {
      waitUntil: "domcontentloaded",
    });
    await expectPageReady(page, /Practice Planner/i);
    await expect(page.getByText("Speed warm-up", { exact: true })).toBeVisible();
    await expect(page.getByText("Speed Block 2", { exact: true })).toBeVisible();
    await expect(page.getByText("Driver transfer", { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page, "Speed Practice workbench");
  });

  test("keeps the phone experience in Practice with the speed decision first", async ({ page }) => {
    skipWhenNoAuth();

    await page.setViewportSize({ width: 390, height: 844 });
    const speedPractice = "/practice?session=speed&intent=speed&time=20";
    await page.goto(`/surface/companion?next=${encodeURIComponent(speedPractice)}`, {
      waitUntil: "commit",
    });
    await expectPageReady(page, /Practice/i);

    const readout = page.locator("[data-speed-development-readout]");
    const practicePlan = page.locator("[data-current-practice-plan]");
    await expect(readout).toBeVisible();
    await expect(readout).toContainText(/Project|Speed development/i);
    await expect(practicePlan).toBeVisible();
    await expect
      .poll(async () => {
        const readoutBox = await readout.boundingBox();
        const planBox = await practicePlan.boundingBox();
        return readoutBox && planBox ? readoutBox.y < planBox.y : false;
      })
      .toBe(true);
    await expectNoHorizontalOverflow(page, "Speed Practice companion");
  });
});

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  expect(dimensions.scrollWidth, `${label} should not overflow horizontally`).toBeLessThanOrEqual(
    dimensions.clientWidth + 1,
  );
}
