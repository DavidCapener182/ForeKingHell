import { expect, test, type Page } from "@playwright/test";

async function browserSupportsWebGl(page: Page) {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl"),
    );
  });
}

async function expectInteractiveCourseTwin(
  page: Page,
  viewport: { width: number; height: number },
) {
  await page.setViewportSize(viewport);
  await page.goto("/");
  const supportsWebGl = await browserSupportsWebGl(page);
  const section = page.locator("#course-twin");
  await section.scrollIntoViewIfNeeded();

  if (!supportsWebGl) {
    await expect(section.locator("[data-course-twin-fallback]")).toBeVisible();
    return;
  }

  const runtime = section.locator("[data-course-twin-runtime]");
  await expect(runtime).toBeVisible({ timeout: 30_000 });
  await expect(runtime.locator("canvas")).toBeVisible();
  await expect(runtime.getByRole("button", { name: "3 Wood" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(runtime.getByText("214–224 yd", { exact: true })).toBeVisible();

  await runtime.getByRole("button", { name: "Driver" }).click();
  await expect(runtime.getByRole("button", { name: "Driver" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(runtime.getByText("234–249 yd", { exact: true })).toBeVisible();

  const status = runtime.locator('[aria-live="polite"]');
  await runtime.getByRole("button", { name: "Replay shot plan" }).click();
  await expect(status).toContainText(/Driver|shot|plan|replay/i);
}

test.describe("public product landing", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/security/csp-report", (route) =>
      route.fulfill({ status: 204, body: "" }),
    );
  });

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
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("button", { name: "Close navigation" }).click();
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
    const usesCompactLayout = (page.viewportSize()?.width ?? 1024) <= 767;
    const supportsViewTimeline = await page.evaluate(() =>
      CSS.supports("animation-timeline: view()"),
    );
    if (usesCompactLayout) {
      expect(await rangeArt.evaluate((element) => getComputedStyle(element).animationName)).toBe(
        "none",
      );
    } else if (supportsViewTimeline) {
      expect(
        await rangeArt.evaluate((element) => getComputedStyle(element).animationName),
      ).toContain("marketing-hero-range-zoom");
    } else {
      await expect(stage).toHaveAttribute("data-composited-scroll-zoom", "true");
    }

    if (usesCompactLayout) {
      await page.evaluate(() => window.scrollTo({ top: Math.round(window.innerHeight * 0.45) }));
    } else {
      await stage.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const stageCentre = window.scrollY + rect.top + rect.height / 2;
        window.scrollTo({ top: Math.max(0, Math.round(stageCentre - window.innerHeight / 2)) });
      });
    }
    await page.waitForTimeout(120);
    const after = await rangeArt.evaluate((element) => getComputedStyle(element).transform);

    if (usesCompactLayout) {
      expect(after).toBe(before);
    } else {
      expect(after).not.toBe(before);
    }
    await expect(page.locator("#how-it-works")).toBeAttached();
  });
});

test.describe("public landing responsive and Course Twin verification", () => {
  test("stays horizontally in bounds across the required viewport matrix", async ({
    browserName,
    page,
  }, testInfo) => {
    test.skip(
      browserName !== "chromium" || testInfo.project.name !== "chromium",
      "The explicit viewport matrix runs once in the base Chromium project.",
    );

    const viewports = [
      { width: 320, height: 720 },
      { width: 375, height: 812 },
      { width: 390, height: 844 },
      { width: 430, height: 932 },
      { width: 767, height: 900 },
      { width: 768, height: 900 },
      { width: 844, height: 390 },
    ] as const;

    await page.goto("/");
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
          }),
      );
      const widths = await page.evaluate(() => ({
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }));
      expect(widths.document, `${viewport.width}px document overflow`).toBeLessThanOrEqual(
        widths.viewport + 2,
      );
      expect(widths.body, `${viewport.width}px body overflow`).toBeLessThanOrEqual(
        widths.viewport + 2,
      );
    }
  });

  test("switches to the Apple system stack only below the desktop boundary", async ({
    browserName,
    page,
  }, testInfo) => {
    test.skip(
      browserName !== "chromium" || testInfo.project.name !== "chromium",
      "The exact CSS boundary is exercised once in Chromium.",
    );

    await page.setViewportSize({ width: 767, height: 900 });
    await page.goto("/");
    const compactFont = await page
      .locator("main#product")
      .evaluate((element) => getComputedStyle(element).fontFamily);
    expect(compactFont).toContain("-apple-system");
    expect(compactFont).toContain("SF Pro Text");

    await page.setViewportSize({ width: 768, height: 900 });
    const desktopFont = await page
      .locator("main#product")
      .evaluate((element) => getComputedStyle(element).fontFamily);
    expect(desktopFont).not.toContain("-apple-system");
    expect(desktopFont).not.toContain("SF Pro Text");
  });

  test("runs the same interactive WebGL Course Twin on mobile and desktop", async ({
    browserName,
    page,
  }, testInfo) => {
    test.skip(
      browserName !== "chromium" || testInfo.project.name !== "chromium",
      "The shared WebGL runtime is exercised once in Chromium.",
    );

    await expectInteractiveCourseTwin(page, { width: 390, height: 844 });
    await expectInteractiveCourseTwin(page, { width: 1440, height: 900 });
  });

  test("keeps the premium static plan for reduced motion", async ({
    browserName,
    page,
  }, testInfo) => {
    test.skip(
      browserName !== "chromium" || testInfo.project.name !== "chromium",
      "The fallback capability gate is exercised once in Chromium.",
    );

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const section = page.locator("#course-twin");
    await section.scrollIntoViewIfNeeded();
    await expect(section.locator("[data-course-twin-fallback]")).toBeVisible();
    await expect(section.locator("[data-course-twin-runtime]")).toHaveCount(0);
  });

  test("keeps the premium static plan when WebGL is unavailable", async ({
    browserName,
    page,
  }, testInfo) => {
    test.skip(
      browserName !== "chromium" || testInfo.project.name !== "chromium",
      "The fallback capability gate is exercised once in Chromium.",
    );

    await page.addInitScript(() => {
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        configurable: true,
        value(this: HTMLCanvasElement, contextId: string, ...args: unknown[]) {
          if (
            contextId === "webgl2" ||
            contextId === "webgl" ||
            contextId === "experimental-webgl"
          ) {
            return null;
          }
          return Reflect.apply(originalGetContext, this, [contextId, ...args]);
        },
      });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const section = page.locator("#course-twin");
    await section.scrollIntoViewIfNeeded();
    await expect(section.locator("[data-course-twin-fallback]")).toBeVisible();
    await expect(section.locator("[data-course-twin-runtime]")).toHaveCount(0);
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
