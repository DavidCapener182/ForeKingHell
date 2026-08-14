import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readAppPage(route: string) {
  return readFileSync(join(process.cwd(), `src/app/(app)/coach/${route}/page.tsx`), "utf8");
}

describe("Coach companion and desktop workbench boundaries", () => {
  it("keeps diagnosis to its desktop-only evidence workbench", () => {
    const source = readAppPage("diagnosis");

    expect(source).toContain("DesktopWorkbenchLayout");
    expect(source).toContain("CoachDiagnosisEvidenceTable");
    expect(source).toContain('exportTableId="coach-diagnosis-evidence"');
    expect(source).toContain("DiagnosisClubCard");
    expect(source).not.toContain("MobileCoachDiagnosis");
    expect(source).not.toContain("MobileAppShell");
    expect(source).not.toContain("@/components/app/ios-mobile");
  });

  it("keeps reports to one desktop-only creation and revocation workbench", () => {
    const source = readAppPage("reports");

    expect(source).toContain("createCoachReportAction");
    expect(source).toContain("Generate private link");
    expect(source).toContain("coachReportSectionIds.map");
    expect(source).toContain("PrivacyCheck");
    expect(source).toContain("Report history");
    expect(source).toContain("revokeCoachReportAction");
    expect(source).toContain("ConfirmSubmitButton");
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

  it("keeps workspace to one desktop-only player evidence and action workbench", () => {
    const source = readAppPage("workspace");

    expect(source).toContain("Assigned players");
    expect(source).toContain("Current coaching read");
    expect(source).toContain("Player evidence");
    expect(source).toContain("Add coach interaction");
    expect(source).toContain("createCoachInteractionAction");
    expect(source).toContain('name="interactionType"');
    expect(source).toContain('name="sessionId"');
    expect(source).toContain('name="practicePlanId"');
    expect(source).toContain("InteractionTimeline");
    expect(source).toContain("updateCoachInteractionStatusAction");
    expect(source).toContain("completePlayerInteractionAction");
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
