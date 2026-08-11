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
