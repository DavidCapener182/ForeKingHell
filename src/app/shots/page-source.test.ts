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
const patternExplorerSource = readFileSync(
  join(process.cwd(), "src/app/shots/shot-pattern-explorer.tsx"),
  "utf8",
);
const filterToolbarSource = readFileSync(
  join(process.cwd(), "src/app/shots/shot-filter-toolbar.tsx"),
  "utf8",
);

describe("shots desktop workbench page", () => {
  it("uses one desktop shadcn data toolbar with responsive advanced filters", () => {
    expect(source).toContain("<ShotFilterToolbar");
    expect(filterToolbarSource).toContain("<DataToolbar");
    expect(filterToolbarSource).toContain("<ResponsiveFilterPanel");
    expect(filterToolbarSource).toContain("activeFilters={activeFilters}");
    expect(filterToolbarSource).toContain('aria-label="Group shots by"');
    expect(filterToolbarSource).toContain('<SelectItem value="club">Group by club</SelectItem>');
    expect(filterToolbarSource).toContain(
      '<SelectItem value="session">Group by session</SelectItem>',
    );
    expect(source).toContain("groupBy={filters.group}");
    expect(masterDetailSource).toContain("data-shot-group={groupBy}");
    expect(masterDetailSource).toContain("shotGroupLabel(shot, groupBy)");
  });

  it("uses semantic skeletons while the dynamic pattern explorer loads", () => {
    const dynamicFallback =
      source.match(/const ShotPatternExplorer = dynamicImport[\s\S]*?type SearchParams/)?.[0] ?? "";
    expect(dynamicFallback).toContain("<Skeleton");
    expect(dynamicFallback).toContain('aria-label="Shot-pattern explorer loading"');
    expect(dynamicFallback).not.toContain(">Loading shot-pattern explorer…</div>");
  });

  it("keeps the desktop workbench free of the duplicate mobile architecture", () => {
    const desktopStart = source.indexOf("data-shots-desktop-workbench");
    const desktopEnd = source.indexOf("type DispersionShot");
    const desktopBlock = source.slice(desktopStart, desktopEnd);

    expect(desktopBlock).toContain("<ShotFilterToolbar");
    expect(desktopBlock).toContain("<ShotsMasterDetailTable");
    expect(desktopBlock).toContain("<Table");
    for (const mobilePrimitive of [
      "MobileCompactPageHeader",
      "MobileMetricStrip",
      "MobileSectionChips",
      "MobileFilterSheet",
      "ActiveFilterChips",
      "MobileAccordionSection",
      "MobileDataList",
      "MobileDataCard",
      "StickyMobileAction",
      "DataTableFrame",
    ]) {
      expect(desktopBlock).not.toContain(mobilePrimitive);
    }
  });

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
    expect(source).toContain('aria-label="Session imports table"');
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
    expect(source).toContain('data-selected-session={selected ? "true" : undefined}');
  });

  it("loads every club into the map so its local controls can switch instantly", () => {
    expect(source).toContain('const mapWhere = buildShotWhere({ ...filters, club: "" }, userId);');
    expect(source).toContain(".where(mapWhere)");
    expect(source).toContain("initialClub={filters.club}");
  });

  it("keeps map markers selectable with client-side detail and deletion control", () => {
    expect(source).not.toContain("parseSelectedShotId");
    expect(source).not.toContain("selectedShotHref");
    expect(source).not.toContain("selectedMapShotDetail");
    expect(source).toContain("InteractiveDesktopShotMapContent");
    expect(interactiveMapSource).toContain('const [selectedId, setSelectedId] = useState("")');
    expect(interactiveMapSource).toContain("onClick={() => setSelectedId(shot.id)}");
    expect(interactiveMapSource).toContain("aria-label={`Show ${shot.clubTypeLabel} shot");
    expect(interactiveMapSource).toContain("{selectedShot ? (");
    expect(interactiveMapSource).toContain("<SelectedShotDetail shot={selectedShot} compact />");
    expect(masterDetailSource).toContain("ShotDeleteButton");
    expect(interactiveMapSource).toContain("data-shot-map-point={shot.id}");
  });

  it("keeps selected-shot Sheet content flat and uses semantic shadcn evidence surfaces", () => {
    const responsiveDetail =
      masterDetailSource.match(/<ResponsiveDetailPanel[\s\S]*?<\/ResponsiveDetailPanel>/)?.[0] ??
      "";
    const selectedDetail =
      masterDetailSource.match(
        /export function SelectedShotDetail[\s\S]*?function ShotDetailMetric/,
      )?.[0] ?? "";

    expect(responsiveDetail).toContain("<SelectedShotDetail shot={selectedShot} compact />");
    expect(selectedDetail).toContain('const Comp = compact ? "section" : Card');
    expect(selectedDetail).not.toContain("bg-emerald-800");
    expect(selectedDetail).not.toContain("bg-emerald-50");
    expect(selectedDetail).not.toContain("bg-amber-50");
    expect(selectedDetail).not.toContain("bg-rose-50");
    expect(patternExplorerSource).toContain("<Table");
    expect(patternExplorerSource).not.toContain("<table");
    expect(patternExplorerSource).toContain("data-shot-pattern-explorer");
    expect(patternExplorerSource).toContain("<Button\n              key={cluster.key}");
    expect(patternExplorerSource).toContain("<AlertTitle>No matching shot clusters</AlertTitle>");
    expect(patternExplorerSource).not.toMatch(/<button\b/);
  });

  it("keeps ordinary workbench surfaces semantic while preserving the specialist shot map", () => {
    const fixedPalette =
      /(?:bg|text|border|ring)-(?:white|black|slate|emerald|green|amber|orange|yellow|red|rose|pink|sky|blue|indigo|violet|purple|cyan|teal)(?:-|\b)|(?:bg|text|border|ring)-\[#|rgba\(|#[0-9a-f]{3,8}/i;

    for (const ordinarySource of [
      source,
      masterDetailSource,
      patternExplorerSource,
      filterToolbarSource,
    ]) {
      expect(ordinarySource).not.toMatch(fixedPalette);
    }

    expect(source).toContain("shadow-[1px_0_0_hsl(var(--border))]");
    expect(masterDetailSource).toContain('sort.active ? "text-primary"');
    expect(interactiveMapSource).toContain("bg-[#eef6ef]");
    expect(interactiveMapSource).toContain("rgba(15, 118, 110, 0.58)");
  });

  it("flattens archive stats and the selected-shot bulk toolbar inside their section Cards", () => {
    const statTile = source.match(/function StatTile[\s\S]*?function formatDate/)?.[0] ?? "";
    const bulkToolbar =
      masterDetailSource.match(
        /export function ShotBulkToolbar[\s\S]*?function shotGroupLabel/,
      )?.[0] ?? "";

    expect(statTile).toContain("<Item");
    expect(statTile).toContain("data-shot-stat");
    expect(statTile).not.toMatch(/<Card(?:\s|>)/);
    expect(bulkToolbar).toContain('role="toolbar"');
    expect(bulkToolbar).toContain("data-shot-bulk-toolbar");
    expect(bulkToolbar).not.toMatch(/<Card(?:\s|>)/);
  });
});

describe("shots desktop-only bundle boundary", () => {
  it("excludes the obsolete mobile archive and duplicate filter stack", () => {
    for (const obsoleteSymbol of [
      "ShotsMobileOverview",
      "MobileShotRows",
      "MobileShotImportAudit",
      "MobileSavedShotViews",
      "MobileShotDispersionMap",
      "MobileFilterSheet",
      "ActiveFilterChips",
      "MobileAppShell",
      "MobileRouteHeader",
      "IOSDisclosureGroup",
      "IOSGroupedList",
      "IOSInlineStatus",
      "IOSListRow",
      "IOSMetricRow",
      "IOSSectionHeader",
      "ShotFilterFields",
      "data-shots-mobile-overview",
      "shots-mobile-heading",
    ]) {
      expect(source).not.toContain(obsoleteSymbol);
    }

    expect(source).not.toContain("@/components/app/ios-mobile");
    expect(source).not.toContain("@/components/mobile-sports");
    expect(source).not.toContain('className="hidden lg:contents"');
    expect(source).toContain('className="contents" data-shots-desktop-workbench');
    expect(source).toContain("<ShotFilterToolbar");
    expect(source).toContain("<DesktopShotDispersionMap");
    expect(source).toContain("<SavedShotViewsPanel");
    expect(source).toContain("<ShotsMasterDetailTable");
  });

  it("keeps the advanced pattern table and removes its iOS duplicate rows", () => {
    expect(patternExplorerSource).toContain('aria-label="Shot clusters"');
    expect(patternExplorerSource).not.toContain("<IOSGroupedList");
    expect(patternExplorerSource).not.toContain("<IOSListRow");
    expect(patternExplorerSource).not.toContain("@/components/app/ios-mobile");
    expect(patternExplorerSource).toContain('className="mt-3 max-h-80 overflow-auto"');
    expect(patternExplorerSource).toContain('<Table className="min-w-[42rem]">');
    expect(patternExplorerSource).not.toContain("<table");
  });
});
