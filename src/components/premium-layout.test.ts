import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("PageShell layout contract", () => {
  it("keeps app content shells full width", () => {
    const source = readFileSync(join(process.cwd(), "src/components/premium.tsx"), "utf8");
    const shellWidthsBlock = source.match(/const shellWidths = \{[\s\S]*?\};/)?.[0] ?? "";

    expect(shellWidthsBlock).toContain('"6xl": "max-w-none"');
    expect(shellWidthsBlock).toContain('"7xl": "max-w-none"');
    expect(shellWidthsBlock).toContain('wide: "max-w-none"');
    expect(shellWidthsBlock).toContain('full: "max-w-none"');
    expect(source).toContain('"!max-w-none"');
  });
});
