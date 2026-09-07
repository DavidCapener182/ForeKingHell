import { expect, test } from "@playwright/test";
test.skip(process.env.PLAYWRIGHT_E2E_AUTH_BYPASS !== "1", "Authorised fixture required");
test("Report draft retains selected scope through privacy and review on both surfaces", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const surface of ["workbench", "companion"]) {
    await page.goto(`/surface/${surface}?next=/coach/reports`);
    await expect(page.getByRole("heading", { name: "Coach reports", exact: true })).toBeVisible({
      timeout: 60000,
    });
    for (const [width, height] of [
      [1440, 900],
      [1280, 800],
      [390, 844],
      [360, 800],
      [1023, 800],
      [1024, 800],
    ]) {
      await page.setViewportSize({ width, height });
      await page
        .getByRole("textbox", { name: "Report title (optional)", exact: true })
        .fill("UI report draft - never create");
      await page.getByRole("button", { name: "Continue to privacy", exact: true }).click();
      await expect(
        page.getByRole("group", { name: "Privacy and expiry", exact: true }),
      ).toBeVisible({ timeout: 10000 });
      await page.locator("select[name=expiryDays]").selectOption("7");
      await page.getByRole("button", { name: "Review report", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Review frozen report", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "UI report draft - never create", exact: true }),
      ).toBeVisible();
      await expect(page.getByText(/sections · expires in 7 days/)).toBeVisible();
      await page.getByRole("button", { name: "Back to draft", exact: true }).click();
      await page.getByRole("button", { name: "Back to evidence", exact: true }).click();
      await expect(
        page.getByRole("textbox", { name: "Report title (optional)", exact: true }),
      ).toHaveValue("UI report draft - never create");
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
        false,
      );
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: info.outputPath(`P19-${surface}-${width}.png`) });
    }
  }
  expect(errors).toEqual([]);
});
