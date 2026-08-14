import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = readFileSync(join(root, "src/app/share/report/[token]/page.tsx"), "utf8");
const companion = readFileSync(
  join(root, "src/app/share/report/[token]/shared-coach-report-companion.tsx"),
  "utf8",
);
const workbench = readFileSync(
  join(root, "src/app/share/report/[token]/shared-coach-report-workbench.tsx"),
  "utf8",
);
const passwordForm = readFileSync(
  join(root, "src/app/share/report/[token]/shared-coach-report-password-form.tsx"),
  "utf8",
);
const alertSource = readFileSync(join(root, "src/components/ui/alert.tsx"), "utf8");

describe("shared coach report request-surface composition", () => {
  it("chooses exactly one server graph before importing report UI", () => {
    expect(source).toContain("getRequestAppSurface()");
    expect(source).toContain('surface === "companion"');
    expect(source).toContain('import("./shared-coach-report-companion")');
    expect(source).toContain('import("./shared-coach-report-workbench")');
    expect(source.indexOf("getRequestAppSurface()")).toBeLessThan(
      source.indexOf('import("./shared-coach-report-companion")'),
    );
    expect(source).not.toContain("MobileCoachReport");
    expect(source).not.toContain("ReportSections");
    expect(source).not.toContain("IOSDisclosureGroup");
    expect(source).not.toContain('from "@/components/ui/table"');
    expect(source).not.toMatch(/lg:hidden|hidden lg:|max-lg:hidden/);
  });

  it("keeps the companion privacy journey in its isolated graph", () => {
    expect(companion).toContain("MobileCoachReportSections");
    expect(companion).toContain("IOSDisclosureGroup");
    expect(companion).toContain("MobileTopBar");
    expect(companion).toContain("This link grants access only to this frozen report");
    expect(companion).not.toContain("function ReportSections(");
    expect(companion).not.toContain('from "@/components/ui/table"');
    expect(companion).not.toMatch(/lg:hidden|hidden lg:|max-lg:hidden/);
  });

  it("keeps the full workbench report in its isolated graph", () => {
    expect(workbench).toContain("function ReportSections(");
    expect(workbench.match(/<Table\b/g)).toHaveLength(3);
    expect(workbench).toContain("Frozen coach evidence");
    expect(workbench).not.toContain("MobileCoachReport");
    expect(workbench).not.toContain("IOSDisclosureGroup");
    expect(workbench).not.toMatch(/lg:hidden|hidden lg:|max-lg:hidden/);
  });

  it("keeps both password gates focused and keyboard friendly", () => {
    expect(companion).toContain('headingLevel="h2"');
    expect(workbench).toContain('headingLevel="h1"');
    expect(passwordForm).toContain('autoComplete="current-password"');
    expect(passwordForm).toContain('className="min-h-11"');
    expect(passwordForm).toContain('<Alert variant="destructive">');
    expect(passwordForm).toContain("<AlertDescription");
    expect(alertSource).toContain('role="alert"');
  });
});
