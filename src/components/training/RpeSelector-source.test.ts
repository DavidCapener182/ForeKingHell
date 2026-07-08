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
});
