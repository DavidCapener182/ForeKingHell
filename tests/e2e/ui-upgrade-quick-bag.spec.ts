import { expect, test } from "@playwright/test";
test.skip(process.env.PLAYWRIGHT_E2E_AUTH_BYPASS !== "1", "Authorised fixture required");
test("Quick Bag keeps the target, units and complete evidence", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const surface of ["workbench", "companion"]) {
    await page.goto(`/surface/${surface}?next=/quick-bag`);
    await expect(page.locator("[data-quick-bag-hydrated]").first()).toHaveAttribute(
      "data-quick-bag-hydrated",
      "true",
      { timeout: 60000 },
    );
    for (const [width, height] of [
      [1440, 900],
      [1280, 800],
      [390, 844],
      [360, 800],
      [1023, 800],
      [1024, 800],
    ]) {
      await page.setViewportSize({ width, height });
      const target = page.getByRole("spinbutton", { name: "Target distance", exact: true });
      await target.fill("150");
      const before = await page.locator("[data-quick-bag-answer] h2").textContent();
      await page.getByRole("button", { name: "Use metres", exact: true }).click();
      await expect(target).toHaveValue("137.16");
      await expect(page.locator("[data-quick-bag-answer] h2")).toHaveText(before!);
      await page.getByRole("button", { name: "Use yards", exact: true }).click();
      await expect(target).toHaveValue("150");
      // Metric preset labels are rounded for display; their ranking target stays
      // the exact yard preset rather than converting the rounded label back.
      await page.getByRole("button", { name: "Use metres", exact: true }).click();
      const presets = page.locator('[aria-label="Quick target distances"]');
      await presets.getByRole("button", { name: "91.4", exact: true }).click();
      await expect(presets.getByRole("button", { name: "91.4", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      const presetAnswer = await page.locator("[data-quick-bag-answer] h2").textContent();
      for (let switchCount = 0; switchCount < 3; switchCount++) {
        await page.getByRole("button", { name: "Use yards", exact: true }).click();
        await expect(target).toHaveValue("100");
        await expect(presets.getByRole("button", { name: "100", exact: true })).toHaveAttribute(
          "aria-pressed",
          "true",
        );
        await expect(page.locator("[data-quick-bag-answer] h2")).toHaveText(presetAnswer!);
        await page.getByRole("button", { name: "Use metres", exact: true }).click();
        await expect(target).toHaveValue("91.44");
        await expect(presets.getByRole("button", { name: "91.4", exact: true })).toHaveAttribute(
          "aria-pressed",
          "true",
        );
      }
      await target.fill("100");
      await page.getByRole("button", { name: "Use yards", exact: true }).click();
      await expect(target).toHaveValue("109.361");
      await expect(presets.getByRole("button", { name: "100", exact: true })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      await page.getByRole("button", { name: "Use metres", exact: true }).click();
      await expect(target).toHaveValue("100");
      await page.getByRole("button", { name: "Use yards", exact: true }).click();
      await target.fill("150");
      const trigger = page.getByRole("button", { name: "See club evidence", exact: true });
      await trigger.click();
      const sheet = page.getByRole("dialog");
      await expect(sheet).toBeVisible();
      await expect(sheet.getByText("Latest evidence", { exact: true })).toBeVisible();
      await sheet.getByRole("button", { name: "Close club evidence", exact: true }).click();
      await expect(target).toHaveValue("150");
      await expect(trigger).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
        false,
      );
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: info.outputPath(`P12-${surface}-${width}.png`) });
    }
    await page.getByText("Saved bag reference · carry and total", { exact: true }).click();
    await expect(page.getByText(/Snapshot time is not a new measurement/).first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});
