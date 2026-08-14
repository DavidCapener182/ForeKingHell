import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/shots/interactive-shot-shape-map.tsx"),
  "utf8",
);

describe("interactive desktop shot map", () => {
  it("selects a marker locally and replaces the latest mapped-shots table with its detail", () => {
    expect(source).toContain('const [selectedId, setSelectedId] = useState("")');
    expect(source).toContain("data-shot-map-point={shot.id}");
    expect(source).toContain("onClick={() => setSelectedId(shot.id)}");
    expect(source).toContain("aria-pressed={selected}");
    expect(source).toContain("{selectedShot ? (");
    expect(source).toContain("<SelectedShotDetail shot={selectedShot} compact />");
    expect(source).toContain("<LatestMappedShotsTable");
    expect(source).toContain('setSelectedId("")');
    expect(source).toContain("SHOT_MAP_MAX_CARRY_YD");
    expect(source).toContain("SHOT_MAP_MAX_SIDE_YD");
    expect(source).toContain("<ShotMapDistanceGuides />");
    expect(source).toContain("const [selectedClub, setSelectedClub] = useState(initialClub);");
    expect(source).toContain("shots.filter((shot) => shot.clubType === selectedClub)");
    expect(source).toContain('aria-label="Filter top-down map by club"');
    expect(source).toContain('from "@/components/ui/toggle-group"');
    expect(source).toContain('<ToggleGroup\n          type="single"');
    expect(source).toContain("<ToggleGroupItem key={clubType} value={clubType}>");
    expect(source).toContain('clubType === "driver" ? "D" : formatClubType(clubType)');
    expect(source).not.toContain("ShotMapClubFilterButton");
    expect(source).not.toContain("border-emerald-950 bg-emerald-950 text-white");
    expect(source).toContain("border-border bg-muted/35");
  });
});
