import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("companion identity and navigation feedback", () => {
  it("has a branded authenticated-app loading screen and visible route progress", () => {
    expect(read("src/app/(app)/layout.tsx")).toContain(
      "<Suspense fallback={<CompanionLaunchScreen />}>",
    );
    expect(read("src/components/app/companion-brand.tsx")).toContain("LM World Tour");
    expect(read("src/components/app/companion-brand.tsx")).toContain("Golf companion");
    expect(read("src/components/app/companion-route-progress.tsx")).toContain(
      "data-companion-route-progress",
    );
  });

  it("prefetches companion tabs and shared mobile links", () => {
    const shell = read("src/components/app/companion-app-shell.tsx");
    expect(shell).toContain("router.prefetch(href)");
    expect(shell).toContain('"/today", "/practice", "/play", "/sessions", "/import"');
    expect(read("src/components/app/ios-mobile.tsx")).toContain(
      "<Link href={href} prefetch aria-label={ariaLabel}",
    );
    expect(read("src/components/mobile-tab-bar.tsx")).toContain("prefetch");
  });

  it("keeps restrained golf imagery inside the primary answer cards", () => {
    expect(read("src/components/app/today-primary-answer.tsx")).toContain("lmwt-range-hero.png");
    expect(read("src/app/practice/practice-companion-client.tsx")).toContain("practice-hero.avif");
  });
});
