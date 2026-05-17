import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100";
const storageState = process.env.PLAYWRIGHT_AUTH_STATE;
const outputDir = process.argv[2] ?? "output/ui-screenshots";

const mobileViewports = [
  { name: "mobile-390x844", width: 390, height: 844 },
  { name: "mobile-430x932", width: 430, height: 932 },
];

const desktopViewports = [
  { name: "desktop-1440x900", width: 1440, height: 900 },
  { name: "desktop-1728x1117", width: 1728, height: 1117 },
];

const routes = [
  { name: "dashboard", path: "/dashboard", text: /Dashboard|Today/i },
  { name: "today", path: "/today", text: /Latest Practice Review|Today/i },
  { name: "import", path: "/import", text: /Import|Rapsodo|Upload CSV/i },
  { name: "rapsodo", path: "/rapsodo", text: /Rapsodo|cloud sync/i },
  { name: "shots", path: "/shots", text: /Shot database|Shot explorer/i },
  { name: "bag", path: "/bag", text: /Stock yardages|Gapping ladder|Bag/i },
  { name: "coach", path: "/coach", text: /Coach/i },
  { name: "progress", path: "/progress", text: /Progress/i },
  { name: "rounds", path: "/rounds", text: /Rounds/i },
  { name: "handicap", path: "/handicap", text: /Handicap/i },
  { name: "courses", path: "/courses", text: /Courses/i },
  { name: "course-records", path: "/course-records", text: /Course records|Course Champion/i },
  { name: "challenges", path: "/challenges", text: /Challenges/i },
  { name: "tournaments", path: "/tournaments", text: /Tournaments|Daily, weekly/i },
  { name: "leaderboard", path: "/leaderboard", text: /Leaderboards/i },
  { name: "feed", path: "/feed", text: /Feed/i },
  { name: "friends", path: "/friends", text: /Friends/i },
  { name: "groups", path: "/groups", text: /Groups/i },
  { name: "profile", path: "/profile", text: /Profile|You/i },
  { name: "achievements", path: "/achievements", text: /Achievements/i },
  { name: "equipment", path: "/equipment", text: /Equipment/i },
  { name: "billing", path: "/billing", text: /Pricing|Current plan/i },
  { name: "providers", path: "/providers", text: /Launch monitor providers|Providers/i },
  { name: "settings", path: "/settings", text: /Settings/i },
];

if (storageState && !existsSync(storageState)) {
  throw new Error(`PLAYWRIGHT_AUTH_STATE was set but not found: ${storageState}`);
}

mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  storageState: storageState && existsSync(storageState) ? storageState : undefined,
  serviceWorkers: "block",
});
const page = await context.newPage();
const failures = [];
const skips = [];

for (const viewport of [...mobileViewports, ...desktopViewports]) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });

  for (const route of routes) {
    await captureRoute(route, viewport);
  }

  await captureFirstLinkedDetail({
    viewport,
    source: { path: "/bag", text: /Stock yardages|Gapping ladder|Bag/i },
    name: "club-detail",
    selector: 'a[href^="/bag/"]',
    hrefPattern: /^\/bag\/(?!longest$)[^/]+$/,
    readyText: /Club analysis|Stock yardage|Stock carry|Summary/i,
  });

  await captureFirstLinkedDetail({
    viewport,
    source: { path: "/rounds", text: /Rounds/i },
    name: "round-detail",
    selector: 'a[href^="/rounds/"]',
    hrefPattern: /^\/rounds\/(?!new$)[^/]+$/,
    readyText: /Round review|Round context|Hole|Scorecard/i,
  });
}

await browser.close();

if (failures.length > 0) {
  console.log(`Captured with ${failures.length} failed route(s):`);
  for (const failure of failures) {
    console.log(`- ${failure}`);
  }
} else if (skips.length > 0) {
  console.log("Captured all required route screenshots.");
  console.log(`Skipped ${skips.length} optional detail screenshot(s):`);
  for (const skip of skips) {
    console.log(`- ${skip}`);
  }
} else {
  console.log("Captured all requested screenshots.");
}

async function captureRoute(route, viewport) {
  console.log(`capturing ${route.name} ${viewport.name}`);
  const ok = await gotoAndVerify(route.path, route.text);
  if (!ok) {
    failures.push(`${route.name}-${viewport.name}`);
    return;
  }

  await screenshot(`${route.name}-${viewport.name}.png`);
}

async function captureFirstLinkedDetail({
  viewport,
  source,
  name,
  selector,
  hrefPattern,
  readyText,
}) {
  console.log(`capturing ${name} ${viewport.name}`);
  if (!(await gotoAndVerify(source.path, source.text))) {
    failures.push(`${name}-${viewport.name}: source unavailable`);
    return;
  }

  const href = await page.locator(selector).evaluateAll(
    (links, patternSource) =>
      links
        .map((link) => link.getAttribute("href"))
        .find((value) => value && new RegExp(patternSource).test(value)) ?? null,
    hrefPattern.source,
  );

  if (!href) {
    skips.push(`${name}-${viewport.name}: no detail link`);
    return;
  }

  if (!(await gotoAndVerify(href, readyText))) {
    failures.push(`${name}-${viewport.name}: detail unavailable`);
    return;
  }

  await screenshot(`${name}-${viewport.name}.png`);
}

async function gotoAndVerify(routePath, expectedText) {
  const url = new URL(routePath, baseURL).toString();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForLoadState("networkidle", { timeout: 3_500 }).catch(() => {});
  } catch (error) {
    failures.push(`${routePath}: ${String(error).split("\n")[0]}`);
    return false;
  }

  const bodyText = await page.locator("body").innerText({ timeout: 15_000 }).catch(() => "");
  if (/\/login(?:\?|$)/.test(page.url()) || /Sign in to ForeKingHell/i.test(bodyText)) {
    failures.push(`${routePath}: redirected to login`);
    return false;
  }

  if (!matches(bodyText, expectedText)) {
    failures.push(`${routePath}: expected text not found`);
    return false;
  }

  return true;
}

async function screenshot(fileName) {
  await page.screenshot({
    path: path.join(outputDir, fileName),
    animations: "disabled",
  });
}

function matches(text, expected) {
  return typeof expected === "string" ? text.includes(expected) : expected.test(text);
}
