import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/dashboard/page.tsx"), "utf8");
const facePathSelectorSource = readFileSync(
  join(process.cwd(), "src/app/dashboard/face-path-club-selector.tsx"),
  "utf8",
);
const facePathChartSource = readFileSync(
  join(process.cwd(), "src/components/visuals/face-path-delivery-chart.tsx"),
  "utf8",
);
const capabilitySource = readFileSync(
  join(process.cwd(), "src/lib/app-route-capabilities.ts"),
  "utf8",
);

describe("dashboard desktop source", () => {
  it("separates historical trust from the best course-scoring club", () => {
    expect(source).toContain('title="Most trusted historically"');
    expect(source).toContain('title="Best course scoring club"');
  });

  it("does not present a path moving away from neutral as an improvement", () => {
    expect(source).toContain("if (changeTowardNeutral <= 0.05)");
    expect(source).not.toContain('return "Holding steady";');
  });

  it("uses the consolidated answer, KPI, trend and activity hierarchy without an AI rail", () => {
    const layoutBlock =
      source.match(/<DesktopWorkbenchLayout[\s\S]*?<\/DesktopWorkbenchLayout>/)?.[0] ?? "";

    expect(layoutBlock).toContain('scope="dashboard"');
    expect(layoutBlock).not.toContain("DesktopInsightRail");
    expect(layoutBlock).not.toContain("rail=");
    expect(layoutBlock).not.toContain("railBreakpoint=");
    expect(layoutBlock).toContain("<DashboardSummaryHero");
    expect(layoutBlock).toContain("<ConnectedMetricBar");
    expect(layoutBlock).toContain("<DriverStatusPanel");
    expect(layoutBlock).toContain("<DashboardSpeedDevelopmentCard");
    expect(layoutBlock.indexOf("<DashboardSpeedDevelopmentCard")).toBeGreaterThan(
      layoutBlock.indexOf("<DriverStatusPanel"),
    );
    expect(layoutBlock).toContain("<StatusTimeline");
    expect(layoutBlock).toContain('title="Current work"');
    expect(source).not.toContain("function TodayCommandBrief");
    expect(source).not.toContain("function QuickActions");
  });

  it("keeps non-chart status surfaces on theme-aware semantic tokens", () => {
    const heroInsightBlock =
      source.match(/function HeroInsightCard[\s\S]*?type RoundReadiness/)?.[0] ?? "";
    const practiceRecommendationBlock =
      source.match(/function PracticeRecommendationCard[\s\S]*?function PracticePayoffPill/)?.[0] ??
      "";
    const readinessBlock =
      source.match(/function RoundReadinessCard[\s\S]*?function ReadinessRow/)?.[0] ?? "";
    const driverPathBlock =
      source.match(/function DriverPathProgress[\s\S]*?function PracticeRecommendationCard/)?.[0] ??
      "";
    const sinceLastBlock =
      source.match(/function SinceLastSessionCard[\s\S]*?function calculateRoundReadiness/)?.[0] ??
      "";

    for (const block of [
      heroInsightBlock,
      practiceRecommendationBlock,
      readinessBlock,
      driverPathBlock,
      sinceLastBlock,
    ]) {
      expect(block).not.toMatch(/#[0-9a-f]{3,8}/i);
      expect(block).not.toContain("rgba(");
      expect(block).not.toContain("text-white");
    }

    expect(source).not.toMatch(
      /(?:bg|text|border|ring)-(?:white|black|slate|emerald|green|amber|orange|yellow|red|rose|pink|sky|blue|indigo|violet|purple|cyan|teal)(?:-|\b)|(?:bg|text|border|ring)-\[#/,
    );

    expect(heroInsightBlock).toContain("border-primary/25");
    expect(heroInsightBlock).toContain("text-primary-foreground");
    expect(practiceRecommendationBlock).toContain("border-border bg-muted");
    expect(practiceRecommendationBlock).toContain("text-primary-foreground");
    expect(readinessBlock).toContain("var(--primary)");
    expect(driverPathBlock).toContain("var(--confidence-medium)");
    expect(sinceLastBlock).toContain("hover:border-primary");
  });

  it("keeps the face-path target readout legible across semantic themes", () => {
    const targetReadout =
      facePathChartSource.match(/\{targetWindow \? \([\s\S]*?function angleTargetState/)?.[0] ?? "";

    expect(targetReadout).toContain("text-foreground");
    expect(targetReadout).toContain("--status-success-foreground");
    expect(targetReadout).toContain("--status-warning-foreground");
    expect(targetReadout).not.toMatch(/text-\[#[0-9a-f]{3,8}\]/i);
  });

  it("uses a semantic shadcn club selector around the specialist delivery chart", () => {
    expect(source).toContain(
      'import { FacePathClubSelector } from "@/app/dashboard/face-path-club-selector"',
    );
    expect(source).toContain("<FacePathClubSelector");
    expect(facePathSelectorSource).toContain("<ToggleGroup");
    expect(facePathSelectorSource).toContain("<ToggleGroupItem");
    expect(facePathSelectorSource).toContain('type="single"');
    expect(facePathSelectorSource).toContain("value={selected.clubId}");
    expect(facePathSelectorSource).toContain("bg-card");
    expect(facePathSelectorSource).toContain("bg-muted");
    expect(facePathSelectorSource).toContain("text-foreground");
    expect(facePathSelectorSource).toContain("text-primary");
    expect(facePathSelectorSource).not.toMatch(/<button\b/);
    expect(facePathSelectorSource).not.toMatch(
      /#F7FBF8|#111827|#087A3D|#667085|bg-white|text-white|rgba\(/i,
    );
  });

  it("uses the shared speed-development summary for a compact Project card", () => {
    expect(source).toContain('import { getSpeedCoachCardData } from "@/lib/speed-training-data"');
    expect(source).toContain("getSpeedCoachCardData(userId)");
    expect(source).toContain("data-dashboard-speed-development");
    expect(source).toContain('label="Project carry"');
    expect(source).toContain('label="Next physical target"');
    expect(source).toContain('label="Next performance target"');
    expect(source).toContain('label="Speed readiness"');
    expect(source).toContain('href="/speed"');
  });
});

describe("dashboard workbench bundle boundary", () => {
  it("keeps the desktop-only route to one visible workbench tree", () => {
    expect(capabilitySource).toContain(
      'dashboard: desktopOnly("Today", "/today", "The dashboard is a full analytical command centre.")',
    );
    expect(source).toContain('<DesktopWorkbenchLayout scope="dashboard">');
    expect(source).toContain("<DashboardSummaryHero");
    expect(source).not.toContain("DashboardMobileLayout");
    expect(source).not.toContain("DashboardMobileHeader");
    expect(source).not.toContain("DashboardAiCaddieBriefCard");
    expect(source).not.toContain("MobileCompanion");
    expect(source).not.toContain("MobileBentoSummary");
    expect(source).not.toContain("ios-mobile-screen");
    expect(source).not.toContain("lg:hidden");
    expect(source).not.toContain("hidden lg:");
  });

  it("does not load companion-only dashboard models or social data", () => {
    expect(source).not.toContain("buildAiCaddieBrief");
    expect(source).not.toContain("getFeedPageData");
    expect(source).not.toContain("DashboardCommandPalette");
    expect(source).not.toContain("compactMobile");
    expect(source).not.toContain("var(--ios-");
  });
});
