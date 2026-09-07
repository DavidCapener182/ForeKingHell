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
  it("keeps aggregate practice context without assigning an unrelated latest session", () => {
    expect(source).toContain('new URLSearchParams({ source: "dashboard", time: "15" })');
    expect(source).toContain('if (clubType) practiceQuery.set("club", clubType)');
    expect(source).toContain("`/practice?planId=${currentPlan.id}`");
    expect(source).not.toContain('practiceQuery.set("sourceSessionId"');
  });
  it("labels measured bag trust separately from scoring evidence", () => {
    expect(source).toContain("data.bagSummary.trustedClubCount");
    expect(source).toContain('detail: "Trusted / mapped clubs"');
    expect(source).toContain("formatHandicapValue(data.stats.combinedHandicap.value)");
    expect(source).not.toContain("Best course scoring club");
  });

  it("passes measured delivery history to the selected-club chart without inventing improvement", () => {
    expect(source).toContain("<FacePathClubSelector pathTrend={data.pathTrend} />");
    expect(source).not.toContain("changeTowardNeutral");
    expect(source).not.toContain('return "Holding steady";');
  });

  it("puts recommended practice before pinned metrics and deeper evidence", () => {
    const layout = source.slice(source.indexOf("export default async function DashboardPage"));
    expect(layout.match(/<PageShell/g)).toHaveLength(1);
    expect(layout).toContain("data-dashboard-ui");
    expect(layout).not.toContain("DesktopInsightRail");
    expect(layout).toContain('aria-label="Recommended practice"');
    expect(layout.indexOf('aria-label="Recommended practice"')).toBeLessThan(
      layout.indexOf("metrics.map"),
    );
    expect(layout).toContain("data.dashboardPins.includes");
    expect(layout).toContain("<DashboardSpeedDevelopmentCard");
    expect(layout).toContain("<StatusTimeline");
    expect(layout).toContain("Current work</h2>");
  });

  it("keeps non-chart status surfaces on theme-aware semantic tokens", () => {
    expect(source).not.toMatch(
      /(?:bg|text|border|ring)-(?:white|black|slate|emerald|green|amber|orange|yellow|red|rose|pink|sky|blue|indigo|violet|purple|cyan|teal)(?:-|\b)|(?:bg|text|border|ring)-\[#/,
    );
    expect(source).toContain("bg-card");
    expect(source).toContain("text-muted-foreground");
    expect(source).toContain("focus-visible:outline-ring");
  });

  it("keeps the face-path target readout legible across semantic themes", () => {
    const targetReadout =
      facePathChartSource.match(/\{targetWindow \? \([\s\S]*?function angleTargetState/)?.[0] ?? "";

    expect(targetReadout).toContain("text-foreground");
    expect(targetReadout).toContain("--status-success-foreground");
    expect(targetReadout).toContain("--status-warning-foreground");
    expect(targetReadout).not.toMatch(/text-\[#[0-9a-f]{3,8}\]/i);
  });

  it("uses a labelled shared club selector around the specialist delivery chart", () => {
    expect(source).toContain(
      'import { FacePathClubSelector } from "@/app/dashboard/face-path-club-selector"',
    );
    expect(source).toContain("<FacePathClubSelector");
    expect(facePathSelectorSource).toContain("<UntitledSelect");
    expect(facePathSelectorSource).toContain('label="Selected club"');
    expect(facePathSelectorSource).toContain("onValueChange={setSelectedClubId}");
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
  it("makes the single dashboard workspace available through companion navigation", () => {
    expect(capabilitySource).toContain("dashboard: companionMore()");
    expect(source).toContain("data-dashboard-ui");
    expect(source).not.toContain("DashboardMobileLayout");
    expect(source).not.toContain("DashboardAiCaddieBriefCard");
    expect(source).not.toContain("hidden lg:");
    expect(source).not.toMatch(/max-w-(?:6xl|7xl|\[1500px\])/);
  });

  it("does not load companion-only dashboard models or social data", () => {
    expect(source).not.toContain("buildAiCaddieBrief");
    expect(source).not.toContain("getFeedPageData");
    expect(source).not.toContain("DashboardCommandPalette");
    expect(source).not.toContain("compactMobile");
    expect(source).not.toContain("var(--ios-");
  });
});
