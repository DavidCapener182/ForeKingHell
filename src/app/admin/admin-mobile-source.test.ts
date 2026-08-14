import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/admin/admin-components.tsx"), "utf8");
const bulkActionSource = readFileSync(
  join(process.cwd(), "src/app/admin/admin-bulk-action-submit.tsx"),
  "utf8",
);

describe("shared admin desktop composition", () => {
  it("keeps the desktop-only admin graph free of the obsolete companion shell", () => {
    expect(source).not.toContain("AdminMobileShell");
    expect(source).not.toContain("MobileAppShell");
    expect(source).not.toContain("MobileTopBar");
    expect(source).not.toContain("MobileTabBar");
    expect(source).not.toContain("AdminMobileNotice");
    expect(source).not.toContain("IOSGroupedList");
    expect(source).not.toContain("IOSInlineStatus");
    expect(source).toContain("AdminNav");
    expect(source).toContain("AdminNotice");
    expect(source).toContain('className="hidden lg:block"');
  });

  it("uses semantic tokens for shared admin metrics", () => {
    expect(source).toContain('className="size-4 text-primary"');
    expect(source).not.toContain("text-emerald-");
    expect(bulkActionSource).toContain("var(--status-warning-foreground)");
    expect(bulkActionSource).not.toContain("text-amber-");
  });
});
