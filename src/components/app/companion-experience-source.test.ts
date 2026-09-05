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

  it("uses a launch-angle-driven golf tracer instead of a circular loading arc", () => {
    const brand = read("src/components/app/companion-brand.tsx");
    const styles = read("src/app/globals.css");

    expect(brand).toContain('data-launch-angle-deg="14"');
    expect(brand).toContain("M 46 184 C 128 164 190 104 270 82");
    expect(brand).toContain('className="companion-launch-trace-rail"');
    expect(brand).not.toContain("M42 180 C 110 20, 240 20, 318 176");
    expect(brand).not.toContain('fill="#ef4444"');
    expect(styles).toContain("animation: companion-launch-reveal 1.8s linear infinite");
    expect(styles).toContain(".companion-launch-trace-flight");
    expect(styles).not.toContain("stroke-dashoffset: 620");
  });

  it("prefetches companion tabs and shared mobile links", () => {
    const shell = read("src/components/app/companion-app-shell.tsx");
    expect(shell).toContain("router.prefetch(href)");
    expect(shell).toContain('"/today", "/practice", "/play", "/progress", "/bag"');
    expect(read("src/components/app/mobile-primitives.tsx")).toContain(
      "<Link href={href} prefetch aria-label={ariaLabel}",
    );
    expect(read("src/components/mobile-tab-bar.tsx")).toContain("prefetch");
  });

  it("keeps the primary recommendation focused on the action and evidence", () => {
    expect(read("src/components/app/today-primary-answer.tsx")).toContain("styles.focus");
    expect(read("src/app/practice/practice-companion-client.tsx")).toContain(
      "data-current-practice-plan",
    );
  });
});
