import { expect, test } from "@playwright/test";
test.skip(process.env.PLAYWRIGHT_E2E_AUTH_BYPASS !== "1", "Authorised fixture required");
test("Equipment exposes complete forms and preserves cancelled changes", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const surface of ["workbench", "companion"]) {
    await page.goto(`/surface/${surface}?next=/equipment`);
    await expect(page.locator("[data-url-tabs]")).toHaveAttribute("data-ready", "true", {
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
      for (const name of [
        "Current setup",
        "Order & snapshots",
        "Edit equipment",
        "Changes & projections",
        "History & retired clubs",
      ]) {
        const tab = page.getByRole("tab", { name, exact: true });
        await tab.click();
        await expect(tab).toHaveAttribute("aria-selected", "true");
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        ).toBe(false);
      }
      await page.getByRole("tab", { name: "Edit equipment", exact: true }).click();
      await page.getByRole("button", { name: "Add club specification", exact: true }).click();
      let sheet = page.getByRole("dialog");
      await expect(sheet.getByLabel("Effective from", { exact: true })).toBeVisible();
      await sheet.getByLabel("Shaft", { exact: true }).fill("UI check draft - do not save");
      await sheet.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(sheet).toHaveCount(0);
      await page.getByRole("button", { name: "Add ball model", exact: true }).click();
      sheet = page.getByRole("dialog");
      await sheet.getByLabel("Model", { exact: true }).fill("UI check draft - do not save");
      await sheet.getByRole("button", { name: "Cancel", exact: true }).click();
      await page.getByRole("tab", { name: "Current setup", exact: true }).click();
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: info.outputPath(`P13-${surface}-${width}.png`) });
    }
    await page.setViewportSize({ width: 360, height: 800 });
    await page.getByRole("tab", { name: "Order & snapshots", exact: true }).click();
    await page.getByLabel("Snapshot label", { exact: true }).fill("Retain draft");
    await page.getByRole("tab", { name: "Edit equipment", exact: true }).click();
    await page.getByRole("tab", { name: "Order & snapshots", exact: true }).click();
    await expect(page.getByLabel("Snapshot label", { exact: true })).toHaveValue("Retain draft");
    await page.getByRole("tab", { name: "Current setup", exact: true }).click();
    await page.getByRole("button", { name: "Retire", exact: true }).first().click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("shots and dated setup history stay available");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  }
  expect(errors).toEqual([]);
});
