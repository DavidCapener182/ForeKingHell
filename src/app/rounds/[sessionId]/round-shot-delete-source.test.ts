import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/rounds/[sessionId]/round-corrections-panel.tsx"),
  "utf8",
);
const pageSource = readFileSync(
  join(process.cwd(), "src/app/(app)/rounds/[sessionId]/page.tsx"),
  "utf8",
);

describe("round correction shot deletion control", () => {
  it("requires a destructive confirmation with honest scorecard and raw-import copy", () => {
    expect(source).toContain("export function RoundShotDeleteButton");
    expect(source).toContain("<AlertDialog");
    expect(source).toContain("data-round-shot-delete-confirm");
    expect(source).toContain("removes one recorded stroke");
    expect(source).toContain("Valid");
    expect(source).toContain("putts and penalties stay unchanged");
    expect(source).toContain("original import file and raw import rows remain");
    expect(source).toContain("deleteRoundShotAction({ sessionId, shotId })");
  });

  it("exposes delete only in the deferred round corrections table", () => {
    expect(pageSource).toContain(
      "const RoundShotDeleteButton = correctionsModule?.RoundShotDeleteButton",
    );
    expect(pageSource).toContain("<RoundShotDeleteButton");
    expect(pageSource).toContain('data-column="delete"');
    expect(pageSource).toContain('view === "corrections" && RoundCorrectionsPanel');
  });

  it("does not offer permanent delete until a partially mapped row has a hole", () => {
    expect(source).toContain("courseHoleNumber === null || courseHoleNumber < 1");
    expect(source).toContain("data-round-shot-delete-unassigned");
    expect(source).toContain("Assign this shot to a hole through the round split");
    expect(source).toContain("scorecard impact can be verified");
  });
});
