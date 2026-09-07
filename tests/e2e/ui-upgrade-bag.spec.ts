import { expect, test } from "@playwright/test";
test.skip(process.env.PLAYWRIGHT_E2E_AUTH_BYPASS !== "1", "Authorised local fixture required");
test("Bag provides six retained tasks on both surfaces", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.stack ?? e.message));
  for (const surface of ["workbench", "companion"]) {
    await page.goto(`/surface/${surface}?next=${encodeURIComponent("/bag")}`);
    await expect(page.getByRole("heading", { level: 1, name: "Bag", exact: true })).toBeVisible({
      timeout: 90000,
    });
    await expect(page.locator("[data-url-tabs]")).toHaveAttribute("data-ready", "true");
    for (const [width, height] of [
      [1440, 900],
      [1280, 800],
      [390, 844],
      [360, 800],
      [1023, 800],
      [1024, 800],
    ]) {
      await page.setViewportSize({ width, height });
      for (const label of ["Distances", "Clubs", "Scoring", "Fitting", "History", "Evidence"]) {
        const tab = page.getByRole("tab", { name: label, exact: true });
        await tab.click();
        await expect(tab).toHaveAttribute("aria-selected", "true");
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        ).toBe(false);
      }
      await page.getByRole("tab", { name: "Distances", exact: true }).click();
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: info.outputPath(`P08-${surface}-${width}.png`) });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("tab", { name: "Fitting", exact: true }).click();
    await page.getByText("Fitting experiment tools", { exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Reset to saved bag", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Adjust bag change", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Bag simulator settings" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("tab", { name: "History", exact: true }).click();
    await page.reload();
    await expect(page.getByRole("tab", { name: "History", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  }
  expect(errors).toEqual([]);
});
test("Bag stock sample drawer retains full evidence controls", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(120000);
  await page.goto("/surface/companion?next=%2Fbag%3Ftab%3Dclubs");
  await expect(page.locator("[data-url-tabs]")).toHaveAttribute("data-ready", "true", {
    timeout: 60000,
  });
  await page.getByText("Club supporting tools", { exact: true }).click();
  await page.getByRole("button", { name: /Best-stock filters/ }).click();
  await page.getByRole("button", { name: "Review stock sample", exact: true }).first().click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  for (const [width, height] of [
    [1440, 900],
    [1280, 800],
    [390, 844],
    [360, 800],
    [1023, 800],
    [1024, 800],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(
      sheet.getByRole("button", { name: "Close sample review", exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: info.outputPath(`P08-stock-${width}.png`) });
  }
  await sheet.getByRole("searchbox").fill("no-stock-match-876");
  await expect(sheet).toContainText("No matching sample rows");
  await sheet.getByRole("button", { name: "Reset sample view", exact: true }).click();
  await expect(
    sheet.getByRole("button", { name: "Full evidence", exact: true }).first(),
  ).toBeVisible();
  await sheet.getByRole("button", { name: "Close sample review", exact: true }).click();
});
test("Bag target reset and pattern controls", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(120000);
  await page.goto("/surface/companion?next=%2Fbag%3Ftab%3Dclubs");
  await expect(page.locator("[data-url-tabs]")).toHaveAttribute("data-ready", "true", {
    timeout: 60000,
  });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByText("Club supporting tools", { exact: true }).click();
  const input = page.locator("#target-distance-yards");
  await input.fill("200");
  await expect(input).toHaveValue("200");
  await input.blur();
  await page.getByRole("button", { name: "Reset target", exact: true }).click();
  await expect(input).toHaveValue("150");
  await page.getByRole("tab", { name: "Scoring", exact: true }).click();
  await page.getByText("Scoring supporting evidence", { exact: true }).click();
  const layers = page.getByRole("button", { name: "Pattern layers", exact: true });
  if (await layers.count()) {
    await layers.click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("checkbox", { name: "Measured window", exact: true }).uncheck();
    await sheet.getByRole("button", { name: "Close layers", exact: true }).click();
    await expect(page.locator('[data-pattern-layer="window"]')).not.toBeVisible();
    await layers.click();
    await sheet.getByRole("button", { name: "Reset layers", exact: true }).click();
    await sheet.getByRole("button", { name: "Close layers", exact: true }).click();
    await expect(page.locator('[data-pattern-layer="window"]')).toBeVisible();
  } else {
    test.info().annotations.push({
      type: "fixture gap",
      description: "No qualified pattern overlays in this fixture",
    });
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
    false,
  );
  await page.screenshot({ path: info.outputPath("P08-scoring-controls-360.png") });
});
