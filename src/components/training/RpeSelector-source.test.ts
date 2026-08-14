import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/training/RpeSelector.tsx"), "utf8");

describe("RpeSelector desktop layout", () => {
  it("does not squeeze ten RPE labels into laptop-width grids", () => {
    expect(source).toContain('"grid-cols-5 2xl:grid-cols-10"');
    expect(source).toContain('"grid-cols-2 sm:grid-cols-5 min-[1700px]:grid-cols-10"');
    expect(source).not.toContain('"grid-cols-2 sm:grid-cols-5 xl:grid-cols-10"');
  });

  it("uses one semantic shadcn selector while preserving form submission", () => {
    expect(source).toContain('from "@/components/ui/toggle-group"');
    expect(source).toContain('<ToggleGroup\n        type="single"');
    expect(source).toContain("<ToggleGroupItem");
    expect(source).toContain('<input type="hidden" name={name} value={value} />');
    expect(source).toContain("data-[state=on]:border-primary");
    expect(source).not.toContain('type="radio"');
    expect(source).not.toContain("emerald-");
  });
});
