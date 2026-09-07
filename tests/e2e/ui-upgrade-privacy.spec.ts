import { expect, test } from "@playwright/test";

test("Data notice exposes full factual sections and practical controls", async ({ page }, info) => {
  test.skip(
    process.env.PLAYWRIGHT_BASE_URL !== "http://localhost:3116" || info.project.name !== "chromium",
  );
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const [width, height] of [
    [1440, 900],
    [1280, 800],
    [390, 844],
    [360, 800],
    [1023, 800],
    [1024, 800],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/privacy", { waitUntil: "domcontentloaded", timeout: 90000 });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("LM World Tour data notice");
    for (const name of [
      "Data stored",
      "Account scope and sharing",
      "AI coaching and Data Chat",
      "Scorecard images",
      "Product analytics",
      "Export, reset and account deletion",
      "Your practical controls",
    ]) {
      await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    }
    await expect(page.getByText(/NEXT_PUBLIC_|DATABASE_URL|Public launch gate/)).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Privacy settings", exact: true })).toHaveAttribute(
      "href",
      "/settings?section=privacy",
    );
    for (const [name, section] of [
      ["Review export options", "data"],
      ["Review shared access", "sharing"],
      ["Review reset and deletion", "danger"],
    ]) {
      const link = page.getByRole("link", { name, exact: true });
      await expect(link).toHaveAttribute("href", `/settings?section=${section}`);
      await link.focus();
      await expect(link).toBeFocused();
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await expect(page.getByText(/opening a settings link does not delete anything/)).toBeVisible();
    await page.getByRole("link", { name: "Data stored", exact: true }).click();
    await expect(page).toHaveURL(/#stored-data$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: info.outputPath(`P86-public-${width}.png`), fullPage: true });
  }
  expect(errors).toEqual([]);
});
