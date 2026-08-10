import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/admin/admin-components.tsx"), "utf8");

describe("shared admin mobile composition", () => {
  it("provides a native mobile shell, centred route navigation and mobile notices", () => {
    expect(source).toContain("AdminMobileShell");
    expect(source).toContain("MobileAppShell");
    expect(source).toContain("MobileTopBar");
    expect(source).toContain("MobileTabBar");
    expect(source).toContain("AdminMobileNotice");
    expect(source).toContain("IOSGroupedList");
    expect(source).toContain("IOSInlineStatus");
    expect(source).toContain('className="hidden lg:block"');
  });
});
