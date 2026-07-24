import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/lib/course-twin-round-store.ts"), "utf8");

describe("Course Twin round persistence boundary", () => {
  it("materialises only measured Live rounds into normal analytics sessions", () => {
    expect(source).toContain("courseTwinRoundCreatesAnalyticsSession(updated.mode)");
    expect(source).toContain('source: "course_twin_live"');
    expect(source).not.toContain('"course_twin_virtual"');
  });
});
