import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "drizzle/0051_course_twin_public_rooms.sql"),
  "utf8",
);

describe("Course Twin public-room migration", () => {
  it("keeps private as the default and indexes bounded public discovery", () => {
    expect(migration).toContain("DEFAULT 'private'");
    expect(migration).toContain("CHECK (visibility IN ('private', 'public'))");
    expect(migration).toContain("fkh_course_twin_rooms_matchmaking_idx");
    expect(migration).not.toContain("GRANT SELECT");
  });
});
