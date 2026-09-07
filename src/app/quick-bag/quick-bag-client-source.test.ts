import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/quick-bag/quick-bag-client.tsx"), "utf8");
const drawer = readFileSync(
  join(process.cwd(), "src/app/quick-bag/quick-bag-club-drawer.tsx"),
  "utf8",
);
const page = readFileSync(join(process.cwd(), "src/app/(app)/quick-bag/page.tsx"), "utf8");

describe("Quick Bag companion composition", () => {
  it("puts a large target input and one-tap distances first", () => {
    expect(source).toContain('aria-label="Target distance"');
    expect(source).toContain('inputMode="decimal"');
    expect(source).toContain("const quickTargets = [100, 125, 150, 175, 200]");
    expect(source).toContain("<BestMatchCard");
    expect(source).not.toContain("EntityCombobox");
  });

  it("keeps one dominant answer with compact alternatives", () => {
    expect(source).toContain("data-quick-bag-best-match");
    expect(source).toContain("Nearest measured option for");
    expect(source).toContain("Play number");
    expect(source).toContain("Trusted carry");
    expect(source).toContain("Measured range");
    expect(source).toContain("Typical miss");
    expect(source).toContain("Alternatives");
    expect(source).toContain("rankedClubs.slice(1, 4)");
  });

  it("keeps the recommended club legible in the Clubhouse desktop theme", () => {
    expect(source).toContain(
      'style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}',
    );
  });

  it("uses a separate club-search mode", () => {
    expect(source).toContain('{ value: "club", label: "Search club" }');
    expect(source).toContain("MobileSegmentedControl");
    expect(source).toContain("Search club");
    expect(source).toContain('aria-label="Search by club"');
    expect(source).toContain("<SearchClubRow");
  });

  it("defers the club-detail Drawer until the golfer asks for detail", () => {
    expect(source).toContain('import dynamic from "next/dynamic"');
    expect(source).toContain('import("@/app/quick-bag/quick-bag-club-drawer")');
    expect(source).toContain("{detailOpen ? (");
    expect(source).not.toContain('from "@/components/ui/drawer"');
    expect(drawer).toContain("<Drawer open={open}");
    expect(drawer).toContain("<LateralDispersionGraphic club={club} />");
    expect(drawer).toContain("Latest evidence");
    expect(drawer).toContain("env(safe-area-inset-bottom)");
  });
});

describe("Quick Bag responsive route", () => {
  it("shares one authenticated data set and leaves cache writing to the saved reference", () => {
    expect(page).toContain("<PageShell>");
    expect(page).toContain("<PageHeader");
    expect(page.match(/<QuickBagClient/g)).toHaveLength(1);
    expect(page.match(/<MobileQuickBag/g)).toHaveLength(1);
    expect(page).toContain("getMobileQuickBag()");
    expect(page).toContain("requireCurrentUserId()");
    expect(page.match(/accountId={userId}/g)).toHaveLength(2);
    expect(page).toContain("Saved bag reference · carry and total");
    expect(source).not.toContain("localStorage.setItem");
    const reference = readFileSync(
      join(process.cwd(), "src/app/quick-bag/mobile-quick-bag.tsx"),
      "utf8",
    );
    expect(reference).toContain("JSON.stringify({ version: 4, accountId,");
    expect(reference).toContain("localStorage.setItem");
  });
});
