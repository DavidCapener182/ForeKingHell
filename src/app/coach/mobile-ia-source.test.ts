import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readAppPage(route: string) {
  return readFileSync(join(process.cwd(), `src/app/(app)/coach/${route}/page.tsx`), "utf8");
}

describe("Coach companion and desktop workbench boundaries", () => {
  it("keeps diagnosis to its responsive evidence workbench", () => {
    const source = readAppPage("diagnosis");

    expect(source).toContain("<PageShell>");
    expect(source).toContain("<DiagnosisClient cards={coach.clubCards}");
    const client = readFileSync(
      join(process.cwd(), "src/app/coach/diagnosis/diagnosis-client.tsx"),
      "utf8",
    );
    expect(client).toContain("CoachDiagnosisEvidenceTable");
    expect(client).toContain('exportTableId="coach-diagnosis-evidence"');
    expect(client).toContain('aria-label="Ranked club drills"');
    expect(client).toContain("After two comparable sessions");
    expect(source).not.toContain("MobileCoachDiagnosis");
    expect(source).not.toContain("MobileAppShell");
    expect(source).not.toContain("@/components/app/ios-mobile");
  });

  it("keeps reports to one responsive creation and revocation workbench", () => {
    const source = readAppPage("reports");

    const builder = readFileSync(
      join(process.cwd(), "src/app/coach/reports/report-builder.tsx"),
      "utf8",
    );
    const controls = readFileSync(
      join(process.cwd(), "src/app/coach/reports/report-controls.tsx"),
      "utf8",
    );
    expect(source).toContain("<ReportBuilder");
    expect(builder).toContain("createCoachReportWithStateAction");
    expect(builder).toContain("Create frozen report link");
    expect(builder).toContain("coachReportSectionIds.map");
    expect(builder).toContain("Private coach notes and unselected sections are excluded");
    expect(source).toContain("Report history");
    expect(source).toContain("<RevokeReport");
    expect(controls).toContain("revokeCoachReportWithStateAction");
    expect(controls).toContain("<AlertDialog");
    expect(controls).toContain("Confirm revocation");
    for (const obsoleteMobileSource of [
      "MobileCoachReports",
      "MobileReportReady",
      "MobileReportHistory",
      "MobileAppShell",
      "MobileTopBar",
      "BottomSheet",
      "@/components/app/ios-mobile",
      "IOSDisclosureGroup",
      "getRequestAppSurface",
      'surface === "companion"',
      "lg:hidden",
      "hidden lg:",
    ]) {
      expect(source).not.toContain(obsoleteMobileSource);
    }
  });

  it("keeps workspace to one responsive player evidence and action workbench", () => {
    const source = readAppPage("workspace");

    expect(source).toContain("Assigned players");
    expect(source).toContain("Current coaching read");
    expect(source).toContain("Player evidence");
    expect(source).toContain("Add coach interaction");
    expect(source).toContain("createCoachInteractionWithStateAction");
    expect(source).toContain('name="interactionType"');
    expect(source).toContain('name="sessionId"');
    expect(source).toContain('name="practicePlanId"');
    expect(source).toContain("InteractionTimeline");
    expect(source).toContain("updateCoachInteractionStatusWithStateAction");
    expect(source).toContain("completePlayerInteractionWithStateAction");
    for (const obsoleteMobileSource of [
      "MobileCoachWorkspace",
      "MobileSelectedPlayerWorkspace",
      "MobileCoachInteractionForm",
      "MobilePlayerInbox",
      "MobileInteractionRows",
      "MobileAppShell",
      "MobileTopBar",
      "BottomSheet",
      "@/components/app/ios-mobile",
      "IOSDisclosureGroup",
      "getRequestAppSurface",
      'surface === "companion"',
      "lg:hidden",
      "hidden lg:",
    ]) {
      expect(source).not.toContain(obsoleteMobileSource);
    }
  });
});
