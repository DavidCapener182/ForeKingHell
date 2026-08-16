import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/lib/today-session-data.ts"), "utf8");

describe("today session data cleaning source", () => {
  it("can resolve a selected upload to its complete practice day", () => {
    expect(source).toContain('scope?: "session" | "day"');
    expect(source).toContain('const scopeToSession = filters.scope !== "day"');
    expect(source).toContain("scopeToSession && defaultSessionId");
    expect(source).toContain("scopeToSession && filters.sessionId");
  });

  it("selects quality tags and separates clean scoring from raw shot history", () => {
    expect(source).toContain("qualityTag: shots.qualityTag");
    expect(source).toContain('"top"');
    expect(source).toContain("isExcludedPracticeQualityTag");
    expect(source).toContain("detectShotDataIntegrityIssue");
    expect(source).toContain("dataIntegrityIssue === null");
    expect(source).toContain(
      "const cleanTodayRows = filteredTodayRows.filter(isCleanPracticeShot)",
    );
    expect(source).toContain("shots: cleanTodayRows");
    expect(source).toContain("rawShots: filteredTodayRows");
    expect(source).toContain("dataCleaning: buildDataCleaningSummary");
  });
});
