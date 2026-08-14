import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/social/feed-item-controls.tsx"),
  "utf8",
);

describe("feed item control composition", () => {
  it("uses shared Buttons for every visible form control", () => {
    const controls =
      source.match(/export function FeedItemControls[\s\S]*?function titleCase/)?.[0] ?? "";

    expect(controls).toContain("<DropdownMenuTrigger asChild>");
    expect(controls).toContain("<DropdownMenuItem key={option} asChild>");
    expect(controls).toContain("<Button");
    expect(controls).toContain('type="submit"');
    expect(controls).toContain("<ConfirmSubmitButton");
    expect(controls).not.toContain("<button");

    for (const action of [
      "updateFeedItemVisibilityAction",
      "hideFeedItemAction",
      "hideFeedItemTypeAction",
      "muteFeedItemUserAction",
      "reportFeedItemAction",
      "deleteFeedItemAction",
    ]) {
      expect(controls).toContain(action);
    }
  });
});
