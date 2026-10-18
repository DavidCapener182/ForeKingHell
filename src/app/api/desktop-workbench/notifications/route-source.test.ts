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

  it("binds practice evidence and each analysed upload to the authenticated owner", () => {
    expect(source).toContain("eq(practicePlans.userId, user.id)");
    expect(source).toContain("eq(practicePlanMatches.userId, user.id)");
    expect(source).toContain("eq(practiceResults.userId, user.id)");
    expect(source).toContain("eq(sessions.userId, user.id)");
    expect(source).toContain("row.resultSessionId === row.sessionId");
    expect(source).toContain("sourceIds.includes(row.sessionId)");
    expect(source).toContain("practiceReviewNotification");
  });

  it("keeps quiet public fallbacks and bounded notification payloads", () => {
    expect(source).toContain("if (!user)");
    expect(source).toContain("NextResponse.json({ items: [] })");
    expect(source).toContain(".sort((left, right) =>");
    expect(source).toContain(".slice(0, 8)");
    const getHandler = source.slice(
      source.indexOf("export async function GET"),
      source.indexOf("export async function POST"),
    );
    expect(getHandler).not.toMatch(/status:\s*401/);
    const postHandler = source.slice(source.indexOf("export async function POST"));
    expect(postHandler).toContain("if (!user)");
    expect(postHandler).toMatch(/status:\s*401/);
  });
});
