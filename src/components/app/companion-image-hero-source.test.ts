import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const heroSource = readFileSync(join(root, "src/components/app/companion-image-hero.tsx"), "utf8");
const companionShellSource = readFileSync(
  join(root, "src/components/app/companion-app-shell.tsx"),
  "utf8",
);
const mobileNavSource = readFileSync(join(root, "src/components/app/mobile-nav.tsx"), "utf8");
const routeMetadataSource = readFileSync(
  join(root, "src/components/app/route-metadata.ts"),
  "utf8",
);
const mobileAppleSource = readFileSync(join(root, "src/app/mobile-apple.css"), "utf8");
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
    expect(heroSource).toContain("data-companion-hero-glass");
    expect(heroSource).toContain("title: string");
    expect(heroSource).toContain("<h1");
    expect(heroSource).toContain("h-64");
    expect(heroSource).toContain("min-[376px]:h-72");
    expect(heroSource).toContain("min-[430px]:h-80");
    expect(heroSource).toContain("rounded-b-[2.25rem]");
    expect(heroSource).toContain("brightness-[0.62]");
    expect(heroSource).toContain("priority");
    expect(heroSource).toContain('sizes="calc(100vw - 2rem)"');

    for (const title of ["Today", "Practice", "Play", "Sessions"]) {
      expect(pageSources.some((source) => source.includes(`title="${title}"`))).toBe(true);
    }
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

  it("turns primary companion heroes into full-width top chrome that collapses on scroll", () => {
    expect(routeMetadataSource).toContain('new Set(["/today", "/practice", "/play", "/sessions"])');
    expect(companionShellSource).toContain("isMobileCompanionHeroRoute(pathname)");
    expect(companionShellSource).toContain('data-companion-hero-shell={heroRoute ? "true"');
    expect(companionShellSource).toContain('immersive || heroRoute ? "pt-0"');
    expect(mobileNavSource).toContain("heroHeight - 52");
    expect(mobileNavSource).toContain("data-companion-hero-header");
    expect(mobileNavSource).toContain("data-hero-collapsed");
    expect(mobileAppleSource).toContain('[data-companion-hero-header="true"]');
    expect(mobileAppleSource).toContain("background: transparent !important");
  });
});
