import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "drizzle/0048_course_twin_round_ledger.sql"),
  "utf8",
);

describe("Course Twin round ledger migration", () => {
  it("creates owner-scoped round and append-only event tables", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.fkh_course_twin_rounds");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.fkh_course_twin_round_events");
    expect(sql).toContain(
      "UNIQUE INDEX IF NOT EXISTS fkh_course_twin_round_events_round_client_idx",
    );
    expect(sql).toContain(
      "UNIQUE INDEX IF NOT EXISTS fkh_course_twin_round_events_round_sequence_idx",
    );
    expect(sql).toContain("fkh_course_twin_round_events_hash_check");
  });

  it("forces RLS and grants no browser table access", () => {
    expect(sql).toContain("ALTER TABLE public.fkh_course_twin_rounds FORCE ROW LEVEL SECURITY");
    expect(sql).toContain(
      "ALTER TABLE public.fkh_course_twin_round_events FORCE ROW LEVEL SECURITY",
    );
    expect(sql).toContain(
      "REVOKE ALL ON TABLE public.fkh_course_twin_rounds FROM PUBLIC, anon, authenticated",
    );
    expect(sql).toContain(
      "REVOKE ALL ON TABLE public.fkh_course_twin_round_events FROM PUBLIC, anon, authenticated",
    );
    expect(sql).toContain("REVOKE ALL ON TABLE public.fkh_course_twin_rounds FROM service_role");
    expect(sql).toContain(
      "REVOKE ALL ON TABLE public.fkh_course_twin_round_events FROM service_role",
    );
  });
});
