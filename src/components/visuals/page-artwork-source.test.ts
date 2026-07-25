import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/visuals/page-artwork.tsx"), "utf8");

describe("desktop page artwork variants", () => {
  it("keeps the desktop platform, practice, AI and social variants available", () => {
    for (const variant of [
      "billing",
      "settings",
      "admin",
      "practice",
      "speed",
      "dataChat",
      "challenges",
      "groups",
    ]) {
      expect(source).toContain(`| "${variant}"`);
      expect(source).toContain(`${variant}: "/assets/`);
      expect(source).toContain(`${variant}: "from-`);
    }
  });

  it("avoids the old placeholder artwork on the high-traffic golfer pages", () => {
    expect(source).toContain('speed: "/assets/page-speed-bay.webp"');
    expect(source).toContain('groups: "/assets/page-groups-clubhouse.webp"');
    expect(source).toContain('settings: "/assets/page-settings-locker.webp"');
    expect(source).toContain('friends: "/assets/page-friends-match.webp"');
    expect(source).toContain('leaderboard: "/assets/page-leaderboard-podium.webp"');
    expect(source).not.toContain('speed: "/assets/generated/strokes-gained-hole-tracers.png"');
    expect(source).not.toContain('groups: "/assets/profile-trophy-shelf.webp"');
    expect(source).not.toContain('settings: "/assets/provider-rapsodo-device.webp"');
  });
});
