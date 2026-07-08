import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/import/shot-preview.tsx"), "utf8");

describe("import shot preview source", () => {
  it("keeps the transient import preview table keyboard and screen-reader accessible", () => {
    expect(source).toContain("TableCaption");
    expect(source).toContain('label="Import shot preview table"');
    expect(source).toContain('aria-describedby="import-shot-preview-summary"');
    expect(source).toContain('id="import-shot-preview-summary"');
    expect(source).toContain("Parsed shot preview before import");
    expect(source).toContain("sticky left-0 z-20");
    expect(source).toContain("tabIndex={0}");
    expect(source).toContain("focus-aaa outline-none");

    for (const column of [
      "file",
      "shot",
      "hole",
      "club",
      "brand",
      "carry",
      "total",
      "ball-speed",
      "launch",
      "side",
      "remain",
    ]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });
});
