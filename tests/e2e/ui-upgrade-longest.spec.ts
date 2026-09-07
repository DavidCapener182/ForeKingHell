import { expect, test } from "@playwright/test";
test.skip(process.env.PLAYWRIGHT_E2E_AUTH_BYPASS !== "1", "Authorised fixture required");
test("PB board and ledger follow the same distance record", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(420000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const surface of ["workbench", "companion"]) {
    await page.goto(`/surface/${surface}?next=${encodeURIComponent("/bag")}`);
    const entry = page.locator("[data-best-shots-entry]");
    await expect(entry).toBeVisible({ timeout: 60000 });
    await entry.click();
    await expect(page).toHaveURL(/\/bag\/longest/);
    await expect(page.locator("[data-best-shots-board]")).toBeVisible({ timeout: 60000 });
    for (const [width, height] of [
      [1440, 900],
      [1280, 800],
      [390, 844],
      [360, 800],
      [1023, 800],
      [1024, 800],
    ]) {
      await page.setViewportSize({ width, height });
      for (const metric of ["total", "carry"]) {
        const buttons = page.getByRole("button", { name: new RegExp(`longest ${metric}:`) });
        const count = await buttons.count();
        expect(count).toBeGreaterThan(0);
        const visited = new Set<string>();
        for (let index = 0; index < count; index++) {
          const button = buttons.nth(index);
          const label = (await button.getAttribute("aria-label"))!;
          const clubName = label.split(` longest ${metric}:`)[0];
          await button.click();
          await expect(button).toHaveAttribute("aria-pressed", "true");
          await expect(
            page
              .getByRole("complementary", { name: "Selected shot evidence" })
              .getByRole("heading", { name: `${clubName} · ${metric} record`, exact: true }),
          ).toBeVisible();
          const url = new URL(page.url());
          expect(url.searchParams.get("metric")).toBe(metric);
          const clubId = url.searchParams.get("club");
          expect(clubId).toMatch(/^[0-9a-f-]{36}$/i);
          visited.add(clubId!);
          await expect(page.locator("[data-pb-evidence-metric]")).toHaveAttribute(
            "data-pb-evidence-metric",
            metric,
          );
          await expect(
            page.getByRole("heading", {
              name: `${metric === "carry" ? "Carry" : "Total"} PB evidence board`,
              exact: true,
            }),
          ).toBeVisible();
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
          ).toBe(false);
        }
        expect(visited.size).toBe(count);
      }
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: info.outputPath(`P11-${surface}-${width}.png`) });
    }
    await page.setViewportSize({ width: 360, height: 800 });
    await page.getByRole("button", { name: "Full evidence", exact: true }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("tab", { name: "Source", exact: true })).toBeVisible({
      timeout: 30000,
    });
    await sheet.getByRole("button", { name: "Close evidence", exact: true }).click();
    await page.reload();
    await expect(page.locator("[data-pb-evidence-metric]")).toHaveAttribute(
      "data-pb-evidence-metric",
      "carry",
    );
  }
  expect(errors).toEqual([]);
});
