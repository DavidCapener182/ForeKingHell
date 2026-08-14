import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const heroSource = readFileSync(join(root, "src/components/app/companion-image-hero.tsx"), "utf8");
const routeMetadataSource = readFileSync(
  join(root, "src/components/app/route-metadata.ts"),
  "utf8",
);
const pageSources = [
  "src/app/(app)/today/today-companion-page.tsx",
  "src/app/(app)/practice/practice-companion-page.tsx",
  "src/app/(app)/play/page.tsx",
  "src/app/(app)/sessions/sessions-companion-page.tsx",
].map((file) => readFileSync(join(root, file), "utf8"));

describe("companion visual hierarchy", () => {
  it("keeps primary answers ahead of decorative imagery", () => {
    for (const source of pageSources) {
      expect(source).not.toContain("<CompanionImageHero");
    }
    expect(routeMetadataSource).toContain("new Set<string>()");
    expect(heroSource).toContain("h-32");
    expect(heroSource).not.toContain("priority");
    expect(heroSource).not.toContain("unoptimized");
    expect(heroSource).toContain('sizes="100vw"');
  });

  it("keeps retained companion assets lightweight", () => {
    for (const file of [
      "public/assets/companion/today-hero.avif",
      "public/assets/companion/practice-hero.avif",
      "public/assets/companion/sessions-hero.avif",
    ]) {
      expect(statSync(join(root, file)).size).toBeLessThan(300_000);
    }
  });

  it("keeps the Play image restrained inside the selected-course card", () => {
    const playSource = pageSources[2] ?? "";
    expect(playSource).toContain("Selected course");
    expect(playSource).toContain("relative h-48 overflow-hidden");
    expect(playSource).toContain("data-primary-action");
    expect(playSource).not.toContain("unoptimized");
  });
});
