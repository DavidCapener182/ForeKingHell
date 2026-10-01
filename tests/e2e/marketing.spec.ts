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

  if (viewport.width < 768 || !supportsWebGl) {
    await section.getByRole("button", { name: "Explore the example plan" }).click();
    const dialog = page.getByRole("dialog", { name: "Course Twin example plan" });
    await expect(dialog.locator("[data-course-twin-fallback]")).toBeVisible();
    await expect(dialog.getByText("Expected carry (modelled)", { exact: true })).toBeVisible();
    await expect(section.locator("[data-course-twin-runtime]")).toHaveCount(0);
    await page.keyboard.press("Escape");
    return;
  }
  await section.getByRole("button", { name: "Launch interactive example" }).click();

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

  test("shows the product journey, CTAs, product screens and FAQ without sign-in", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Stop guessing.*Start knowing/i }),
    ).toBeVisible();
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
    await page.getByRole("link", { name: /See the system/ }).click();
    await expect(page.locator("#promise-title")).toHaveText(/Your numbers should do more/);
    const screens = page.locator("#product-screens");
    await screens.scrollIntoViewIfNeeded();
    await expect(screens.getByRole("heading", { level: 3 })).toHaveCount(3);
    await page.locator("#faq").scrollIntoViewIfNeeded();
    await page
      .locator("#faq summary")
      .filter({ hasText: "Which launch monitors are supported?" })
      .click();
    await expect(page.getByText(/Rapsodo CSV import is available/)).toBeVisible();
    expect(
      await page
        .locator("img")
        .evaluateAll(
          (images) =>
            images.filter(
              (image): image is HTMLImageElement =>
                image instanceof HTMLImageElement &&
                image.currentSrc !== "" &&
                image.complete &&
                image.naturalWidth === 0,
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
    await expect(page.getByRole("heading", { name: /Your numbers should do more/i })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /See the decision chain in the product/i }),
    ).toBeVisible();
  });

  test("keeps compact product screens readable through keyboard scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const screens = page.locator("#product-screens");
    await screens.scrollIntoViewIfNeeded();
    const images = screens.getByRole("img", { name: /LM World Tour/ });
    await expect(images).toHaveCount(3);
    for (const image of await images.all()) {
      await image.scrollIntoViewIfNeeded();
      await expect(image).toBeVisible();
      const bounds = await image.boundingBox();
      expect(bounds!.width).toBeLessThanOrEqual(390);
    }
    await page.keyboard.press("End");
    await expect(page.locator("footer[data-mobile-cta-stop]")).toBeInViewport();
  });

  test("keeps reduced-motion practice stages readable without animation", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const practice = page.locator("#practice");
    await practice.scrollIntoViewIfNeeded();
    const stages = practice.locator("[data-practice-step]");
    await expect(stages).toHaveCount(4);
    for (const stage of await stages.all()) {
      await expect(stage).toBeVisible();
      await expect(stage).toHaveCSS("opacity", "1");
    }
    await expect(practice.getByRole("article", { name: "Today's practice plan" })).toBeVisible();
  });

  test("keeps the compact CTA clear of the footer at the exact breakpoint", async ({ page }) => {
    await page.setViewportSize({ width: 767, height: 900 });
    await page.goto("/");
    await page.getByRole("button", { name: "Essential only", exact: true }).click();
    await expect(page.getByRole("region", { name: "Cookies & privacy" })).toBeHidden();
    await page.locator("#how-it-works").evaluate((element) =>
      window.scrollTo({
        top: window.scrollY + element.getBoundingClientRect().top + 200,
        behavior: "instant",
      }),
    );
    const dock = page.locator("[data-mobile-cta]");
    await expect(dock).toBeVisible();
    await expect
      .poll(async () => (await dock.boundingBox())!.y + (await dock.boundingBox())!.height)
      .toBeCloseTo(900, 0);
    await expect(dock.getByRole("link", { name: /Join the beta/ })).toHaveAttribute(
      "href",
      /next=%2Fwelcome/,
    );
    await page.locator("footer[data-mobile-cta-stop]").scrollIntoViewIfNeeded();
    await expect(dock).toBeHidden();
    await page.setViewportSize({ width: 768, height: 900 });
    await page.locator("#how-it-works").evaluate((element) =>
      window.scrollTo({
        top: window.scrollY + element.getBoundingClientRect().top + 200,
        behavior: "instant",
      }),
    );
    await expect(dock).toBeHidden();
  });

  test("uses composited hero motion without changing the document scroll model", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    const hero = page.locator('section[aria-labelledby="hero-title"]');
    const art = hero.locator("[data-hero-layer]").first();
    const before = await art.evaluate((element) => getComputedStyle(element).transform);
    await page.evaluate(() =>
      window.scrollTo({ top: Math.round(innerHeight * 0.45), behavior: "instant" }),
    );
    await expect
      .poll(() => art.evaluate((element) => getComputedStyle(element).transform))
      .not.toBe(before);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
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

  test("offers a readable mobile plan and an explicitly launched desktop WebGL twin", async ({
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
    await section.getByRole("button", { name: "Explore the example plan" }).click();
    await expect(
      page
        .getByRole("dialog", { name: "Course Twin example plan" })
        .locator("[data-course-twin-fallback]"),
    ).toBeVisible();
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
    await section.getByRole("button", { name: "Explore the example plan" }).click();
    await expect(
      page
        .getByRole("dialog", { name: "Course Twin example plan" })
        .locator("[data-course-twin-fallback]"),
    ).toBeVisible();
    await expect(section.locator("[data-course-twin-runtime]")).toHaveCount(0);
  });
});

test.describe("public landing without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("keeps the product story and join path readable", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Stop guessing.*Start knowing/i }),
    ).toBeVisible();
    await expect(
      page.getByText("Keep the original shot evidence.", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Join the beta" }).first()).toHaveAttribute(
      "href",
      /next=%2Fwelcome/,
    );
  });
});
