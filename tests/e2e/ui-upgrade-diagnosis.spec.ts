import { expect, test } from "@playwright/test";
test.skip(process.env.PLAYWRIGHT_E2E_AUTH_BYPASS !== "1", "Authorised fixture required");
test("Club diagnosis preserves a selected record across table and mobile drill details", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const surface of ["workbench", "companion"]) {
    await page.goto(`/surface/${surface}?next=/coach/diagnosis`);
    await expect(
      page.getByRole("heading", { name: "Club improvement centre", exact: true }),
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
      await page.getByRole("combobox", { name: "Order", exact: true }).selectOption("trust");
      await page
        .getByRole("region", { name: "Ranked club drills", exact: true })
        .getByRole("button")
        .first()
        .click();
      await expect(
        page.getByRole("link", { name: "Practise with this club", exact: true }),
      ).toHaveAttribute("href", /\/practice\?club=/);
      await expect(page).toHaveURL(/clubId=/);
      await page.getByRole("button", { name: "Close diagnosis", exact: true }).click();
      await page
        .getByRole("textbox", { name: "Search clubs", exact: true })
        .fill("NO_MATCH_UI_FIXTURE");
      await expect(page.getByText("No clubs match these filters.", { exact: false })).toBeVisible();
      await page.getByRole("textbox", { name: "Search clubs", exact: true }).fill("");
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
        false,
      );
      await expect(page.locator("h1")).toHaveCount(1);
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: info.outputPath(`P18-${surface}-${width}.png`) });
    }
  }
  expect(errors).toEqual([]);
});
