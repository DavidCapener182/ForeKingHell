import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/tournament-entry-modal.tsx"),
  "utf8",
);

describe("TournamentEntryModal mobile sheet", () => {
  it("uses the accessible drawer lifecycle instead of a hand-rolled fixed dialog", () => {
    expect(source).toContain("<Drawer open={open} onOpenChange={setOpen}>");
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
    expect(source).toContain("sticky bottom-0");
    expect(source).toContain("min-h-11");
  });
});
