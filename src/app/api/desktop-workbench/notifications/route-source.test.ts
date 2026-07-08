import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/api/desktop-workbench/notifications/route.ts"),
  "utf8",
);

describe("desktop workbench notifications route source", () => {
  it("keeps the notification centre backed by the desktop shell event types", () => {
    for (const table of [
      "challengeInvites",
      "challenges",
      "friendRequests",
      "importFiles",
      "userAchievements",
    ]) {
      expect(source).toContain(table);
    }

    expect(source).toContain("friendRows");
    expect(source).toContain("challengeRows");
    expect(source).toContain("latestImportRows");
    expect(source).toContain("duplicateImportRows");
    expect(source).toContain("latestAchievementRows");
    expect(source).toContain("Promise.all");
  });

  it("labels friend requests, challenge invites, imports, data warnings and achievements distinctly", () => {
    for (const prefix of [
      "friend-${row.id}",
      "challenge-${row.id}",
      "import-${row.id}",
      "data-warning-${row.id}",
      "achievement-${row.id}",
    ]) {
      expect(source).toContain(prefix);
    }

    expect(source).toContain("sent a friend request");
    expect(source).toContain("Challenge invite:");
    expect(source).toContain("Import ${importStatusLabel(row.status)}");
    expect(source).toContain("Duplicate import warning");
    expect(source).toContain("Achievement unlocked:");
    expect(source).toContain("achievementUnlockHref(row.achievementId)");
  });

  it("keeps quiet public fallbacks and bounded notification payloads", () => {
    expect(source).toContain("if (!user)");
    expect(source).toContain("NextResponse.json({ items: [] })");
    expect(source).toContain(".sort((left, right) =>");
    expect(source).toContain(".slice(0, 8)");
    expect(source).not.toContain("status: 401");
  });
});
