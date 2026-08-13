import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/quick-bag/quick-bag-client.tsx"), "utf8");

describe("Quick Bag companion composition", () => {
  it("uses one command-style picker for clubs and target distances", () => {
    expect(source).toContain("EntityCombobox");
    expect(source).toContain('label="Club or target"');
    expect(source).toContain("customValueLabel");
    expect(source).toContain("Use ${value} yards");
  });

  it("keeps one dominant result and a Carry or Play number toggle", () => {
    expect(source).toContain("data-quick-bag-best-match");
    expect(source).toContain("<ToggleGroup");
    expect(source).toContain('value="carry"');
    expect(source).toContain('value="finish"');
    expect(source).toContain("Alternatives");
  });
});
