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

  it("uses tables for operational evidence and inspectable audit activity", () => {
    const attention = readFileSync(
      join(process.cwd(), "src/app/admin/admin-attention.tsx"),
      "utf8",
    );
    expect(source).toContain("<AdminAttention rows={attentionRows}");
    for (const tag of ["<table", "<caption", "<thead>", "<tbody>"])
      expect(attention).toContain(tag);
    expect(source).toContain("data.recentAuditRows.map");
    expect(source).toContain("<summary");
    for (const label of ["Actor:", "Action:", "Target:", "Outcome:", "Source:"])
      expect(source).toContain(label);
    expect(source).toContain("audit record alone does not verify an external outcome");
  });

  it("reserves Alert for recorded failures and keeps missing evidence explicit", () => {
    expect(source).toContain("actualFailureCount > 0");
    expect(source).toContain('<Alert variant="destructive">');
    expect(source).toContain("Unknown");
    expect(source).toContain("Unverified");
    expect(source).toContain("No live CI, RLS or automated test result");
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

    expect(source).toContain("<PageShell>");
    expect(source).toContain('<AdminNav active="/admin"');
  });

  it("counts both report and moderation-event queue evidence", () => {
    expect(source).toContain("data.metrics.openReports + operations.openModerationEvents");
    expect(adminDataSource).toContain('as "openModerationEventCount"');
    expect(adminDataSource).toContain("openModerationEvents: metrics.openModerationEventCount");
  });
});
