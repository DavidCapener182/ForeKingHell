import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readAppPage(route: string) {
  return readFileSync(join(process.cwd(), `src/app/(app)/coach/${route}/page.tsx`), "utf8");
}

function functionSource(source: string, name: string, nextName: string) {
  const start = source.indexOf(`function ${name}`);
  const end = source.indexOf(`function ${nextName}`, start + 1);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("Coach native mobile information architecture", () => {
  it("puts diagnosis priority and the retest decision before secondary club evidence", () => {
    const source = readAppPage("diagnosis");
    const mobile = functionSource(source, "MobileCoachDiagnosis", "MobileDiagnosisIssueRow");

    expect(mobile).toContain("Fix this first");
    expect(mobile).toContain("Retest decision");
    expect(mobile).toContain("Issues by club");
    expect(mobile.indexOf("Fix this first")).toBeLessThan(mobile.indexOf("Retest decision"));
    expect(mobile.indexOf("Retest decision")).toBeLessThan(mobile.indexOf("Issues by club"));
    expect(mobile).toContain("IOSDisclosureGroup");
    expect(source).toContain("CoachDiagnosisEvidenceTable");
    expect(source).toContain('exportTableId="coach-diagnosis-evidence"');
  });

  it("keeps report creation as a focused template, sections, privacy and review task", () => {
    const source = readAppPage("reports");
    const mobile = functionSource(source, "MobileCoachReports", "MobileReportReady");

    for (const step of ["1. Template", "2. Sections", "3. Privacy", "4. Review"]) {
      expect(mobile).toContain(step);
    }
    expect(mobile.indexOf("1. Template")).toBeLessThan(mobile.indexOf("2. Sections"));
    expect(mobile.indexOf("2. Sections")).toBeLessThan(mobile.indexOf("3. Privacy"));
    expect(mobile.indexOf("3. Privacy")).toBeLessThan(mobile.indexOf("4. Review"));
    expect(mobile).toContain("createCoachReportAction");
    expect(mobile).toContain("Generate private link");
    expect(source).toContain("revokeCoachReportAction");
    expect(source).toContain("MobileReportHistory");
  });

  it("puts player selection, priority and the next action before workspace history", () => {
    const source = readAppPage("workspace");
    const mobile = functionSource(
      source,
      "MobileSelectedPlayerWorkspace",
      "MobileCoachInteractionForm",
    );

    expect(mobile).toContain("Assigned player");
    expect(mobile).toContain("Current coaching priority");
    expect(mobile).toContain("Add next action");
    expect(mobile).toContain("Evidence and history");
    expect(mobile.indexOf("Assigned player")).toBeLessThan(
      mobile.indexOf("Current coaching priority"),
    );
    expect(mobile.indexOf("Current coaching priority")).toBeLessThan(
      mobile.indexOf("Evidence and history"),
    );
    expect(mobile).toContain("BottomSheet");
    expect(mobile).toContain("IOSDisclosureGroup");

    const actionForm = functionSource(source, "MobileCoachInteractionForm", "MobilePlayerEvidence");
    expect(actionForm).toContain("createCoachInteractionAction");
    expect(actionForm).toContain('name="interactionType"');
    expect(actionForm).toContain('name="sessionId"');
    expect(actionForm).toContain('name="practicePlanId"');
    expect(source).toContain("updateCoachInteractionStatusAction");
    expect(source).toContain("completePlayerInteractionAction");
  });
});
