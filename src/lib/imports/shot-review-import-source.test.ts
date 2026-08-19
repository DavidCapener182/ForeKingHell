import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/lib/imports/save-rapsodo-import.ts"), "utf8");

describe("imported shot review provenance", () => {
  it("initializes classified lifecycle fields without changing retained raw source", () => {
    expect(source).toContain("buildImportedShotReviewLifecycle");
    expect(source).toContain("reviewStatus: review.reviewStatus");
    expect(source).toContain("reviewReason: review.reviewReason");
    expect(source).toContain("reviewConfidence: review.reviewConfidence");
    expect(source).toContain("reviewSource: review.reviewSource");
    expect(source).toContain("sourceRawJson: shot.sourceRawJson");
  });

  it("appends one import-owned event for every classified inserted shot", () => {
    expect(source).toContain("tx.insert(shotReviewEvents).values(importedReviewEvents)");
    expect(source).toContain('previousStatus: "included"');
    expect(source).toContain('source: "import"');
    expect(source).toContain("previousQualityTag: null");
    expect(source).toContain("resultingQualityTag: shot.qualityTag");
  });
});
