import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/share/[token]/page.tsx"), "utf8");

describe("shared round page source", () => {
  it("keeps the public scorecard table captioned and keyboardable", () => {
    expect(source).toContain("<PageShell>");
    expect(source).not.toContain('<PageShell size="6xl">');
    expect(source).toContain("TableCaption");
    expect(source).toContain('label="Shared scorecard table"');
    expect(source).toContain("stickyFirstColumn");
    expect(source).toContain('aria-describedby="shared-scorecard-summary"');
    expect(source).toContain('id="shared-scorecard-summary"');
    expect(source).toContain('data-workbench-scope="shared-scorecard"');
    expect(source).toContain("Shared round scorecard");
    expect(source).toContain("sticky left-0 z-20");
    expect(source).toContain("tabIndex={0}");
    expect(source).toContain("focus-aaa outline-none");

    for (const column of ["hole", "par", "yards", "score", "putts", "penalties", "fir", "gir"]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });
});
