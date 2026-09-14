import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("public pages have titles, descriptions and share metadata", async ({ page }) => {
  for (const [path, title] of [
    ["/", "Make your golf data playable"],
    ["/privacy", "Privacy policy"],
    ["/terms", "Terms"],
    ["/cookies", "Cookies"],
    ["/thank-you", "Thank you"],
    ["/login", "Sign in"],
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page).toHaveTitle(new RegExp(title, "i"));
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /\S.{30}/);
    await expect(page.locator('meta[property="og:image"]').first()).toHaveAttribute(
      "content",
      /\/opengraph-image/,
    );
    await expect(page.locator('link[rel="icon"]').first()).toHaveAttribute("href", /favicon|icons/);
  }
});

test("SEO assets are public and missing pages return a real 404", async ({ page, request }) => {
  for (const [path, type] of [
    ["/robots.txt", "text/plain"],
    ["/sitemap.xml", "application/xml"],
    ["/opengraph-image", "image/png"],
    ["/favicon.ico", "image/"],
  ]) {
    const result = await request.get(path);
    expect(result.status(), path).toBe(200);
    expect(result.headers()["content-type"], path).toContain(type);
    if (path === "/sitemap.xml")
      expect(await result.text()).toContain("https://lmworldtour.app/terms");
  }
  const missing = await page.goto("/a-page-that-does-not-exist");
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to home" })).toHaveAttribute("href", "/");
  const account = await request.get("/today", { maxRedirects: 0 });
  expect(account.status()).toBe(307);
  expect(account.headers().location).toContain("/login");
});

test("cookie choice persists and can be withdrawn", async ({ page }) => {
  await page.goto("/");
  const banner = page.locator("[data-cookie-banner]");
  await expect(banner).toBeVisible();
  await banner.getByRole("button", { name: "Essential only" }).click();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await expect(banner).toHaveCount(0);
  await page.goto("/cookies");
  await page.getByRole("button", { name: "Change cookie preferences" }).click();
  await banner.getByRole("button", { name: "Allow analytics" }).click();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("lmwt.analytics-consent.v1")!).analytics,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Change cookie preferences" }).click();
  await banner.getByRole("button", { name: "Essential only" }).click();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("lmwt.analytics-consent.v1")!).analytics,
    ),
  ).toBe(false);
  await expect(page.locator('script[src*="insights/script"]')).toHaveCount(0);
});

test("mobile actions remain usable above the fold and while scrolling", async ({ page }, info) => {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const headerCta = page
      .locator("header")
      .getByRole("link", { name: "Join the beta", exact: true });
    await expect(headerCta).toBeVisible();
    const box = await headerCta.boundingBox();
    expect(box!.y + box!.height).toBeLessThan(viewport.height);
    expect(
      await headerCta.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      }),
    ).toBe(true);
    if (viewport.width === 320) await page.getByRole("button", { name: "Essential only" }).click();
    await expect(page.locator("[data-cookie-banner]")).toHaveCount(0);
    await page
      .locator("#how-it-works")
      .evaluate((el) =>
        window.scrollBy({ top: el.getBoundingClientRect().top + 120, behavior: "instant" }),
      );
    await expect(page.locator("[data-mobile-cta]")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      viewport.width + 1,
    );
    await page.screenshot({ path: info.outputPath(`mobile-cta-${viewport.width}.png`) });
    await page.locator("main > footer").scrollIntoViewIfNeeded();
    await expect(page.locator("[data-mobile-cta]")).toBeHidden();
    await page
      .locator("#how-it-works")
      .evaluate((el) =>
        window.scrollBy({ top: el.getBoundingClientRect().top + 120, behavior: "instant" }),
      );
    await page.locator("[data-mobile-cta]").getByRole("link").click();
    await expect(page).toHaveURL(/\/login\?mode=join&next=%2Fwelcome/);
  }
});

test("public documents fit small mobile and desktop screens", async ({ page }, info) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "lmwt.analytics-consent.v1",
      JSON.stringify({ version: 1, analytics: false, expires: Date.now() + 86400000 }),
    ),
  );
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/privacy", "/terms", "/cookies", "/thank-you", "/404"]) {
      await page.goto(path);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        `${path} at ${width}`,
      ).toBeLessThanOrEqual(width + 1);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
    await page.goto("/terms");
    await expect(page.locator("[data-cookie-banner]")).toHaveCount(0);
    await page.screenshot({ path: info.outputPath(`terms-${width}.png`) });
  }
});

test("invalid forms show errors without sending email and confirmation rejects external next URLs", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Essential only" }).click();
  await page.getByRole("button", { name: "Email me a secure link" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Enter a valid email address." }),
  ).toBeVisible();
  await expect(page.locator("#magic-email")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("button", { name: "Email me a secure link" })).toBeEnabled();
  await page.goto("/thank-you?next=//external.example");
  await expect(page.getByRole("link", { name: "return to sign in" })).toHaveAttribute(
    "href",
    "/login",
  );
});
