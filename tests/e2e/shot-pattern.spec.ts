import { expect, test } from "@playwright/test";

import { authStorageState, expectPageReady, skipWhenNoAuth } from "./helpers";

test.describe("shot pattern overlay", () => {
  test.use(authStorageState ? { storageState: authStorageState } : {});

  test("opens a mapped course shot pattern and supports core toggles", async ({ page }) => {
    test.setTimeout(120_000);
    skipWhenNoAuth();

    const directPatternUrl = process.env.PLAYWRIGHT_SHOT_PATTERN_URL;

    if (directPatternUrl) {
      await page.goto(directPatternUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
    } else {
      await page.goto("/courses", { waitUntil: "domcontentloaded", timeout: 90_000 });
      await expectPageReady(page, /Courses/i);

      const patternLink = page.getByRole("link", { name: /pattern/i }).first();

      if ((await patternLink.count()) === 0) {
        test.skip(true, "No mapped course with shot-pattern link is available in this auth state.");
      }

      await patternLink.click();
    }

    await expectPageReady(page, /shot pattern/i);
    await expect(page.getByText("Shot Pattern Overlay")).toBeVisible();
    await expect(page.getByText("Target line", { exact: true })).toBeVisible();
    await expect(page.getByRole("spinbutton", { name: "Playing length yards" })).toBeVisible();
    await expect(page.getByRole("slider", { name: "Target distance" })).toBeVisible();
    await expect(page.getByRole("slider", { name: "Aim offset" })).toBeVisible();
    await expect(page.getByText(/Worst miss/i)).toBeVisible();
    await expect(page.getByText(/Best 90%/).first()).toBeVisible();
    const clubOptions = await page
      .getByRole("combobox", { name: "Club" })
      .locator("option")
      .allTextContents();
    expect(clubOptions.every((option) => !/\ball\b/i.test(option))).toBe(true);

    await page.getByRole("spinbutton", { name: "Playing length yards" }).fill("420");
    await expect(page.getByText("420 yd playing").first()).toBeVisible();
    await page.getByRole("button", { name: "Reset" }).click();

    await page.getByRole("spinbutton", { name: "Target distance yards" }).fill("160");
    await expect
      .poll(async () =>
        page.getByRole("combobox", { name: "Club" }).evaluate((select) => {
          const clubSelect = select as HTMLSelectElement;
          return clubSelect.selectedOptions[0]?.textContent ?? "";
        }),
      )
      .toContain("TaylorMade Qi 5i");
    await expect(page.getByText("Swing").first()).toBeVisible();
    await expect(page.getByText(/~\d+%/).first()).toBeVisible();

    await page.getByRole("spinbutton", { name: "Target distance yards" }).fill("225");
    await expect(page.getByText("225 yd").first()).toBeVisible();
    await page.getByRole("spinbutton", { name: "Aim offset yards" }).fill("45");
    await expect(page.getByText("45R").first()).toBeVisible();
    await expect(page.getByText("Aim 45R").first()).toBeVisible();
    await page.getByRole("spinbutton", { name: "Target distance yards" }).fill("431");
    await expect(page.getByText("Out of range").first()).toBeVisible();

    await page.getByRole("button", { name: "Carry" }).click();
    await expect(page.getByText("Carry").first()).toBeVisible();

    await page.getByRole("button", { name: "All shots" }).click();
    await expect(page.getByText(/All shots/).first()).toBeVisible();
  });
});
