import { expect, test } from "@playwright/test";

test.describe("public product landing", () => {
  test("shows the product journey, CTAs, sample tour and FAQ without sign-in", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Turn every measured shot/i })).toBeVisible();
    if ((page.viewportSize()?.width ?? 1024) < 1024) {
      await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
    } else {
      await expect(
        page.getByRole("navigation", { name: "Public product navigation" }),
      ).toBeVisible();
    }
    await expect(page.getByRole("link", { name: "Join the beta" }).first()).toHaveAttribute(
      "href",
      /next=%2Fwelcome/,
    );
    await page.getByRole("link", { name: "Explore the sample tour" }).click();
    await expect(page.getByRole("heading", { name: /See the decision chain/i })).toBeVisible();
    await page.getByRole("button", { name: "7 Iron" }).click();
    await page.getByRole("button", { name: "Raw shots" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: /Which launch monitors are supported/i }).click();
    await expect(page.getByText("Rapsodo CSV import is available", { exact: true })).toBeVisible();
    expect(
      await page
        .locator("img")
        .evaluateAll(
          (images) =>
            images.filter(
              (image): image is HTMLImageElement =>
                image instanceof HTMLImageElement && image.complete && image.naturalWidth === 0,
            ).length,
        ),
    ).toBe(0);
    expect(errors).toEqual([]);
  });

  test("keeps the public page in bounds and exposes the accessible mobile menu", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    const width = await page.evaluate(() => ({
      viewport: window.innerWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(width.content).toBeLessThanOrEqual(width.viewport + 2);
  });

  test("keeps all public content available with reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /One connected loop/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /A mobile golf workspace/i })).toBeVisible();
  });

  test("uses composited scroll zoom without changing the document scroll model", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");

    const stage = page.locator(
      '[aria-label="Example LM World Tour product screens using demo data"]',
    );
    await expect(stage).toBeVisible();
    const rangeArt = stage.getByAltText(/Golfer using a launch monitor/i);
    const before = await rangeArt.evaluate((element) => getComputedStyle(element).transform);
    expect(await rangeArt.evaluate((element) => getComputedStyle(element).animationName)).toContain(
      "marketing-hero-range-zoom",
    );

    await page.evaluate(() => window.scrollTo({ top: Math.round(window.innerHeight * 0.45) }));
    await page.waitForTimeout(120);
    const after = await rangeArt.evaluate((element) => getComputedStyle(element).transform);

    expect(after).not.toBe(before);
    await expect(page.locator("#how-it-works")).toBeAttached();
  });
});

test.describe("public landing without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("keeps the product story and join path readable", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Turn every measured shot/i })).toBeVisible();
    await expect(
      page.getByText("Original import evidence remains traceable.", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Join the beta" }).first()).toHaveAttribute(
      "href",
      /next=%2Fwelcome/,
    );
  });
});
