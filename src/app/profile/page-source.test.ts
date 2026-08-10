import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/profile/page.tsx"), "utf8");

describe("profile mobile real-data contract", () => {
  it("does not invent a session count or draw fixed progress artwork", () => {
    expect(source).not.toContain("trackedCleanShots / 120");
    expect(source).not.toContain("#0B7A3B_0_18%");
    expect(source).toContain('title="Clean shots"');
    expect(source).toContain("cleanShotPercentage");
    expect(source).toContain('aria-label="Clean shot coverage"');
  });

  it("keeps the selected profile view ahead of supporting sharing and health detail", () => {
    const selectedView = source.indexOf('activeTab === "records"');
    const controls = source.indexOf('title="Profile controls"');

    expect(selectedView).toBeGreaterThan(0);
    expect(controls).toBeGreaterThan(selectedView);
    expect(source).toContain('value: "sharing"');
    expect(source).toContain('value: "data-health"');
    expect(source).toContain("IOSDisclosureGroup");
  });
});
