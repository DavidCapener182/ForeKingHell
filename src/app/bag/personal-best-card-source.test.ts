import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/bag/personal-best-card.tsx"), "utf8");

describe("personal best card imported helper", () => {
  it("uses semantic theme tokens and the shadcn toggle primitive", () => {
    const fixedPalette =
      /(?:bg|text|border|ring)-(?:white|black|slate|emerald|green|amber|orange|yellow|red|rose|pink|sky|blue|indigo|violet|purple|cyan|teal)(?:-|\b)|(?:bg|text|border|ring)-\[#|rgba\(|#[0-9a-f]{3,8}/i;

    expect(source).not.toMatch(fixedPalette);
    expect(source).toContain("<Card");
    expect(source).toContain("<ToggleGroup");
    expect(source).toContain("<ToggleGroupItem");
    expect(source).toContain('aria-label="Personal best metric"');
    expect(source).toContain("bg-card");
    expect(source).toContain("bg-primary");
    expect(source).not.toContain("<button");
  });
});
