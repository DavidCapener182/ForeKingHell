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
});
