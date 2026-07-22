import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "scripts/live-rls-persona-check.mjs"), "utf8");

describe("live RLS persona probe", () => {
  it("covers delegated, social, group, admin, stranger, and anonymous boundaries", () => {
    for (const persona of [
      "owner",
      "coach",
      "viewer",
      "editor",
      "friend",
      "stranger",
      "blocked",
      "moderator",
      "administrator",
    ]) {
      expect(source).toContain(`${persona}: randomUUID()`);
    }

    expect(source).toContain("set local role authenticated");
    expect(source).toContain("set local role anon");
    expect(source).toContain("ROLLBACK_RLS_PROBE");
    expect(source).toContain('transaction: "rolled-back"');
  });

  it("keeps friendship separate from delegated private golf-data access", () => {
    expect(source).toContain("friend.visiblePrivateGolfRows === 0");
    expect(source).toContain("coach.visibleOwnerRows === 1");
    expect(source).toContain("viewer.updates === 0");
    expect(source).toContain("editor.updates === 1");
  });

  it("proves Coach Workspace visibility, mutation and revocation boundaries", () => {
    expect(source).toContain("insert into fkh_coach_player_interactions");
    expect(source).toContain("coachWorkspace.coachVisibleRows === 3");
    expect(source).toContain("coachWorkspace.coachInserts === 1");
    expect(source).toContain("coachWorkspace.coachUpdates === 1");
    expect(source).toContain("coachWorkspace.playerVisibleRows === 2");
    expect(source).toContain("coachWorkspace.playerUpdates === 0");
    expect(source).toContain("coachWorkspace.viewerVisibleRows === 0");
    expect(source).toContain("coachWorkspace.revokedCoachVisibleRows === 0");
  });
});
