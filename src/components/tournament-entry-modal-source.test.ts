import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/tournament-entry-modal.tsx"),
  "utf8",
);

describe("TournamentEntryModal mobile sheet", () => {
  it("uses the accessible drawer lifecycle instead of a hand-rolled fixed dialog", () => {
    expect(source).toContain("<Drawer");
    expect(source).toContain("open={open}");
    expect(source).toContain("if (!pending) setOpen(value)");
    expect(source).toContain("<DrawerTrigger asChild>");
    expect(source).toContain("<DrawerContent");
    expect(source).toContain("<DrawerTitle");
    expect(source).toContain("<DrawerDescription");
    expect(source).toContain("<DrawerClose asChild>");
    expect(source).not.toContain('role="dialog"');
    expect(source).not.toContain("max-h-[92vh]");
  });

  it("keeps actions reachable above the installed-app safe area", () => {
    expect(source).toContain("env(safe-area-inset-bottom)");
    expect(source).toContain("min-h-0 overflow-y-auto overscroll-contain");
    expect(source).toContain("<DrawerFooter");
    expect(source).toContain("min-h-11");
  });
});
