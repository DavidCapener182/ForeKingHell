import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/bag/[clubId]/page.tsx"), "utf8");

describe("club profile page source", () => {
  it("wraps the club profile in the desktop workbench shell without adding a rail slab", () => {
    expect(source).toContain(
      'import { DesktopWorkbenchLayout } from "@/components/app/desktop-workbench";',
    );
    expect(source).toContain('<DesktopWorkbenchLayout scope="club-profile">');
    expect(source).toContain("</DesktopWorkbenchLayout>");
    expect(source).toContain("<ClubDetailClient");
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("rail={");
    expect(source).not.toContain('<PageShell size="');
  });
});
