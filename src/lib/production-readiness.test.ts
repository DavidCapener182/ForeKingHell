import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("production readiness gate", () => {
  it("runs the full launch verification command set and warns on missing auth state", () => {
    const script = readFileSync(join(root, "scripts/production-readiness-check.mjs"), "utf8");

    for (const expected of [
      '"format:check"',
      '"lint"',
      '"tsc", "--noEmit"',
      '"test"',
      '"build"',
      '"test:e2e"',
      '"test:lighthouse"',
      '"diff", "--check"',
      "PLAYWRIGHT_E2E_AUTH_BYPASS",
      "Authenticated E2E not fully verified because PLAYWRIGHT_AUTH_STATE is missing.",
    ]) {
      expect(script).toContain(expected);
    }
  });

  it("keeps the local authenticated E2E shortcut explicit and production-disabled", () => {
    const currentUserSource = readFileSync(join(root, "src/lib/current-user.ts"), "utf8");
    const productionGateSource = readFileSync(
      join(root, "scripts/production-readiness-check.mjs"),
      "utf8",
    );
    const productionDocs = readFileSync(join(root, "docs/PRODUCTION_READINESS.md"), "utf8");
    const limitationsDocs = readFileSync(join(root, "docs/KNOWN_LIMITATIONS.md"), "utf8");

    expect(productionGateSource).toContain('PLAYWRIGHT_E2E_AUTH_BYPASS: "1"');
    expect(currentUserSource).toContain("process.env.PLAYWRIGHT_E2E_AUTH_BYPASS");
    expect(currentUserSource).toContain('process.env.NODE_ENV === "production"');
    expect(currentUserSource).toContain("await cookies()");
    expect(currentUserSource).toContain("supabaseAuthCookieValue");
    expect(currentUserSource).toContain("/^sb-.+-auth-token$/");
    expect(currentUserSource).toContain('"base64url"');
    expect(productionDocs).toContain("local Playwright auth guard");
    expect(limitationsDocs).toContain("local Playwright auth guard");
  });

  it("keeps OpenAI-backed routes rate-limited and size-limited", () => {
    for (const route of [
      "src/app/api/coach/chat/route.ts",
      "src/app/api/coach/summary/route.ts",
      "src/app/api/ai/session-roast/route.ts",
      "src/app/api/scorecard/extract/route.ts",
    ]) {
      const source = readFileSync(join(root, route), "utf8");

      expect(source).toContain("rateLimitRequest");
      expect(source).toContain("rejectOversizedRequest");
    }

    expect(readFileSync(join(root, "src/app/api/scorecard/extract/route.ts"), "utf8")).toContain(
      "rejectOversizedDataUrl",
    );
  });

  it("keeps Stripe webhook handling signature-gated", () => {
    const source = readFileSync(join(root, "src/app/api/stripe/webhook/route.ts"), "utf8");

    expect(source).toContain("verifyStripeSignature");
    expect(source).toContain("stripe-signature");
    expect(source).toContain("Invalid Stripe signature.");
  });

  it("keeps tester-facing settings privacy controls visible", () => {
    const source = readFileSync(join(root, "src/app/settings/page.tsx"), "utf8");

    expect(source).toContain("Visibility simulator");
    expect(source).toContain("Data export/delete status");
    expect(source).toContain("Private by default");
    expect(source).toContain("Friends do not get account access");
  });

  it("keeps the dashboard first-run Rapsodo path gated to no-data users", () => {
    const source = readFileSync(join(root, "src/app/dashboard/page.tsx"), "utf8");

    expect(source).toContain("DashboardFirstRunOnboarding");
    expect(source).toContain("data.stats.shotCount === 0");
    expect(source).toContain("First-run Rapsodo path");
    expect(source).toContain("Turn Rapsodo data into stock yardages");
  });

  it("keeps the documented PB feed asset wired into fixed-ratio feed cards", () => {
    const artworkSource = readFileSync(
      join(root, "src/components/visuals/page-artwork.tsx"),
      "utf8",
    );
    const feedPageSource = readFileSync(join(root, "src/app/feed/page.tsx"), "utf8");
    const feedCardSource = readFileSync(
      join(root, "src/components/social/feed-card-list.tsx"),
      "utf8",
    );

    expect(existsSync(join(root, "public/assets/feed-pb-card-bg.webp"))).toBe(true);
    expect(artworkSource).toContain('feedPb: "/assets/feed-pb-card-bg.webp"');
    expect(feedPageSource).toContain('return "feedPb" as const');
    expect(feedPageSource).toContain('artworkVariant === "feedPb" ? undefined : "random"');
    expect(feedCardSource).toContain('variant="feedPb"');
    expect(feedCardSource).toContain("isPbFeedType");
    expect(feedCardSource).toContain("h-24 min-h-0 md:h-28");
  });

  it("keeps course map placeholder artwork wired into unmapped course cards", () => {
    const artworkSource = readFileSync(
      join(root, "src/components/visuals/page-artwork.tsx"),
      "utf8",
    );
    const coursesPageSource = readFileSync(join(root, "src/app/courses/page.tsx"), "utf8");

    expect(existsSync(join(root, "public/assets/course-placeholder-map.webp"))).toBe(true);
    expect(artworkSource).toContain('courseMap: "/assets/course-placeholder-map.webp"');
    expect(coursesPageSource).toContain("function courseArtworkVariant");
    expect(coursesPageSource).toContain('("courseMap" as const)');
    expect(coursesPageSource).toContain("function courseArtworkCrop");
    expect(coursesPageSource).toContain('heroArtworkVariant === "courseMap" ? undefined');
  });

  it("keeps the documented shot trace asset wired into dashboard and shots motifs", () => {
    const artworkSource = readFileSync(
      join(root, "src/components/visuals/page-artwork.tsx"),
      "utf8",
    );
    const dashboardSource = readFileSync(join(root, "src/app/dashboard/page.tsx"), "utf8");
    const shotsSource = readFileSync(join(root, "src/app/shots/page.tsx"), "utf8");

    expect(existsSync(join(root, "public/assets/page-shots-shot-trace.svg"))).toBe(true);
    expect(artworkSource).toContain('src="/assets/page-shots-shot-trace.svg"');
    expect(artworkSource).toContain("export function ShotTraceMotif");
    expect(artworkSource).not.toContain("<svg viewBox");
    expect(dashboardSource).toContain("ShotTraceMotif");
    expect(shotsSource).toContain("ShotTraceMotif");
  });

  it("keeps provider tiles showing live status, last sync, and import failures", () => {
    const providerPageSource = readFileSync(join(root, "src/app/providers/page.tsx"), "utf8");
    const providerDataSource = readFileSync(join(root, "src/lib/provider-integrations.ts"), "utf8");

    for (const expected of [
      "Provider import health",
      "Last sync",
      "Import failures",
      "live/current",
      "coming soon",
      "data-provider-import-health",
    ]) {
      expect(providerPageSource).toContain(expected);
    }

    for (const expected of [
      "lastSyncAt",
      "failureCount",
      "latestFailureMessage",
      "latestDate",
      'job.status === "failed"',
      "Boolean(job.errorMessage)",
    ]) {
      expect(providerDataSource).toContain(expected);
    }
  });

  it("keeps authenticated E2E state capture documented and ignored", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const captureScript = readFileSync(join(root, "scripts/capture-auth-state.mjs"), "utf8");
    const readme = readFileSync(join(root, "README.md"), "utf8");
    const productionDocs = readFileSync(join(root, "docs/PRODUCTION_READINESS.md"), "utf8");
    const onboardingDocs = readFileSync(join(root, "docs/TESTER_ONBOARDING.md"), "utf8");
    const gitignore = readFileSync(join(root, ".gitignore"), "utf8");

    expect(packageJson.scripts["test:e2e:capture-auth"]).toBe(
      "node scripts/capture-auth-state.mjs",
    );
    expect(captureScript).toContain("PLAYWRIGHT_AUTH_STATE");
    expect(captureScript).toContain(".playwright/auth/forekinghell-state.json");
    expect(captureScript).toContain("storageState");
    expect(captureScript).toContain("No Supabase/auth cookies or local storage entries");
    expect(readme).toContain("npm run test:e2e:capture-auth");
    expect(productionDocs).toContain("PLAYWRIGHT_BASE_URL=https://your-preview-url");
    expect(onboardingDocs).toContain(".playwright/auth/forekinghell-state.json");
    expect(gitignore).toContain(".playwright/auth/");
  });

  it("keeps the AAA mobile shell primitives explicit and route chrome out of the h1 outline", () => {
    const mobileSportsSource = readFileSync(join(root, "src/components/mobile-sports.tsx"), "utf8");
    const mobileTabsSource = readFileSync(join(root, "src/components/mobile-tab-bar.tsx"), "utf8");
    const premiumSource = readFileSync(join(root, "src/components/premium.tsx"), "utf8");
    const dashboardMobileHeaderSource = readFileSync(
      join(root, "src/app/dashboard/dashboard-mobile-header.tsx"),
      "utf8",
    );
    const globalsSource = readFileSync(join(root, "src/app/globals.css"), "utf8");

    expect(mobileSportsSource).not.toContain("<h1");
    expect(dashboardMobileHeaderSource).not.toContain("<h1");
    expect(mobileSportsSource).toContain("data-mobile-route-label");
    expect(dashboardMobileHeaderSource).toContain("data-mobile-route-label");
    expect(mobileTabsSource).toContain("min-h-11");
    expect(premiumSource).toContain("min-h-11");
    expect(dashboardMobileHeaderSource).toContain("min-h-11");
    expect(globalsSource).toContain(".focus-aaa:focus-visible");
    expect(globalsSource).toContain("scroll-padding-top");
    expect(globalsSource).toContain("@media (prefers-reduced-motion: reduce)");
    expect(globalsSource).toContain("--muted-foreground: #334139");
  });

  it("keeps the mobile primary nav and drawer aligned to the launch-monitor IA", () => {
    const navItemsSource = readFileSync(join(root, "src/components/app/nav-items.ts"), "utf8");
    const mobileNavSource = readFileSync(join(root, "src/components/app/mobile-nav.tsx"), "utf8");

    expect(navItemsSource).toContain('label: "Home"');
    expect(navItemsSource).toContain('label: "Coach"');
    expect(mobileNavSource).toContain("Search pages, clubs, rounds or friends");
    expect(mobileNavSource).toContain('href="/settings"');
    expect(mobileNavSource).toContain('href="/privacy"');
    expect(mobileNavSource).toContain('href="/profile"');
    expect(mobileNavSource).toContain("focus-aaa");
  });

  it("keeps the mobile artwork catalogue ready for all AAA launch surfaces", () => {
    const artworkSource = readFileSync(
      join(root, "src/components/visuals/page-artwork.tsx"),
      "utf8",
    );

    for (const variant of [
      "practice",
      "dataChat",
      "speed",
      "leaderboard",
      "challenges",
      "tournaments",
      "friends",
      "groups",
      "settings",
      "billing",
      "partners",
      "admin",
      "safety",
    ]) {
      expect(artworkSource).toContain(`| "${variant}"`);
      expect(artworkSource).toContain(`${variant}:`);
    }

    for (const asset of [
      "/assets/challenge-longest-drive.webp",
      "/assets/tour-covers/tour-cover-01.webp",
      "/assets/provider-rapsodo-device.webp",
      "/assets/profile-trophy-shelf.webp",
    ]) {
      expect(artworkSource).toContain(asset);
    }
  });

  it("keeps the route-level AAA mobile launch monitor experiences wired", () => {
    const bagSource = readFileSync(join(root, "src/app/bag/page.tsx"), "utf8");
    const shotsSource = readFileSync(join(root, "src/app/shots/page.tsx"), "utf8");
    const challengesSource = readFileSync(join(root, "src/app/challenges/page.tsx"), "utf8");
    const practiceSource = readFileSync(join(root, "src/app/practice/page.tsx"), "utf8");
    const importSource = readFileSync(join(root, "src/app/import/page.tsx"), "utf8");
    const rapsodoSource = readFileSync(
      join(root, "src/app/rapsodo/rapsodo-sync-client.tsx"),
      "utf8",
    );

    expect(bagSource).toContain("Swipe your bag");
    expect(bagSource).toContain('source="generated-v2"');
    expect(bagSource).toContain("Latest Reliable");
    expect(shotsSource).toContain("Dispersion map");
    expect(shotsSource).toContain("/assets/fairway-dispersion-bg.svg");
    expect(shotsSource).toContain("Club dispersion filters");
    expect(challengesSource).toContain("MobilePremiumChallengeCard");
    expect(challengesSource).toContain("/assets/challenge-longest-drive.webp");
    expect(challengesSource).toContain("Proof-led");
    expect(practiceSource).toContain("Active session mode");
    expect(practiceSource).toContain("Practice scoring is driven by imported launch-monitor shots");
    expect(practiceSource).toContain("spinAverageRpm");
    expect(importSource).toContain("Connect/upload");
    expect(importSource).toContain("Review trust");
    expect(rapsodoSource).toContain("Map clubs");
    expect(rapsodoSource).toContain("Review trust");
    expect(rapsodoSource).toContain('setMobileStep("review")');
  });

  it("keeps the AI caddie brief wired as the mobile dashboard to practice loop", () => {
    const dashboardSource = readFileSync(join(root, "src/app/dashboard/page.tsx"), "utf8");
    const caddieSource = readFileSync(join(root, "src/lib/ai-caddie-brief.ts"), "utf8");
    const practicePageSource = readFileSync(join(root, "src/app/practice/page.tsx"), "utf8");
    const practiceClientSource = readFileSync(
      join(root, "src/app/practice/practice-planner-client.tsx"),
      "utf8",
    );

    expect(dashboardSource).toContain("buildAiCaddieBrief");
    expect(dashboardSource).toContain("DashboardAiCaddieBriefCard");
    expect(dashboardSource).toContain("brief.title");
    expect(dashboardSource).toContain("Structured JSON");
    expect(dashboardSource).toContain("StickyMobileAction");
    expect(caddieSource).toContain("Today's AI Caddie Brief");
    expect(caddieSource).toContain("schemaVersion: 1");
    expect(caddieSource).toContain("dataUsed");
    expect(caddieSource).toContain("Start today's practice");
    expect(caddieSource).toContain("/practice?source=caddie&time=");
    expect(practicePageSource).toContain("practiceOptionsFromSearchParams");
    expect(practicePageSource).toContain("practicePlanOptionsFromPlan");
    expect(practiceClientSource).toContain("initialOptions");
    expect(practiceClientSource).toContain("normalizeInitialOptions");
  });

  it("keeps mobile launch verification configured across devices and Lighthouse routes", () => {
    const playwrightSource = readFileSync(join(root, "playwright.config.ts"), "utf8");
    const lighthouseSource = readFileSync(join(root, "scripts/lighthouse-audit.mjs"), "utf8");

    for (const project of [
      "mobile-small",
      "mobile-iphone",
      "mobile-pixel",
      "tablet-ipad-mini",
      "phone-landscape",
    ]) {
      expect(playwrightSource).toContain(`name: "${project}"`);
    }

    expect(playwrightSource).toContain("width: 320");
    expect(playwrightSource).toContain("width: 390");
    expect(playwrightSource).toContain("width: 430");
    expect(lighthouseSource).toContain(
      "/login,/dashboard,/today,/import,/rapsodo,/shots,/bag,/practice,/coach,/feed",
    );
    expect(lighthouseSource).not.toContain("--preset=desktop");
    expect(lighthouseSource).toContain("LIGHTHOUSE_PRESET");
  });
});
