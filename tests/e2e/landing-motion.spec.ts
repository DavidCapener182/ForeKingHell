import { expect, test } from "@playwright/test";

test("entrances finish after stopping and remain readable when revisited", async ({
  page,
}, info) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    await expect(page.locator("main#product")).toHaveAttribute("data-marketing-motion", "ready");
    const copy = page.locator("#how-it-works [data-marketing-reveal]").first();
    await expect(copy).toHaveCSS("opacity", "0");
    // Place the heading only just inside the viewport, then stop scrolling.
    await copy.evaluate((element) =>
      window.scrollBy({
        top: element.getBoundingClientRect().top - innerHeight * 0.65,
        behavior: "instant",
      }),
    );
    await expect(copy).toHaveCSS("opacity", "1");
    await expect(copy).toHaveCSS("transform", "none");
    await expect(copy).toHaveCSS("filter", "none");
    const stoppedY = await page.evaluate(() => scrollY);
    await page.screenshot({ path: info.outputPath(`reveal-${viewport.width}.png`) });
    expect(await page.evaluate(() => scrollY)).toBe(stoppedY);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect(copy).toHaveCSS("opacity", "1");
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), stoppedY);
    await expect(copy).toHaveCSS("transform", "none");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      viewport.width + 1,
    );
  }
});

test("deep links, progress and keyboard focus expose usable content", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#pricing");
  const pricing = page.locator("#pricing [data-marketing-reveal]");
  await expect(pricing.first()).toHaveCSS("opacity", "1");
  await expect(
    page
      .getByRole("navigation", { name: "Public product navigation" })
      .getByRole("link", { name: "Pricing" }),
  ).toHaveAttribute("aria-current", "location");
  await expect(page.locator('[class*="readingProgress"]')).not.toHaveCSS(
    "transform",
    "matrix(0, 0, 0, 1, 0, 0)",
  );
  const skipLink = page.getByRole("link", { name: "Skip to product introduction" });
  await expect(skipLink).toHaveCSS("clip-path", "inset(50%)");
  await skipLink.focus();
  await expect(skipLink).toHaveCSS("clip-path", "none");
  await skipLink.blur();

  // Keyboard focus skips decorative delay, including content not yet scrolled to.
  const question = page.locator("#faq summary").first();
  await question.focus();
  const reveal = page
    .locator("#faq [data-marketing-reveal]")
    .filter({ has: page.locator("summary", { hasText: "Which launch monitors are supported?" }) });
  await expect(reveal).toHaveCSS("opacity", "1");
  await expect(reveal).toHaveCSS("transition-duration", "0s");
  await question.press("Enter");
  await expect(page.locator("#faq details").first().locator("p")).toBeVisible();
  await question.press("Enter");
  await expect(page.locator("#faq details").first()).not.toHaveAttribute("open", "");
  expect(errors).toEqual([]);
});

test("changing reduced-motion preference exposes all copy and removes movement", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(page.locator("main#product")).toHaveAttribute("data-marketing-motion", "ready");
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const reveal of await page.locator("[data-marketing-reveal]").all()) {
    await expect(reveal).toHaveCSS("opacity", "1");
    await expect(reveal).toHaveCSS("transform", "none");
  }
  await expect(page.locator("#hero-title b").first()).toHaveCSS("animation-name", "none");
  await expect(page.locator('[class*="readingProgress"]')).toBeHidden();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator("#pricing [data-marketing-reveal]").first()).toHaveCSS("opacity", "1");
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("keeps hero, plans and FAQ readable", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#hero-title")).toBeVisible();
    await expect(page.locator("#hero-title b").first()).toHaveCSS("opacity", "1");
    for (const reveal of await page.locator("[data-marketing-reveal]").all()) {
      await expect(reveal).toHaveCSS("opacity", "1");
    }
    await page.locator("#faq summary").first().click();
    await expect(page.locator("#faq details").first().locator("p")).toBeVisible();
    await expect(page.locator("#pricing article")).toHaveCount(4);
  });
});

test("every chapter keeps text and actions inside its layout", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator("#course-twin")).toBeAttached();
    for (const [id, selector] of [
      ["hero", "section[aria-labelledby='hero-title']"],
      ["how-it-works", "#how-it-works"],
      ["course-twin", "#course-twin"],
      ["practice", "#practice"],
      ["product-screens", "#product-screens"],
      ["features", "#features"],
      ["privacy", "#privacy"],
      ["pricing", "#pricing"],
      ["closing", "section[aria-labelledby='beta-title']"],
      ["faq", "#faq"],
      ["footer", "main > footer"],
    ]) {
      const section = page.locator(selector);
      await section.scrollIntoViewIfNeeded();
      await expect(section).toBeVisible();
      const outsideHeadings = await section.evaluate((root) => {
        const bounds = root.getBoundingClientRect();
        return Array.from(root.querySelectorAll("h1, h2, h3"))
          .filter((heading) => {
            const rect = heading.getBoundingClientRect();
            return (
              rect.height > 0 && (rect.top < bounds.top - 2 || rect.bottom > bounds.bottom + 2)
            );
          })
          .map((heading) => heading.textContent);
      });
      expect(outsideHeadings, `${id} headings outside the chapter at ${viewport.width}px`).toEqual(
        [],
      );
      if (id === "how-it-works") {
        await expect(section.getByText("Keep the original shot evidence.")).toBeVisible();
      }
      if (id === "practice") {
        await expect(
          section.getByRole("link", { name: "See it in the current product" }),
        ).toBeVisible();
      }
      if (id === "hero") {
        const title = await page.locator("#hero-title").boundingBox();
        const copy = await page.locator('[class*="heroCopy"]').boundingBox();
        expect(title!.y + title!.height, `hero copy overlap at ${viewport.width}px`).toBeLessThan(
          copy!.y,
        );
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        `${id} at ${viewport.width}px`,
      ).toBeLessThanOrEqual(viewport.width + 1);
      // Content-led chapters must not trap a long plan inside an inner scroller.
      if (id !== "course-twin") {
        const clipped = await section.evaluate((root) =>
          Array.from(root.querySelectorAll<HTMLElement>("div, article"))
            .filter((element) => {
              const style = getComputedStyle(element);
              return (
                style.display !== "none" &&
                element.clientHeight > 0 &&
                element.scrollHeight > element.clientHeight + 3 &&
                ["hidden", "clip", "auto", "scroll"].includes(style.overflowY) &&
                element.querySelector("a, button, summary")
              );
            })
            .map((element) => element.className),
        );
        expect(clipped, `${id} clipped actions at ${viewport.width}px`).toEqual([]);
      }
      await section.screenshot({ path: info.outputPath(`${id}-${viewport.width}.png`) });
    }
    await page.locator("#faq summary").last().click();
    await expect(page.locator("#faq details").last().locator("p")).toBeVisible();
    await page.getByRole("button", { name: "Explore the example plan", exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "Course Twin example plan", exact: true }),
    ).toContainText("Expected carry (modelled)");
    await page.keyboard.press("Escape");
  }
});
