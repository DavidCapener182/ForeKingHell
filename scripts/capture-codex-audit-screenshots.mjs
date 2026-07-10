import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100";
const outputDir = process.argv[2] ?? "output/codex-product-audit";
const mobileViewport = { width: 390, height: 844 };

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: mobileViewport,
  reducedMotion: "reduce",
  serviceWorkers: "block",
});

if (process.env.PLAYWRIGHT_E2E_AUTH_BYPASS === "1") {
  await context.addCookies([createLocalBypassCookie(baseURL)]);
}

const page = await context.newPage();

await capture(page, "/today", "today-mobile.png", /Practice score|Best performer/i);

await page.goto(new URL("/sessions", baseURL).toString(), { waitUntil: "domcontentloaded" });
const latestReviewHref = await page
  .locator('a[href^="/today?session="]')
  .first()
  .getAttribute("href");
await capture(
  page,
  latestReviewHref ?? "/today",
  "latest-session-mobile.png",
  /Practice score|Best performer/i,
);

await capture(page, "/analyse", "analyse-mobile.png", /Answer the useful questions/i);
await capture(page, "/bag", "bag-mobile.png", /Bag|Gapping/i);
await capture(page, "/coach", "coach-mobile.png", /Coach/i);

await page.setViewportSize({ width: 1440, height: 900 });
await capture(page, "/dashboard", "desktop-dashboard.png", /Quick answers|Dashboard/i);

await page.setViewportSize(mobileViewport);
await gotoReady(page, "/analyse", /Answer the useful questions/i);
await page.evaluate(() => {
  document.documentElement.dataset.themePreference = "dark";
  window.dispatchEvent(new CustomEvent("fkh:theme-preference-change", { detail: "dark" }));
});
await page.waitForTimeout(200);
await screenshot(page, "dark-mode.png");

await capture(
  page,
  "/analyse/session-impact?sessionId=00000000-0000-0000-0000-000000000000",
  "empty-state.png",
  /No measured shots in this session/i,
);

await page.route("**/api/ai/data-chat", async (route) => {
  await route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ message: "Data Chat is temporarily unavailable. Try again shortly." }),
  });
});
await gotoReady(page, "/data-chat", /Ask from your golf data/i);
await page.locator("textarea:visible").first().fill("What should I practise next?");
await page.locator("button:visible", { hasText: "Ask data chat" }).first().click();
await page.getByText(/temporarily unavailable/i).waitFor();
await page.getByText(/temporarily unavailable/i).scrollIntoViewIfNeeded();
await screenshot(page, "error-state.png");

await browser.close();
process.stdout.write(`Audit screenshots written to ${outputDir}\n`);

async function capture(targetPage, route, fileName, expectedText) {
  await gotoReady(targetPage, route, expectedText);
  await screenshot(targetPage, fileName);
}

async function gotoReady(targetPage, route, expectedText) {
  await targetPage.goto(new URL(route, baseURL).toString(), {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await targetPage.locator("body").filter({ hasText: expectedText }).waitFor({ timeout: 45_000 });
  await targetPage.waitForLoadState("networkidle", { timeout: 2_500 }).catch(() => {});
}

async function screenshot(targetPage, fileName) {
  await targetPage.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await targetPage.screenshot({
    path: path.join(outputDir, fileName),
    animations: "disabled",
    caret: "initial",
  });
}

function createLocalBypassCookie(urlString) {
  const url = new URL(urlString);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = [
    encode({ alg: "none", typ: "JWT" }),
    encode({
      sub: "c0c02d1e-605a-47c5-a023-83a1c0d18195",
      email: "playwright@forekinghell.local",
      user_metadata: { name: "Playwright" },
    }),
    "playwright",
  ].join(".");

  return {
    name: "sb-playwright-auth-token",
    value: encodeURIComponent(JSON.stringify({ access_token: token })),
    domain: url.hostname,
    path: "/",
    expires: Math.floor(Date.now() / 1000) + 60 * 60,
    httpOnly: false,
    secure: false,
    sameSite: "Lax",
  };
}
