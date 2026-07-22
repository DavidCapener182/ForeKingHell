import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "drizzle/0049_course_twin_shared_rounds.sql"),
  "utf8",
);

describe("Course Twin shared-round migration", () => {
  it("adds spectator capacity and a unique tamper-evident event sequence", () => {
    expect(migration).toContain("spectator_limit integer NOT NULL DEFAULT 8");
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS public.fkh_course_twin_shared_round_events",
    );
    expect(migration).toContain("fkh_course_twin_shared_events_room_client_idx");
    expect(migration).toContain("fkh_course_twin_shared_events_room_sequence_idx");
    expect(migration).toContain("event_hash varchar(64) NOT NULL");
  });

  it("keeps shared events behind the server role and forced RLS", () => {
    expect(migration).toContain(
      "ALTER TABLE public.fkh_course_twin_shared_round_events FORCE ROW LEVEL SECURITY",
    );
    expect(migration).toContain(
      "REVOKE ALL ON TABLE public.fkh_course_twin_shared_round_events FROM PUBLIC, anon, authenticated",
    );
    expect(migration).toContain(
      "ON TABLE public.fkh_course_twin_shared_round_events TO service_role",
    );
  });
});
