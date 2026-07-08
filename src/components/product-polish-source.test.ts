import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/product-polish.tsx"), "utf8");

describe("product polish desktop flow panels", () => {
  it("keeps workflow and proof cards readable before large-monitor layouts", () => {
    expect(source).toContain("sm:grid-cols-2 min-[1800px]:grid-cols-3 min-[2400px]:grid-cols-5");
    expect(source).not.toContain("md:grid-cols-5");
    expect(source).not.toContain("sm:grid-cols-2 xl:grid-cols-5");
    expect(source).not.toContain("sm:grid-cols-2 xl:grid-cols-3");
  });
});
