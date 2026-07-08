import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/app/desktop-save-insight-button.tsx"),
  "utf8",
);

describe("desktop save insight button source", () => {
  it("writes rail insights into the command-palette saved-insights store", () => {
    expect(source).toContain('"use client"');
    expect(source).toContain('const savedInsightStorageKey = "fkh:desktop-saved-insights"');
    expect(source).toContain(
      'export const savedInsightUpdatedEvent = "fkh:desktop-saved-insights-updated"',
    );
    expect(source).toContain("window.localStorage.setItem(savedInsightStorageKey");
    expect(source).toContain("window.dispatchEvent(new CustomEvent(savedInsightUpdatedEvent))");
    expect(source).toContain("Save this insight");
    expect(source).toContain("Insight saved");
  });
});
