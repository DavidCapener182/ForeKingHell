import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const heroSource = readFileSync(join(root, "src/components/app/companion-image-hero.tsx"), "utf8");
const pageSources = [
  "src/app/(app)/today/today-companion-page.tsx",
  "src/app/(app)/practice/practice-companion-page.tsx",
  "src/app/(app)/play/page.tsx",
  "src/app/(app)/sessions/sessions-companion-page.tsx",
].map((file) => readFileSync(join(root, file), "utf8"));

describe("companion image heroes", () => {
  it("gives each primary companion journey a contextual golf hero", () => {
    for (const variant of ["today", "practice", "play", "sessions"]) {
      expect(heroSource).toContain(`${variant}: {`);
      expect(pageSources.some((source) => source.includes(`variant="${variant}"`))).toBe(true);
    }

    expect(heroSource).toContain("data-companion-image-hero");
    expect(heroSource).toContain("priority");
    expect(heroSource).toContain('sizes="calc(100vw - 2rem)"');
  });

  it("keeps the photographic companion assets lightweight", () => {
    for (const file of [
      "public/assets/companion/today-hero.avif",
      "public/assets/companion/practice-hero.avif",
      "public/assets/companion/sessions-hero.avif",
    ]) {
      expect(statSync(join(root, file)).size).toBeLessThan(300_000);
    }
  });
});
