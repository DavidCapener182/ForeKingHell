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
      "Authenticated E2E not fully verified because PLAYWRIGHT_AUTH_STATE is missing.",
    ]) {
      expect(script).toContain(expected);
    }
  });

  it("keeps OpenAI-backed routes rate-limited and size-limited", () => {
    for (const route of [
      "src/app/api/coach/chat/route.ts",
      "src/app/api/coach/summary/route.ts",
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
});
