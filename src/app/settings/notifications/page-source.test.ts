import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/settings/notifications/page.tsx"),
  "utf8",
);

describe("notification settings mobile composition", () => {
  it("uses grouped delivery rows, native switches and a bottom-safe save action", () => {
    expect(source).toContain("ios-grouped-list");
    expect(source).toContain("ios-grouped-row");
    expect(source).toContain("<Switch");
    expect(source).toContain("env(safe-area-inset-bottom)");
    expect(source).toContain("IOSDisclosureGroup");
  });

  it("keeps delivery selectors and compatibility switches uniquely labelled", () => {
    expect(source).toContain("htmlFor={`delivery-${option.key}`}");
    expect(source).toContain("id={`delivery-${option.key}`}");
    expect(source).toContain("htmlFor={`legacy-${option.key}`}");
    expect(source).toContain("id={`legacy-${option.key}`}");
    expect(source).not.toContain("htmlFor={option.key}");
  });

  it("uses a semantic shadcn Alert for save feedback", () => {
    expect(source).toContain('<Alert role="status">');
    expect(source).toContain("<AlertDescription>Notification preferences saved.");
    expect(source).not.toContain("bg-emerald-");
  });
});
