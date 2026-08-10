import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/share/report/[token]/page.tsx"), "utf8");

describe("shared coach report mobile source", () => {
  it("keeps privacy evidence visible and progressively discloses the frozen report", () => {
    expect(source).toContain("ios-public-auth");
    expect(source).toContain("MobileCoachReport");
    expect(source).toContain("MobileCoachReportSections");
    expect(source).toContain("IOSDisclosureGroup");
    expect(source).toContain('className="hidden lg:grid"');
    expect(source).toContain("This link grants access only to this frozen report");
  });

  it("keeps the password gate focused and mobile-keyboard friendly", () => {
    expect(source).toContain("MobileTopBar");
    expect(source).toContain('autoComplete="current-password"');
    expect(source).toContain('className="min-h-11"');
    expect(source).toContain('role="alert"');
    expect(source).toContain('className="mt-2 font-display text-3xl font-semibold lg:hidden"');
    expect(source).toContain(
      'className="mt-2 hidden font-display text-3xl font-semibold lg:block"',
    );
  });
});
