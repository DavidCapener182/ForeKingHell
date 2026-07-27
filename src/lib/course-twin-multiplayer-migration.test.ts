import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "drizzle/0047_course_twin_multiplayer.sql"),
  "utf8",
);

describe("Course Twin multiplayer migration", () => {
  it("creates bounded rooms, member presence and append-only events", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.fkh_course_twin_rooms");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.fkh_course_twin_room_members");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.fkh_course_twin_room_events");
    expect(migration).toContain("max_players BETWEEN 2 AND 4");
    expect(migration).toContain("state_version integer NOT NULL DEFAULT 1");
    expect(migration).toContain("invite_code ~ '^[A-Z2-9]{6,12}$'");
  });

  it("keeps room storage behind server-side authorization", () => {
    for (const table of [
      "fkh_course_twin_rooms",
      "fkh_course_twin_room_members",
      "fkh_course_twin_room_events",
    ]) {
      expect(migration).toContain(`ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY`);
      expect(migration).toContain(
        `REVOKE ALL ON TABLE public.${table} FROM PUBLIC, anon, authenticated`,
      );
      expect(migration).toContain(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.${table} TO service_role`,
      );
    }
  });
});
