import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/api/desktop-workbench/commands/route.ts"),
  "utf8",
);

describe("desktop workbench command search source", () => {
  it("searches the workspace entities promised by the desktop shell", () => {
    for (const table of ["clubs", "sessions", "courses", "userProfiles"]) {
      expect(source).toContain(`from(${table})`);
    }

    expect(source).toContain("getFriendIds(user.id)");
    expect(source).toContain("roundSessionTypes");
    expect(source).toContain("clubRows");
    expect(source).toContain("roundRows");
    expect(source).toContain("sessionRows");
    expect(source).toContain("courseRows");
    expect(source).toContain("friendRows");

    for (const commandBuilder of [
      "clubCommand",
      "roundCommand",
      "sessionCommand",
      "courseCommand",
      "friendCommand",
    ]) {
      expect(source).toContain(`function ${commandBuilder}`);
      expect(source).toContain(`.map(${commandBuilder})`);
    }
  });

  it("links command results to the correct desktop destinations", () => {
    expect(source).toContain("href: `/bag/${club.id}/analytics`");
    expect(source).toContain("href: `/rounds/${round.id}`");
    expect(source).toContain("href: `/today?session=${session.id}`");
    expect(source).toContain("href: `/courses/${course.id}/records`");
    expect(source).toContain("href: `/profile/${friend.username}`");

    for (const type of [
      'type: "club"',
      'type: "round"',
      'type: "session"',
      'type: "course"',
      'type: "friend"',
    ]) {
      expect(source).toContain(type);
    }
  });

  it("keeps command keywords useful for power-user search", () => {
    for (const keyword of [
      "club bag analytics gapping carry dispersion trust",
      "round scorecard handicap course review",
      "latest practice session range import review",
      "course records holes map source health",
      "friend profile social compare",
    ]) {
      expect(source).toContain(keyword);
    }

    expect(source).toContain(".slice(0, 32)");
  });
});
