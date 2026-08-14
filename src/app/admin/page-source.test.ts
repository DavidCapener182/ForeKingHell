import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(admin)/admin/page.tsx"), "utf8");
const adminDataSource = readFileSync(join(process.cwd(), "src/lib/admin.ts"), "utf8");

describe("admin overview operations console", () => {
  it("uses the requested operations-console hierarchy", () => {
    for (const label of [
      "Operations console",
      "Operational status",
      "Provider issues",
      "Billing issues",
      "Moderation queue",
      "User/account actions",
      "System verification",
      "Attention required",
      "Recent operational activity",
      "Quick admin actions",
    ]) {
      expect(source).toContain(label);
    }

    expect(source).toContain("xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)]");
  });

  it("uses tables for operational evidence and StatusTimeline for audit activity", () => {
    expect(source).toContain("<Table>");
    expect(source).toContain("<TableCaption");
    expect(source).toContain("<TableHeader");
    expect(source).toContain("<TableBody>");
    expect(source).toContain("<StatusTimeline");
    expect(source).toContain('label="Recent admin audit events"');
    expect(source).toContain("tabIndex={0}");
  });

  it("reserves Alert for recorded failures and keeps missing evidence explicit", () => {
    expect(source).toContain("actualFailureCount > 0");
    expect(source).toContain('<Alert variant="destructive">');
    expect(source).toContain("Unknown");
    expect(source).toContain("Unverified");
    expect(source).toContain("not a live uptime check");
    expect(source).toContain("Missing verification is not treated as system health");
    expect(source).not.toContain('tone="green"');
  });

  it("removes golfer-facing hero, metric-card and AI-rail patterns", () => {
    for (const obsolete of [
      "PageArtwork",
      "AdminMetric",
      "AdminPageHeader",
      "AdminSection",
      "DesktopInsightRail",
      "adminWorkbenchPrompts",
      "premium-hero",
      "Site control room",
    ]) {
      expect(source).not.toContain(obsolete);
    }

    expect(source).toContain("DesktopWorkbenchLayout");
    expect(source).toContain('scope="admin"');
  });

  it("counts both report and moderation-event queue evidence", () => {
    expect(source).toContain("data.metrics.openReports + operations.openModerationEvents");
    expect(adminDataSource).toContain('as "openModerationEventCount"');
    expect(adminDataSource).toContain("openModerationEvents: metrics.openModerationEventCount");
  });
});
