import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../app/courses/actions.ts", import.meta.url), "utf8");

describe("Google course import ownership", () => {
  it("limits target discovery, updates and duplicate deletion to owned or system-shared courses", () => {
    expect(source.match(/importTargetAccess\(userId\)/g)?.length).toBeGreaterThanOrEqual(5);
    expect(source).toContain("setWhere: importTargetAccess(userId)");
    expect(source).toContain(
      "deleteUnreferencedGoogleDuplicateCourse(exactGoogleMatch.id, userId)",
    );
  });

  it("does not silently continue when a global provider conflict is outside the account scope", () => {
    expect(source).toContain("if (!course)");
    expect(source).toContain("could not be imported safely");
  });
});
