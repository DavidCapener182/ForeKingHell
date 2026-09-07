import { expect, test } from "@playwright/test";
test("Conditions retain unknown groups and scoped source proof on both surfaces", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(180000);
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(60000);
  for (const surface of ["workbench", "companion"]) {
    for (const [width, height] of [
      [1440, 900],
      [1280, 800],
      [390, 844],
      [360, 800],
      [1023, 800],
      [1024, 800],
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto(`/surface/${surface}?next=/analyse/conditions`);
      await expect(page.locator('[data-conditions-ready="true"]')).toBeVisible({ timeout: 60000 });
      await expect(
        page.getByRole("heading", { name: "Conditions analysis", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: /^Condition filters/ }).click();
      await page
        .getByRole("combobox", { name: "Condition dimension", exact: true })
        .selectOption("temperature");
      await page.getByRole("button", { name: "Apply filters", exact: true }).click();
      await expect(page).toHaveURL(/dimension=temperature/);
      await expect(page.locator('[data-conditions-ready="true"]')).toBeVisible({timeout:60000});
      await expect(page.getByRole("heading", { name: "Temperature", exact: true })).toBeVisible();
      await page.getByRole("link", { name: "Inspect unknown rows", exact: true }).click();
      await expect(page.getByRole("dialog")).toContainText("Unknown / unrecorded");
      await page.getByRole("dialog").locator("summary").first().click();
      await expect(
        page
          .getByRole("dialog")
          .getByRole("link", { name: "Inspect exact shot", exact: true })
          .first(),
      ).toHaveAttribute("href", /clubId=.*shotId=/);
      await page.getByRole("button", { name: "Close source evidence", exact: true }).click();
      await expect(page.getByRole("dialog")).toBeHidden();
      await expect(page.locator("h1")).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
        false,
      );
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({
        path: info.outputPath(`P24-${surface}-${width}.png`),
        animations: "disabled",
      });
    }
  }
});
