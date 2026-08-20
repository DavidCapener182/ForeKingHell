import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "drizzle/0055_account_course_favourites.sql"),
  "utf8",
);

describe("course favourites migration", () => {
  it("is replay-safe and grants authenticated clients only the intended operations", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.fkh_course_favourites");
    expect(migration).toContain(
      "REVOKE ALL ON TABLE public.fkh_course_favourites FROM PUBLIC, anon, authenticated",
    );
    expect(migration).toContain(
      "GRANT SELECT, INSERT, DELETE ON TABLE public.fkh_course_favourites TO authenticated",
    );
    expect(migration).not.toMatch(/GRANT\s+[^;]*(UPDATE|TRUNCATE)[^;]*fkh_course_favourites/i);
  });
});
