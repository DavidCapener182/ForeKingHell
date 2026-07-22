import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "drizzle/0045_course_twin_platform.sql"),
  "utf8",
);
const activeVersionIndexMigration = readFileSync(
  join(process.cwd(), "drizzle/0046_course_twin_active_version_fk_index.sql"),
  "utf8",
);
const schema = readFileSync(join(process.cwd(), "src/db/schema.ts"), "utf8");

describe("Course Twin platform migration", () => {
  it("enables and forces RLS on every Course Twin table", () => {
    for (const table of [
      "fkh_course_twins",
      "fkh_course_twin_versions",
      "fkh_course_twin_builds",
      "fkh_course_twin_corrections",
    ]) {
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(migration).toContain(`ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY`);
      expect(migration).toContain(
        `REVOKE ALL ON TABLE public.${table} FROM PUBLIC, anon, authenticated`,
      );
    }
  });

  it("exposes only the active published package to normal authenticated users", () => {
    expect(migration).toContain("status = 'published'");
    expect(migration).toContain("twin.status = 'published'");
    expect(migration).toContain("twin.active_version_id = fkh_course_twin_versions.id");
    expect(migration).toContain("public.fkh_can_read_course(course)");
    expect(migration).toContain("admin_user.status = 'active'");
  });

  it("keeps browser grants read-only and server-side mutations explicit", () => {
    expect(migration).toContain(
      "Authenticated browser sessions intentionally receive SELECT only.",
    );
    expect(migration).not.toMatch(/GRANT[^;]*(?:INSERT|UPDATE|DELETE|ALL)[^;]*TO authenticated/i);
    expect(migration).toContain(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.fkh_course_twins TO service_role",
    );
    expect(migration).toContain("DROP POLICY IF EXISTS fkh_course_twins_select_course_access");
  });

  it("indexes the active-version foreign key in SQL and Drizzle schema", () => {
    expect(migration).toContain("CREATE INDEX IF NOT EXISTS fkh_course_twins_active_version_idx");
    expect(activeVersionIndexMigration).toContain(
      "ON public.fkh_course_twins(active_version_id, id)",
    );
    expect(schema).toContain(
      'index("fkh_course_twins_active_version_idx").on(table.activeVersionId, table.id)',
    );
  });
});
