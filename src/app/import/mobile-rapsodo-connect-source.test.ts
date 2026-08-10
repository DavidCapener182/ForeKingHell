import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/import/mobile-rapsodo-connect.tsx"),
  "utf8",
);

describe("mobile Rapsodo connection source", () => {
  it("uses a focused sheet with labelled credentials and honest token copy", () => {
    expect(source).toContain("BottomSheet");
    expect(source).toContain("IOSGroupedList");
    expect(source).toContain("IOSListRow");
    expect(source).toContain('type="email"');
    expect(source).toContain('autoComplete="email"');
    expect(source).toContain('type="password"');
    expect(source).toContain('autoComplete="current-password"');
    expect(source).toContain("short-lived encrypted token");
  });
});
