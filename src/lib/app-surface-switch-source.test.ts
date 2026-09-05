import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("application surface switches", () => {
  it("uses document navigation so the server immediately remounts the selected shell", () => {
    const sources = [
      source("src/components/app/app-surface-link.tsx"),
      source("src/components/app/mobile-nav.tsx"),
      source("src/components/app/workbench-app-shell.tsx"),
      source("src/app/(app)/companion/handoff/page.tsx"),
      source("src/app/(app)/companion/summary/page.tsx"),
    ];

    expect(sources[0]).toContain("return <a href={href}");
    expect(sources.join("\n")).toContain("AppSurfaceLink");
    expect(sources.join("\n")).not.toContain("reloadDocument");
    expect(sources.join("\n")).toContain('href="/surface/companion?next=%2Ftoday"');
  });
});

describe("grouped mobile surface links", () => {
  it("uses document navigation rather than prefetch for a surface-changing row", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/app/mobile-primitives.tsx"),
      "utf8",
    );
    expect(source).toContain('href?.startsWith("/surface/")');
    expect(source).toContain("<AppSurfaceLink");
    expect(source.indexOf("<AppSurfaceLink")).toBeLessThan(source.indexOf("<Link href={href}"));
  });
});
