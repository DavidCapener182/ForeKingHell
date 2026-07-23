import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "drizzle/0053_course_twin_manual_putt_events.sql"),
  "utf8",
);
const store = readFileSync(join(process.cwd(), "src/lib/course-twin-round-store.ts"), "utf8");

describe("Course Twin manual-putt event migration", () => {
  it("extends both private and shared ledgers without changing their access model", () => {
    expect(migration).toContain("fkh_course_twin_round_events_type_check");
    expect(migration).toContain("fkh_course_twin_shared_events_type_check");
    expect(migration.match(/'putt.accepted'/g)).toHaveLength(2);
    expect(migration).toContain(
      "ALTER TABLE public.fkh_course_twin_round_events FORCE ROW LEVEL SECURITY",
    );
    expect(migration).toContain(
      "ALTER TABLE public.fkh_course_twin_shared_round_events FORCE ROW LEVEL SECURITY",
    );
  });

  it("rejects manual putts outside an enabled, reconciled green sequence", () => {
    expect(store).toContain("Manual putting is not enabled for this round.");
    expect(store).toContain("The ball must be on the green before putting.");
    expect(store).toContain("Putt number is out of sequence.");
    expect(store).toContain("Manual putt count does not reconcile with the putting ledger.");
  });
});
