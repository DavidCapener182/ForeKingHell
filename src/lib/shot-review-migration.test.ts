import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "drizzle/0056_shot_review_lifecycle.sql"),
  "utf8",
);
const repairMigration = readFileSync(
  join(process.cwd(), "drizzle/0057_shot_review_warm_up_security_repair.sql"),
  "utf8",
);
const schema = readFileSync(join(process.cwd(), "src/db/schema.ts"), "utf8");

describe("shot review lifecycle migration", () => {
  it("adds current lifecycle state and preserves the prior compatibility tag", () => {
    for (const column of [
      "review_status",
      "review_reason",
      "review_confidence",
      "review_source",
      "review_previous_quality_tag",
      "reviewed_at",
    ]) {
      expect(migration).toContain(column);
    }
    for (const status of [
      "included",
      "suggested_exclusion",
      "user_excluded",
      "restored",
      "calibration",
      "warm_up",
      "launch_monitor_error",
    ]) {
      expect(migration).toContain(`'${status}'`);
      expect(schema).toContain(`'${status}'`);
    }
    expect(migration).not.toMatch(/UPDATE[\s\S]*source_raw_json\s*=/i);
  });

  it("creates a server-write-only event model with compatibility-tag provenance", () => {
    expect(migration).toContain("CREATE TABLE public.fkh_shot_review_events");
    expect(migration).toContain("previous_status varchar(32) NOT NULL");
    expect(migration).toContain("previous_quality_tag varchar(40)");
    expect(migration).toContain("resulting_quality_tag varchar(40)");
    expect(migration).toContain("GRANT SELECT ON TABLE public.fkh_shot_review_events");
    expect(migration).toContain("DROP POLICY IF EXISTS fkh_shot_review_events_owner_insert");
    expect(migration).not.toContain("CREATE POLICY fkh_shot_review_events_owner_insert");
    expect(migration).not.toMatch(/GRANT\s+[^;]*INSERT[^;]*fkh_shot_review_events/i);
    expect(migration).not.toContain("fkh_shot_review_events_owner_update");
    expect(migration).not.toContain("fkh_shot_review_events_owner_delete");
    expect(migration).not.toMatch(/GRANT\s+[^;]*(UPDATE|DELETE)[^;]*fkh_shot_review_events/i);
  });

  it("backfills existing exclusion-class tags with an explicit migration event", () => {
    expect(migration).toContain(
      "Legacy quality flag classified during review lifecycle migration.",
    );
    expect(migration).toContain("INSERT INTO public.fkh_shot_review_events");
    expect(migration).toContain("WHERE review_source = 'migration'");
    expect(migration).toContain("IN ('fat', 'mishit', 'thin', 'top')");
    expect(migration).toContain("THEN 'suggested_exclusion'");
    expect(migration).toContain("IN ('warm-up', 'warmup', 'warm_up')");
    expect(migration).toContain("  'warm_up',\n  'bad-data',");
  });

  it("repairs untouched live warm_up rows exactly once without overwriting review decisions", () => {
    expect(repairMigration).toContain("WITH newly_classified AS");
    expect(repairMigration).toContain("WHERE lower(coalesce(shot.quality_tag, '')) = 'warm_up'");
    for (const untouchedGuard of [
      "shot.review_status = 'included'",
      "shot.review_reason IS NULL",
      "shot.review_confidence IS NULL",
      "shot.review_source IS NULL",
      "shot.review_previous_quality_tag IS NULL",
      "shot.reviewed_at IS NULL",
    ]) {
      expect(repairMigration).toContain(untouchedGuard);
    }
    expect(repairMigration).toContain("AND NOT EXISTS (");
    expect(repairMigration).toContain("existing_event.source = 'migration'");
    expect(repairMigration).toContain("existing_event.status = 'warm_up'");
    expect(repairMigration).toContain("INSERT INTO public.fkh_shot_review_events");
    expect(repairMigration).toContain("FROM newly_classified;");
    expect(repairMigration).not.toMatch(/UPDATE[\s\S]*source_raw_json\s*=/i);
  });

  it("removes authenticated event inserts in the live follow-up", () => {
    expect(repairMigration).toContain("DROP POLICY IF EXISTS fkh_shot_review_events_owner_insert");
    expect(repairMigration).toContain("REVOKE INSERT ON TABLE public.fkh_shot_review_events");
    expect(repairMigration).toContain("FROM PUBLIC, anon, authenticated");
    expect(repairMigration).toContain(
      "GRANT SELECT ON TABLE public.fkh_shot_review_events TO authenticated",
    );
    expect(repairMigration).not.toContain("CREATE POLICY fkh_shot_review_events_owner_insert");
    expect(repairMigration).not.toMatch(/GRANT\s+[^;]*INSERT[^;]*fkh_shot_review_events/i);
  });

  it("keeps schema and migration review source constraints in parity", () => {
    expect(migration).toContain("fkh_shots_review_source_check");
    expect(schema).toContain("fkh_shots_review_source_check");
    for (const source of ["user", "system", "import", "migration"]) {
      expect(migration).toContain(`'${source}'`);
      expect(schema).toContain(`'${source}'`);
    }
  });
});
