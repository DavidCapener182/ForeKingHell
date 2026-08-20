import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/shots/shot-review-controls.tsx"), "utf8");

describe("shot review controls", () => {
  it("makes exclusion reversible and records reason and confidence", () => {
    expect(source).toContain("<AlertDialog");
    expect(source).toContain("restoreShotAction");
    expect(source).toContain("reviewShotsAction");
    expect(source).toContain("excludeShotAction");
    expect(source).toContain("<Textarea");
    expect(source).toContain("Confidence");
    expect(source).toContain("Source data and review history remain unchanged");
    expect(source).toContain("<AlertDescription");
    expect(source).not.toContain('<p role="alert"');
    expect(source).not.toContain("deleteShotAction");
    expect(source).not.toContain("permanently removes");
  });

  it("dismisses a suggested exclusion as Keep shot without losing evidence", () => {
    expect(source).toContain('reviewStatus === "suggested_exclusion"');
    expect(source).toContain('"Keep shot"');
    expect(source).toContain("suggested exclusion dismissed");
    expect(source).toContain("Raw source evidence and review history remain unchanged");
    expect(source).toContain("Suggestion dismissal confidence is recorded as 100%.");
  });
});
