import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/social/feed-item-controls.tsx"),
  "utf8",
);

describe("feed item control composition", () => {
  it("uses shared controls and confirms the selected operation before submitting", () => {
    const controls = source;

    expect(controls).toContain("<DropdownMenuTrigger asChild>");
    expect(controls).toContain("<DropdownMenuItem");
    expect(controls).toContain("<Button");
    expect(controls).toContain("<ResponsiveDetailPanel");
    expect(controls).toContain("description={choice?.consequence}");
    expect(controls).toContain('"Confirm action"');
    expect(controls).toContain("if (!choice || lock.current) return;");
    expect(controls).toContain('data.set("feedItemId", feedItemId)');
    expect(controls).toContain('data.set("operation", choice.operation)');
    expect(controls).toContain("await feedInteractionFormAction");
    expect(controls).toContain('role="alert"');
    expect(controls).toContain("if (!open && !pending) setChoice(null)");
    expect(controls).not.toContain("<button");

    for (const operation of ["visibility", "hide", "hide-type", "mute", "report", "delete"]) {
      expect(controls).toContain(`operation: "${operation}"`);
    }
  });
});
