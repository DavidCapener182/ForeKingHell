import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/shots/page.tsx"), "utf8");
const masterDetailSource = readFileSync(
  join(process.cwd(), "src/app/shots/shots-master-detail-table.tsx"),
  "utf8",
);
const interactiveMapSource = readFileSync(
  join(process.cwd(), "src/app/shots/interactive-shot-shape-map.tsx"),
  "utf8",
);

describe("shots desktop workbench page", () => {
  it("keeps the shot explorer table-first until the shared wide-monitor rail appears", () => {
    const layoutBlock =
      source.match(/<DesktopWorkbenchLayout[\s\S]*?<\/DesktopWorkbenchLayout>/)?.[0] ?? "";

    expect(layoutBlock).toContain('scope="shots"');
    expect(layoutBlock).not.toContain("railBreakpoint=");
    expect(layoutBlock).toContain('title="AI shot analyst"');
    expect(layoutBlock).toContain("DesktopTableWorkbenchControls");
    expect(layoutBlock).toContain('viewKey="shots"');
    expect(layoutBlock).toContain('exportTableId="shots"');
    expect(layoutBlock).toContain("ShotsMasterDetailTable");
    expect(masterDetailSource).toContain('data-workbench-scope="shots"');
    expect(masterDetailSource).toContain('data-workbench-export-table="shots"');
  });

  it("keeps the session import and shape evidence tables desktop-ready", () => {
    expect(source).toContain("shotSessionImportColumns");
    expect(source).toContain("shotSessionSuggestedViews");
    expect(source).toContain('viewKey="shots-session-imports"');
    expect(source).toContain('data-workbench-scope="shots-session-imports"');
    expect(source).toContain('data-workbench-export-table="shots-session-imports"');
    expect(source).toContain('exportFileName="forekinghell-shot-session-imports.csv"');
    expect(source).toContain('label="Session imports table"');
    expect(source).toContain("stickyFirstColumn");
    expect(source).toContain('id="shots-session-imports-summary"');
    expect(source).toContain('aria-describedby="shots-session-imports-summary"');
    expect(interactiveMapSource).toContain(
      'label="Latest inferred shot shape rows" stickyFirstColumn',
    );
    expect(interactiveMapSource).toContain('data-workbench-scope="shots-shape-evidence"');
    expect(interactiveMapSource).toContain('id="shots-shape-evidence-summary"');
    expect(interactiveMapSource).toContain('aria-describedby="shots-shape-evidence-summary"');
    expect(interactiveMapSource).toContain("tabIndex={0}");
    expect(interactiveMapSource).toContain("focus-aaa outline-none");

    for (const column of ["file", "date", "type", "shots"]) {
      expect(source).toContain(`data-column="${column}"`);
    }

    for (const column of ["shot", "side", "shape"]) {
      expect(interactiveMapSource).toContain(`data-column="${column}"`);
    }
  });

  it("uses a session-import file as the current shot and map scope", () => {
    expect(source).toContain("function sessionImportHref(");
    expect(source).toContain('fragment = "dispersion-desktop"');
    expect(source).toContain("})}#${fragment}");
    expect(source).toContain('club: ""');
    expect(source).toContain('category: ""');
    expect(source).toContain('q: ""');
    expect(source).toContain('sort: "recent"');
    expect(source).toContain("const href = sessionImportHref(filters, session.id);");
    expect(source).toContain("href={href}");
    expect(source).toContain('href={sessionImportHref(filters, session.id, "dispersion")}');
    expect(source).toContain('data-selected-session={selected ? "true" : undefined}');
  });

  it("loads every club into the map so its local controls can switch instantly", () => {
    expect(source).toContain('const mapWhere = buildShotWhere({ ...filters, club: "" }, userId);');
    expect(source).toContain(".where(mapWhere)");
    expect(source).toContain("initialClub={filters.club}");
  });

  it("keeps map markers selectable with the same selected-shot detail and deletion control", () => {
    expect(source).toContain("parseSelectedShotId");
    expect(source).toContain("selectedShotHref");
    expect(source).toContain("clearSelectedShotHref");
    expect(source).toContain("selectedMapShotDetail");
    expect(source).toContain("InteractiveDesktopShotMapContent");
    expect(source).toContain("aria-label={`Show ${formatClubType(shot.clubType)} shot");
    expect(source).toContain("{selectedShot ? (");
    expect(source).toContain("<SelectedShotDetail shot={selectedShot} />");
    expect(masterDetailSource).toContain("ShotDeleteButton");
    expect(interactiveMapSource).toContain("data-shot-map-point={shot.id}");
  });
});
