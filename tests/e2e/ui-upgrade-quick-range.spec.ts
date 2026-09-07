import { expect, test } from "@playwright/test";
test.skip(process.env.PLAYWRIGHT_E2E_AUTH_BYPASS !== "1", "Authorised fixture required");
test("Quick Range retains block, note and manual labels across reload and surfaces", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/surface/workbench?next=/practice/quick-range");
  await expect(page.getByRole("button", { name: "Start", exact: true })).toBeEnabled({
    timeout: 60000,
  });
  await page.getByRole("textbox", { name: "Focus", exact: true }).fill("UI fixture range control");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByRole("button", { name: "Playable", exact: true }).click();
  await page.getByText("Add note", { exact: true }).click();
  await page
    .getByRole("textbox", { name: "Range note", exact: true })
    .fill("Retain this local fixture note");
  await page.getByRole("button", { name: "Complete block and next", exact: true }).click();
  await page.reload();
  await expect(page.locator('[aria-current="step"]')).toContainText("Build the pattern");
  for (const surface of ["workbench", "companion"]) {
    await page.goto(
      `/surface/${surface}?next=${encodeURIComponent("/practice/quick-range?club=driver&focus=Ignore%20accidental%20reset")}`,
    );
    await expect(
      page.getByRole("heading", { name: "UI fixture range control", exact: true }),
    ).toBeVisible({ timeout: 60000 });
    for (const [width, height] of [
      [1440, 900],
      [1280, 800],
      [390, 844],
      [360, 800],
      [1023, 800],
      [1024, 800],
    ]) {
      await page.setViewportSize({ width, height });
      await expect(page.locator('[aria-current="step"]')).toContainText("Build the pattern");
      await page.getByRole("button", { name: "Previous block", exact: true }).click();
      await expect(page.locator('[aria-current="step"]')).toContainText("Calibrate");
      await page.getByRole("button", { name: "Complete block and next", exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
        false,
      );
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: info.outputPath(`P16-${surface}-${width}.png`) });
    }
  }
  await page.getByRole("button", { name: "Pause session", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.getByRole("button", { name: "Finish practice", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Guidance complete", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Session note", exact: true })).toHaveValue(
    "Retain this local fixture note",
  );
  await expect(
    page.getByRole("link", { name: "Import measured session", exact: true }),
  ).toHaveAttribute("href", "/import");
  expect(errors).toEqual([]);
});
