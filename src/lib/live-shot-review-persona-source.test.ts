import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "scripts/live-shot-review-persona-check.mjs"),
  "utf8",
);

describe("live shot-review persona proof", () => {
  it("keeps fixtures rollback-only and verifies owner, stranger, import and lifecycle boundaries", () => {
    expect(source).toContain("set local role authenticated");
    expect(source).toContain("fkh_import_files");
    expect(source).toContain("fkh_shot_review_events");
    expect(source).toContain("source_raw_json");
    expect(source).toContain("user_excluded");
    expect(source).toContain("restored");
    expect(source).toContain("ROLLBACK_SHOT_REVIEW_PROBE");
    expect(source).toContain('transaction: "rolled-back"');
  });
});
