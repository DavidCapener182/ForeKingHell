import { test, expect } from "@playwright/test";
import { billingPlans } from "@/lib/billing-plan-catalog";
import { marketingFaqs } from "@/lib/marketing-demo-data";
test("Public home keeps all sections, complete pricing and example controls usable", async ({
  page,
  browser,
}, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(300000);
  page.setDefaultNavigationTimeout(90000);
  page.setDefaultTimeout(15000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [width, height] of [
    [1440, 900],
    [1280, 800],
    [390, 844],
    [360, 800],
    [1023, 800],
    [1024, 800],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 60000 });
    await page.addStyleTag({ content: "nextjs-portal{pointer-events:none!important;}" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    const hero = page.locator('section[aria-labelledby="hero-title"]');
    await expect(hero.getByRole("link", { name: /Join the beta/ })).toBeVisible();
    await expect(hero.locator("h1 span").last()).toHaveCSS("opacity", "1");
    await expect(hero.locator("h1 + div + div")).toHaveCSS("opacity", "1");
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll('section[aria-labelledby="hero-title"] img')).every(
        (node) => (node as HTMLImageElement).complete,
      ),
    );
    await page.screenshot({ path: info.outputPath(`P83-hero-${width}.png`) });
    const menu = page.getByRole("button", { name: "Open navigation", exact: true });
    if (await menu.isVisible()) {
      await expect(menu).toBeEnabled({ timeout: 60000 });
      await menu.click();
      const sheet = page.getByRole("dialog");
      await sheet
        .getByRole("textbox", { name: "Find a page or section", exact: true })
        .fill("unmatched");
      await expect(sheet.getByRole("status")).toContainText("No sections");
      await sheet
        .getByRole("textbox", { name: "Find a page or section", exact: true })
        .fill("Pricing");
      await sheet.getByRole("link", { name: "Pricing", exact: true }).click();
      await expect(sheet).toHaveCount(0);
      await expect(page).toHaveURL(/#pricing$/);
    }
    for (const id of [
      "how-it-works",
      "course-twin",
      "practice",
      "product-screens",
      "features",
      "privacy",
      "pricing",
      "faq",
    ]) {
      const section = page.locator(`#${id}`);
      await expect(section).toHaveCount(1, { timeout: 60000 });
      await section.scrollIntoViewIfNeeded();
      await expect(section).toBeVisible();
    }
    const faq = page.locator("#faq");
    for (const item of marketingFaqs) {
      const details = faq
        .locator("details")
        .filter({ has: page.locator("summary", { hasText: item.question }) });
      await details.locator("summary").click();
      await expect(details.locator("p")).toHaveText(item.answer);
      await details.locator("summary").click();
    }
    const structured = await page.locator('script[type="application/ld+json"]').allTextContents();
    const faqData = structured
      .map((text) => JSON.parse(text))
      .find((item) => item["@type"] === "FAQPage");
    expect(
      faqData.mainEntity.map((item: { name: string; acceptedAnswer: { text: string } }) => ({
        question: item.name,
        answer: item.acceptedAnswer.text,
      })),
    ).toEqual(marketingFaqs);
    const pricing = page.locator("#pricing");
    for (const plan of billingPlans.filter((p) => !p.internal)) {
      const card = pricing
        .getByRole("article")
        .filter({ has: page.getByRole("heading", { name: plan.name, exact: true }) });
      await expect(card).toContainText(plan.monthlyPrice);
      await expect(card).toContainText(plan.yearlyPrice);
      for (const feature of plan.features) await expect(card).toContainText(feature);
      await expect(card.getByRole("link")).toHaveAttribute(
        "href",
        "/login?mode=join&next=%2Fbilling",
      );
    }
    await pricing.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath(`P83-pricing-${width}.png`) });
    await page.getByRole("button", { name: "Explore the example plan", exact: true }).click();
    const twin = page.getByRole("dialog", { name: "Course Twin example plan", exact: true });
    await expect(twin).toContainText("Expected carry (modelled)");
    await expect(twin).toContainText("Common miss (modelled)");
    await page.keyboard.press("Escape");
    await expect(twin).toHaveCount(0);
    for (const name of ["Today", "Bag", "Practice Planner"]) {
      await expect(
        page.getByRole("link", { name: `Open full ${name} preview (new tab)`, exact: true }),
      ).toHaveAttribute("href", /\.avif$/);
    }
    const broken = await page
      .locator('a[href^="#"]')
      .evaluateAll((links) =>
        links
          .map((link) => link.getAttribute("href")!)
          .filter(
            (href) => href !== "#" && !document.getElementById(decodeURIComponent(href.slice(1))),
          ),
      );
    expect(broken).toEqual([]);
  }
  expect(errors).toEqual([]);
  const noScript = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const staticPage = await noScript.newPage();
  await staticPage.goto("http://localhost:3116/", {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await expect(staticPage.locator("#faq details")).toHaveCount(marketingFaqs.length);
  await staticPage.locator("#faq summary").first().click();
  await expect(staticPage.locator("#faq details").first().locator("p")).toBeVisible();
  await noScript.close();
});
