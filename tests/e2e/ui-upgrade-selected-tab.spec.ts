import { expect, test } from "@playwright/test";
test("selected challenge status stays fully visible through viewport changes and reload", async ({
  page,
}, info) => {
  test.skip(
    process.env.PLAYWRIGHT_E2E_AUTH_BYPASS !== "1" ||
      process.env.PLAYWRIGHT_BASE_URL !== "http://localhost:3116" ||
      info.project.name !== "chromium",
  );
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const surface of ["workbench", "companion"]) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/surface/${surface}?next=${encodeURIComponent("/challenges?tab=closed")}`);
    const selected = page.getByRole("tab", { name: /Closed to entry/ });
    await expect(selected).toBeEnabled({ timeout: 60000 });
    await expect(selected).toHaveAttribute("aria-selected", "true");
    for (const [width, height] of [
      [1440, 900],
      [1280, 800],
      [390, 844],
      [360, 800],
      [1023, 800],
      [1024, 800],
    ]) {
      await page.setViewportSize({ width, height });
      await expect
        .poll(
          () =>
            selected.evaluate((el) => {
              const strip = el.closest('[role="tablist"]')!.parentElement!;
              const a = el.getBoundingClientRect(),
                b = strip.getBoundingClientRect();
              return a.left >= b.left - 1 && a.right <= b.right + 1;
            }),
          { timeout: 10000 },
        )
        .toBe(true);
      await page.screenshot({
        path: info.outputPath(`selected-${surface}-${width}.png`),
        animations: "disabled",
      });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(selected).toBeEnabled({ timeout: 60000 });
    await expect(selected).toHaveAttribute("aria-selected", "true");
  }
  expect(errors).toEqual([]);
});
