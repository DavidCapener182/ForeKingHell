import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/quick-bag/quick-bag-client.tsx"), "utf8");
const drawer = readFileSync(
  join(process.cwd(), "src/app/quick-bag/quick-bag-club-drawer.tsx"),
  "utf8",
);

describe("Quick Bag companion composition", () => {
  it("keeps one genuine command-style picker for clubs and target distances", () => {
    expect(source).toContain("const EntityCombobox = dynamic(");
    expect(source).toContain('import("@/components/app/entity-combobox")');
    expect(source).toContain("module.EntityCombobox");
    expect(source).toContain("ssr: false");
    expect(source).toContain('aria-label="Loading club or target"');
    expect(source).not.toContain('from "@/components/app/entity-combobox"');
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

  it("defers the club-detail Drawer until the golfer asks for detail", () => {
    expect(source).toContain('import dynamic from "next/dynamic"');
    expect(source).toContain('import("@/app/quick-bag/quick-bag-club-drawer")');
    expect(source).toContain("{detailOpen ? (");
    expect(source).not.toContain('from "@/components/ui/drawer"');
    expect(drawer).toContain("<Drawer open={open}");
    expect(drawer).toContain("<LateralRange club={club} />");
    expect(drawer).toContain("env(safe-area-inset-bottom)");
  });
});
