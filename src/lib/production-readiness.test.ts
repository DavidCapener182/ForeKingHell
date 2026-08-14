import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { mobileMoreGroups, mobilePrimaryItems } from "@/components/app/nav-items";
import { appRouteMetadata } from "@/components/app/route-metadata";

const root = process.cwd();

describe("production readiness gate", () => {
  it("runs the full launch verification command set and warns on missing auth state", () => {
    const script = readFileSync(join(root, "scripts/production-readiness-check.mjs"), "utf8");

    for (const expected of [
      '"format:check"',
      '"lint"',
      '"next", "typegen"',
      '"tsc", "--noEmit"',
      '"test"',
      '"drizzle-kit", "check"',
      '"audit", "--audit-level=high"',
      '"build"',
      '"check:route-budgets"',
      '"test:e2e"',
      '"--max-failures=1"',
      '"test:lighthouse"',
      '"diff", "--check"',
      'PLAYWRIGHT_SERVER_MODE: "production"',
      "if (isE2eCheck(command, args))",
      "playwright-scorecard-proof-secret-with-more-than-32-characters",
      "contains a local bypass token, not a Supabase session",
      "cookieHeaderFromStorageState(authState)",
      "Authenticated E2E not fully verified",
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

    expect(productionGateSource).not.toContain('PLAYWRIGHT_E2E_AUTH_BYPASS: "1"');
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
      expect(source).toContain("readBoundedJsonBody");
    }

    const scorecardRoute = readFileSync(
      join(root, "src/app/api/scorecard/extract/route.ts"),
      "utf8",
    );
    expect(scorecardRoute).toContain("rejectOversizedDataUrl");
    expect(scorecardRoute).toContain("isSupportedImageDataUrl");
    expect(scorecardRoute).toContain("sanitizeScorecardImageDataUrl(imageDataUrl)");
    expect(scorecardRoute).toContain("image_url: sanitizedImage.dataUrl");
    expect(scorecardRoute).toContain('update(imageDataUrl).digest("hex")');
  });

  it("keeps Stripe webhook handling signature-gated", () => {
    const source = readFileSync(join(root, "src/app/api/stripe/webhook/route.ts"), "utf8");

    expect(source).toContain("verifyStripeSignature");
    expect(source).toContain("stripe-signature");
    expect(source).toContain("Invalid Stripe signature.");
  });

  it("keeps tester-facing settings privacy controls visible", () => {
    const source = readFileSync(join(root, "src/app/(app)/settings/page.tsx"), "utf8");

    expect(source).toContain("Visibility defaults");
    expect(source).toContain("New sharing stays private unless you explicitly enable it.");
    expect(source).toContain("Public visitors never receive account-level access.");
    expect(source).toContain("Export account data");
    expect(source).toContain("Delete account permanently");
  });

  it("keeps the dashboard first-run Rapsodo path gated to no-data users", () => {
    const source = readFileSync(join(root, "src/app/(app)/dashboard/page.tsx"), "utf8");

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
    const feedCardSource = readFileSync(
      join(root, "src/components/social/feed-card-list.tsx"),
      "utf8",
    );

    expect(existsSync(join(root, "public/assets/feed-pb-card-bg.webp"))).toBe(true);
    expect(artworkSource).toContain('feedPb: "/assets/feed-pb-card-bg.webp"');
    expect(feedCardSource).toContain("data-activity-template={kind}");
    expect(feedCardSource).toContain('kind === "pb"');
    expect(feedCardSource).toContain("bg-primary/5");
    expect(feedCardSource).toContain("VerificationLabel");
  });

  it("keeps course map placeholder artwork wired into unmapped course cards", () => {
    const artworkSource = readFileSync(
      join(root, "src/components/visuals/page-artwork.tsx"),
      "utf8",
    );
    const coursesPageSource = readFileSync(
      join(root, "src/app/courses/course-library.tsx"),
      "utf8",
    );

    expect(existsSync(join(root, "public/assets/course-placeholder-map.webp"))).toBe(true);
    expect(artworkSource).toContain('courseMap: "/assets/course-placeholder-map.webp"');
    expect(coursesPageSource).toContain("export function CoursePreview");
    expect(coursesPageSource).toContain("const hasMap");
    expect(coursesPageSource).toContain("<MapPinned");
    expect(coursesPageSource).toContain("background-image:radial-gradient");
  });

  it("keeps the documented shot trace asset available through the artwork catalogue", () => {
    const artworkSource = readFileSync(
      join(root, "src/components/visuals/page-artwork.tsx"),
      "utf8",
    );
    expect(existsSync(join(root, "public/assets/page-shots-shot-trace.svg"))).toBe(true);
    expect(artworkSource).toContain('src="/assets/page-shots-shot-trace.svg"');
    expect(artworkSource).toContain("export function ShotTraceMotif");
    expect(artworkSource).not.toContain("<svg viewBox");
  });

  it("keeps provider tiles showing live status, last sync, and import failures", () => {
    const providerPageSource = readFileSync(join(root, "src/app/(app)/providers/page.tsx"), "utf8");
    const providerDataSource = readFileSync(join(root, "src/lib/provider-integrations.ts"), "utf8");

    for (const expected of [
      "Provider import health",
      "Last sync",
      "Import failures",
      "live/current",
      "beta adapter",
      "research adapter",
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

  it("starts local Lighthouse with the validated production environment contract", () => {
    const lighthouse = readFileSync(join(root, "scripts/lighthouse-audit.mjs"), "utf8");

    expect(lighthouse).toContain("loadEnvConfig(process.cwd())");
    expect(lighthouse).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(lighthouse).toContain("localAuditServerEnvironment()");
    for (const name of [
      "DATABASE_URL",
      "NEXT_PUBLIC_SITE_URL",
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "SCORECARD_PROOF_SECRET",
      "CRON_SECRET",
    ]) {
      expect(lighthouse).toContain(`"${name}"`);
    }
    expect(lighthouse).not.toContain("FKH_SKIP_ENV_VALIDATION");
  });

  it("keeps the release browser matrix explicit", () => {
    const playwright = readFileSync(join(root, "playwright.config.ts"), "utf8");
    const productionGate = readFileSync(
      join(root, "scripts/production-readiness-check.mjs"),
      "utf8",
    );

    for (const project of ['name: "chromium"', 'name: "firefox"', 'name: "webkit"']) {
      expect(playwright).toContain(project);
    }
    expect(playwright).toContain('name: "mobile-webkit"');
    expect(playwright).toContain('devices["iPhone 13"]');
    expect(playwright).toContain('process.env.PLAYWRIGHT_SERVER_MODE === "production"');
    expect(playwright).toContain("npm run start -- --port");
    expect(playwright).toContain("npm run dev -- --webpack --port");
    expect(productionGate).toContain('PLAYWRIGHT_SERVER_MODE: "production"');
    for (const name of [
      "NEXT_PUBLIC_SITE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "SCORECARD_PROOF_SECRET",
      "CRON_SECRET",
    ]) {
      expect(playwright).toContain(name);
    }
    expect(playwright).not.toContain("FKH_SKIP_ENV_VALIDATION");
  });

  it("keeps the AAA mobile shell primitives explicit with semantic in-page titles", () => {
    const mobileSportsSource = readFileSync(join(root, "src/components/mobile-sports.tsx"), "utf8");
    const mobileTabsSource = readFileSync(join(root, "src/components/mobile-tab-bar.tsx"), "utf8");
    const premiumSource = readFileSync(join(root, "src/components/premium.tsx"), "utf8");
    const mobileNavSource = readFileSync(join(root, "src/components/app/mobile-nav.tsx"), "utf8");
    const dashboardMobileHeaderSource = readFileSync(
      join(root, "src/app/dashboard/dashboard-mobile-header.tsx"),
      "utf8",
    );
    const globalsSource = readFileSync(join(root, "src/app/globals.css"), "utf8");

    expect(mobileSportsSource).toContain("<h1");
    expect(mobileSportsSource).toContain('className="min-w-0 break-words"');
    expect(mobileSportsSource).not.toContain('className="truncate" data-mobile-route-label');
    expect(dashboardMobileHeaderSource).not.toContain("<h1");
    expect(mobileSportsSource).toContain("data-mobile-route-label");
    expect(mobileNavSource).toContain("data-mobile-route-label");
    expect(dashboardMobileHeaderSource).not.toContain("data-mobile-route-label");
    expect(dashboardMobileHeaderSource).not.toContain(">Home<");
    expect(mobileTabsSource).toContain("min-h-11");
    expect(premiumSource).toContain("min-h-11");
    expect(dashboardMobileHeaderSource).toContain("min-h-11");
    expect(globalsSource).toContain(".focus-aaa:focus-visible");
    expect(globalsSource).toContain("scroll-padding-top");
    expect(globalsSource).toContain("@media (prefers-reduced-motion: reduce)");
    expect(globalsSource).toContain("--muted-foreground: #334139");
  });

  it("keeps the mobile primary nav and drawer aligned to the launch-monitor IA", () => {
    const mobileNavSource = readFileSync(join(root, "src/components/app/mobile-nav.tsx"), "utf8");

    expect(mobilePrimaryItems.map((item) => item.label)).toEqual([
      "Today",
      "Practice",
      "Play",
      "Sessions",
      "More",
    ]);
    expect(appRouteMetadata.some((route) => route.id === "profile")).toBe(true);
    expect(mobileNavSource).toContain("Search companion actions");
    expect(mobileNavSource).toContain("Open full desktop site");
    expect(mobileMoreGroups.flatMap((group) => group.items.map((item) => item.href))).toEqual(
      expect.arrayContaining(["/settings", "/privacy", "/profile"]),
    );
    expect(mobileNavSource).not.toContain('className="ios-drawer-group grid grid-cols-3');
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

  it("keeps the route-level companion and workbench launch-monitor experiences wired", () => {
    const bagSource = readFileSync(join(root, "src/app/(app)/bag/page.tsx"), "utf8");
    const shotsSource = readFileSync(join(root, "src/app/(app)/shots/page.tsx"), "utf8");
    const shotsTableSource = readFileSync(
      join(root, "src/app/shots/shots-master-detail-table.tsx"),
      "utf8",
    );
    const challengesSource = readFileSync(join(root, "src/app/(app)/challenges/page.tsx"), "utf8");
    const practiceSource = readFileSync(
      join(root, "src/app/practice/practice-companion-client.tsx"),
      "utf8",
    );
    const importSource = readFileSync(
      join(root, "src/app/(app)/import/import-companion-page.tsx"),
      "utf8",
    );
    const importWorkbenchSource = readFileSync(
      join(root, "src/app/(app)/import/import-workbench-page.tsx"),
      "utf8",
    );
    const rapsodoSource = readFileSync(
      join(root, "src/app/rapsodo/rapsodo-sync-client.tsx"),
      "utf8",
    );
    const rapsodoCompanionSource = readFileSync(
      join(root, "src/app/rapsodo/rapsodo-companion-client.tsx"),
      "utf8",
    );
    const rapsodoCompanionPreviewSource = readFileSync(
      join(root, "src/app/rapsodo/rapsodo-companion-preview.tsx"),
      "utf8",
    );

    expect(bagSource).toContain("<TabsList");
    expect(bagSource).toContain("<TargetDistanceSelector");
    expect(bagSource).toContain("<ClubIntelligencePanel");
    expect(bagSource).toContain("<Alert");
    expect(bagSource).not.toMatch(/MobileAppShell|IOS[A-Z]/);
    expect(shotsSource).toContain("<ShotsMasterDetailTable");
    expect(shotsSource).toContain('group: "none" | "club" | "session"');
    expect(shotsSource).toContain("groupBy={filters.group}");
    expect(shotsTableSource).toContain("data-shot-group={groupBy}");
    expect(shotsTableSource).toContain("shotGroupLabel");
    expect(shotsSource).not.toMatch(/MobileAppShell|MobileFilterSheet|IOS[A-Z]/);
    expect(challengesSource).toContain("MobileActiveView");
    expect(challengesSource).toContain("ActiveChallengeCard");
    expect(challengesSource).toContain("/assets/challenge-longest-drive.webp");
    expect(challengesSource).toContain("challengeImageSrc");
    expect(practiceSource).toContain("<OperationStepper");
    expect(practiceSource).toContain("<Carousel");
    expect(practiceSource).toContain("<Textarea");
    expect(importSource).toContain("Choose CSV from Files");
    expect(importSource).toContain("Rapsodo R-Cloud");
    expect(importWorkbenchSource).toContain("Review and import");
    expect(rapsodoSource).toContain("Map clubs");
    expect(rapsodoSource).toContain("Review trust");
    expect(rapsodoSource).not.toMatch(/MobileAppShell|IOS[A-Z]|setMobileStep/);
    expect(rapsodoCompanionSource).toContain("RapsodoCompanionPreview");
    expect(rapsodoCompanionPreviewSource).toContain("<OperationStepper");
    expect(rapsodoCompanionPreviewSource).toContain('label: "Map clubs"');
    expect(rapsodoCompanionPreviewSource).toContain("<Drawer");
  });

  it("keeps the AI caddie model out of the desktop dashboard bundle while preserving practice intake", () => {
    const dashboardSource = readFileSync(join(root, "src/app/(app)/dashboard/page.tsx"), "utf8");
    const caddieSource = readFileSync(join(root, "src/lib/ai-caddie-brief.ts"), "utf8");
    const practicePageSource = readFileSync(
      join(root, "src/app/(app)/practice/practice-workbench-page.tsx"),
      "utf8",
    );
    const practiceClientSource = readFileSync(
      join(root, "src/app/practice/practice-planner-client.tsx"),
      "utf8",
    );

    expect(dashboardSource).not.toContain("buildAiCaddieBrief");
    expect(dashboardSource).not.toContain("DashboardAiCaddieBriefCard");
    expect(dashboardSource).not.toContain("DashboardMobileLayout");
    expect(dashboardSource).not.toContain("var(--ios-");
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
    for (const route of [
      "/login",
      "/dashboard",
      "/today",
      "/import",
      "/rapsodo",
      "/providers",
      "/shots",
      "/bag",
      "/progress",
      "/strokes-gained",
      "/compare",
      "/rounds",
      "/courses",
      "/course-records",
      "/practice",
      "/coach",
      "/data-chat",
      "/feed",
    ]) {
      expect(lighthouseSource).toContain(`"${route}"`);
    }
    expect(lighthouseSource).not.toContain("--preset=desktop");
    expect(lighthouseSource).toContain("LIGHTHOUSE_PRESET");
  });

  it("keeps desktop workbench verification configured across command-centre viewports", () => {
    const playwrightSource = readFileSync(join(root, "playwright.config.ts"), "utf8");
    const desktopWorkbenchSource = readFileSync(
      join(root, "tests/e2e/desktop-workbench.spec.ts"),
      "utf8",
    );

    for (const project of [
      "desktop-1024x768",
      "desktop-1280x720",
      "desktop-1366x768",
      "desktop-1440x900",
      "desktop-1920x1080",
      "desktop-2560x1440",
    ]) {
      expect(playwrightSource).toContain(`name: "${project}"`);
      expect(desktopWorkbenchSource).toContain(`name: "${project}"`);
    }

    for (const viewport of [
      "width: 1024, height: 768",
      "width: 1280, height: 720",
      "width: 1366, height: 768",
      "width: 1440, height: 900",
      "width: 1920, height: 1080",
      "width: 2560, height: 1440",
    ]) {
      expect(playwrightSource).toContain(viewport);
      expect(desktopWorkbenchSource).toContain(viewport);
    }

    expect(desktopWorkbenchSource).toContain("desktopMatrixRoutes");
    for (const route of [
      "/dashboard",
      "/today",
      "/shots",
      "/bag",
      "/speed",
      "/strokes-gained",
      "/rounds?filter=scorecard-only",
      "/leaderboard?tab=monthly&sort=monthly-shots&dir=desc",
      "/data-chat",
    ]) {
      expect(desktopWorkbenchSource).toContain(`path: "${route}"`);
    }
    expect(desktopWorkbenchSource).toContain("expectNoHorizontalOverflow");
    expect(desktopWorkbenchSource).toContain("expectNoCrampedWorkbenchText");
    expect(desktopWorkbenchSource).toContain("dashboard bento panels stay readable");
  });
});
