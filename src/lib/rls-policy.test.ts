import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "drizzle/0008_public_master_mold.sql"), "utf8");
const shareLinkMigration = readFileSync(join(process.cwd(), "drizzle/0010_messy_ikaris.sql"), "utf8");

describe("RLS migration", () => {
  it("enables RLS on user-owned roadmap tables", () => {
    for (const table of [
      "fkh_users",
      "fkh_clubs",
      "fkh_sessions",
      "fkh_import_files",
      "fkh_shots",
      "fkh_ball_models",
      "fkh_club_equipment_history",
      "fkh_strokes_gained_shot_events",
      "fkh_account_memberships",
      "fkh_account_invitations",
    ]) {
      expect(migration).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
    }
  });

  it("creates membership-aware helper policies", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.fkh_can_access_user");
    expect(migration).toContain("membership.role = ANY(allowed_roles)");
    expect(migration).toContain("ARRAY['coach','viewer','editor']");
    expect(migration).toContain("ARRAY['editor']");
  });

  it("keeps shared courses readable while private courses stay owner controlled", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.fkh_can_read_course");
    expect(migration).toContain("course_row.visibility = 'shared'");
    expect(migration).toContain("CREATE POLICY \"fkh_courses_update_owned\"");
  });

  it("protects private share link records behind owner RLS", () => {
    expect(shareLinkMigration).toContain('ALTER TABLE "fkh_share_links" ENABLE ROW LEVEL SECURITY');
    expect(shareLinkMigration).toContain('CREATE POLICY "fkh_share_links_owner_all"');
    expect(shareLinkMigration).toContain('"user_id" = auth.uid()');
  });
});
