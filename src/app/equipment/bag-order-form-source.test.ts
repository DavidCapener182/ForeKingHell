import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/equipment/bag-order-form.tsx"), "utf8");

describe("bag order form desktop layout", () => {
  it("keeps visual bag slot columns readable before large monitors", () => {
    expect(source).toContain("md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5");
    expect(source).not.toContain("md:grid-cols-2 xl:grid-cols-5");
  });
});
