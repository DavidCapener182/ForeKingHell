import { expect, test } from "@playwright/test";
test("Session comparison exposes complete filters and evidence on both surfaces", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(180000);
  page.setDefaultNavigationTimeout(60000);
  page.setDefaultTimeout(10000);
  for (const surface of ["workbench", "companion"]) {
    await page.goto(`/surface/${surface}?next=/analyse/compare`);
    await expect(page.getByRole("heading", { name: "Compare sessions", exact: true })).toBeVisible({
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
      await page.getByRole("button", { name: /^Focus session/ }).click();
      await page
        .getByRole("textbox", { name: "Search focus session", exact: true })
        .fill("no such synthetic session");
      await expect(page.getByRole("dialog")).toContainText("No matching session");
      await page.getByRole("button", { name: "Close session search", exact: true }).click();
      await page.getByRole("button", { name: /^Filters \(/ }).click();
      await expect(
        page.getByRole("dialog").getByRole("combobox", { name: "Club", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Close filters", exact: true }).click();
      const metric = page.getByRole("combobox", { name: "Selected metric", exact: true });
      await metric.selectOption({ index: 1 });
      const selected = await metric.inputValue();
      await page.getByRole("radio", { name: "Overlay", exact: true }).click();
      await page.reload();
      await expect(metric).toHaveValue(selected);
      await expect(page.getByRole("img", { name: /Dispersion overlay with/ })).toBeVisible();
      await page.getByText("Exact plotted shot values", { exact: true }).click();
      await expect(
        page.getByRole("region", { name: "Plotted focus and baseline shot values" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Evidence & method", exact: true }).first().click();
      await expect(page.getByRole("dialog")).toContainText("Source");
      await page.getByRole("button", { name: "Close evidence", exact: true }).click();
      await page.getByRole("button", { name: "Save comparison", exact: true }).first().click();
      await page
        .getByRole("dialog")
        .getByRole("textbox", { name: "Name", exact: true })
        .fill("Synthetic unsaved comparison");
      await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(page.getByRole("dialog")).toBeHidden();
      await expect(page.locator("h1")).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
        false,
      );
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({
        path: info.outputPath(`P23-${surface}-${width}.png`),
        animations: "disabled",
      });
    }
  }
});
