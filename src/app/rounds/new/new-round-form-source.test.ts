import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/rounds/new/new-round-form.tsx"), "utf8");

describe("new round scorecard entry grid", () => {
  it("keeps desktop hole entry as a keyboard-friendly row grid", () => {
    expect(source).toContain('id="scorecard-entry-grid"');
    expect(source).toContain("data-scorecard-entry-grid");
    expect(source).toContain('aria-label="Keyboard-friendly scorecard hole entry grid"');
    expect(source).toContain("<fieldset");
    expect(source).toContain("<legend");
    expect(source).toContain(
      "sm:grid-cols-[minmax(9rem,1.4fr)_repeat(5,minmax(4.25rem,0.7fr))_repeat(2,minmax(5rem,0.75fr))]",
    );
  });

  it("keeps numeric fields keyboard and mobile keypad friendly", () => {
    expect(source).toContain('type="number"');
    expect(source).toContain('inputMode="numeric"');
    expect(source).toContain('autoComplete="off"');

    for (const field of [
      "score",
      "putts",
      "penalties",
      "chipShots",
      "greensideSandShots",
      "fairwayHit",
      "gir",
    ]) {
      expect(source).toContain(field);
    }
  });
});
