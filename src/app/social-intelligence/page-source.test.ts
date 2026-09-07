import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/social-intelligence/page.tsx"),
  "utf8",
);

const form = readFileSync(
  join(process.cwd(), "src/app/social-intelligence/social-task-form.tsx"),
  "utf8",
);
const records = readFileSync(
  join(process.cwd(), "src/app/social-intelligence/safety-records.tsx"),
  "utf8",
);

describe("social intelligence desktop safety console", () => {
  it("ships only the safety workbench graph on this desktop-only route", () => {
    expect(source).toContain("<PageShell>");
    expect(source.match(/<PageShell>/g)).toHaveLength(1);
    expect(source).not.toMatch(/max-w-(?:6xl|7xl|\[1500px\])/);
    for (const obsolete of [
      "getRequestAppSurface",
      "MobileAppShell",
      "MobileSocialSafetyQueue",
      "MobileSocialRecaps",
      "MobileSafetyTechnicalDetails",
      "BottomSheet",
      "IOSDisclosureGroup",
      'surface === "companion"',
    ]) {
      expect(source).not.toContain(obsolete);
    }
  });

  it("keeps the safety queue as an exportable desktop table", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('viewKey="social-safety"');
    expect(source).toContain('scope="social-safety"');
    expect(source).toContain('data-workbench-scope="social-safety"');
    expect(source).toContain('exportTableId="social-safety"');
    expect(source).toContain("<SafetyRecords");
    expect(records).toContain('data-workbench-export-table="social-safety"');
    expect(records).toContain("<caption");
    expect(records).toContain("tabIndex={0}");
    expect(records).toContain("visible.map((row)");
    expect(records).toContain('data-column={id === "createdAt" ? "created" : id}');
    for (const column of [
      "source",
      "severity",
      "status",
      "reason",
      "target",
      "detail",
      "createdAt",
    ]) {
      expect(records).toContain(`["${column}",`);
    }
  });

  it("does not add the contextual AI rail to the social safety route", () => {
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("WorkbenchPrompts");
    expect(source).not.toContain("rail={");
  });

  it("preserves the workbench report and summary actions", () => {
    expect(source).toContain('task="generate"');
    expect(source).toContain('task="report"');
    expect(form).toContain('data.set("operation", task)');
    expect(form).toContain("socialIntelligenceFormAction");
    expect(form).toContain("Confirm report");
    expect(form).toContain("Confirm generation");
    expect(form).toContain("if (busy.current) return");
  });

  it("uses the shared shadcn textarea for report details", () => {
    expect(form).toContain('import { Textarea } from "@/components/ui/textarea"');
    expect(form).toContain("<Textarea");
    expect(form).not.toMatch(/<textarea\b/);
  });

  it("uses theme-aware ordinary safety surfaces", () => {
    expect(source).toContain("bg-card");
    expect(source).toContain('className="grid min-w-0 gap-3"');
    expect(source).not.toMatch(/\b(?:bg-white|bg-slate-\d+|text-slate-\d+|border-slate-\d+)\b/);
    expect(source).not.toMatch(/bg-\[#[0-9A-Fa-f]+\]|text-white|text-(?:emerald|red)-\d+/);
  });
});
