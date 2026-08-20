import { describe, expect, it } from "vitest";

import { resolveVisibleColumnIds } from "@/components/app/desktop-workbench-columns";

const columns = [
  { id: "club", label: "Club", locked: true },
  { id: "carry", label: "Carry" },
  { id: "date", label: "Date" },
  { id: "advanced", label: "Actions", locked: true },
];

describe("resolveVisibleColumnIds", () => {
  it("restores locked columns omitted by an older persisted layout", () => {
    expect(resolveVisibleColumnIds(columns, ["club", "carry", "date"])).toEqual([
      "club",
      "carry",
      "date",
      "advanced",
    ]);
  });

  it("falls back to every column when persisted IDs are empty or invalid", () => {
    expect(resolveVisibleColumnIds(columns, [])).toEqual(["club", "carry", "date", "advanced"]);
    expect(resolveVisibleColumnIds(columns, ["removed-column"])).toEqual([
      "club",
      "carry",
      "date",
      "advanced",
    ]);
  });
});
