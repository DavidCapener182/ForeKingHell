import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/shots/shot-review-controls.tsx"), "utf8");

describe("shot review and delete controls", () => {
  it("makes exclusion reversible and records reason and confidence", () => {
    expect(source).toContain("<AlertDialog");
    expect(source).toContain("restoreShotAction");
    expect(source).toContain("reviewShotsAction");
    expect(source).toContain("excludeShotAction");
    expect(source).toContain("<Textarea");
    expect(source).toContain("Confidence");
    expect(source).toContain("Source data and review history remain unchanged");
    expect(source).toContain("<AlertDescription");
    expect(source).toContain("data-shot-review-confirm");
    expect(source).toContain("Exclude from stats");
    expect(source).toContain("Exclude this shot from stats?");
    expect(source).not.toContain("AlertDialogAction");
    expect(source).not.toContain("event.preventDefault()");
    expect(source).not.toContain('<p role="alert"');
    expect(source).toContain("deleteShotsAction");
  });

  it("keeps permanent deletion separate, explicit and failure-safe", () => {
    expect(source).toContain("export function ShotDeleteButton");
    expect(source).toContain("export function ShotBulkDeleteButton");
    expect(source).toContain("Permanently delete this shot?");
    expect(source).toContain("Permanently delete");
    expect(source).toContain("data-shot-delete-confirm");
    expect(source).toContain('variant="destructive"');
    expect(source).toContain(
      "The normalized shot and its review history will be permanently deleted",
    );
    expect(source).toContain("original import file and raw import rows remain");
    expect(source).toContain("reprocessing that import may recreate the shot");
    expect(source).toContain("Could not permanently delete");
  });

  it("dismisses a suggested exclusion as Keep shot without losing evidence", () => {
    expect(source).toContain('reviewStatus === "suggested_exclusion"');
    expect(source).toContain('"Keep shot"');
    expect(source).toContain("suggested exclusion dismissed");
    expect(source).toContain("Raw source evidence and review history remain unchanged");
    expect(source).toContain("Suggestion dismissal confidence is recorded as 100%.");
  });
});
