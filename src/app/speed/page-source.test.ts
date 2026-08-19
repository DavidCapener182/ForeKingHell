import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/speed/page.tsx"), "utf8");
const clubFocusSource = readFileSync(
  join(process.cwd(), "src/app/speed/club-speed-focus.tsx"),
  "utf8",
);
const futureBagSource = readFileSync(
  join(process.cwd(), "src/app/speed/future-bag-slider.tsx"),
  "utf8",
);
const dataSource = readFileSync(join(process.cwd(), "src/lib/speed-training-data.ts"), "utf8");

describe("speed centre desktop evidence ledger", () => {
  it("keeps the wider distance-loss diagnosis out of the speed workbench", () => {
    expect(source).not.toContain("DistanceLossDiagnosisPanel");
    expect(source).not.toContain("What is driving the distance loss?");
  });

  it("uses the speed artwork variant in the desktop header", () => {
    expect(source).toContain('variant="speed"');
    expect(source).toContain("visual={<PageArtwork");
    expect(source).toContain("min-h-36");
  });

  it("expands the existing centre with the shared Driver development programme first", () => {
    expect(source).toContain(
      'import { DriverSpeedDevelopment } from "@/components/speed/driver-speed-development"',
    );
    expect(source).toContain('title="Driver Speed Development"');
    expect(source).toContain("<DriverSpeedDevelopment data={data.development} />");
    expect(source.indexOf("<DriverSpeedDevelopment data={data.development} />")).toBeLessThan(
      source.indexOf("<CompactReadoutGrid", source.indexOf("export default")),
    );
  });

  it("keeps speed coaching on clean measured fields and preserves ordered swing evidence", () => {
    expect(dataSource).toContain("qualityTag: shots.qualityTag");
    expect(dataSource).toContain("clubDataEstType: shots.clubDataEstType");
    expect(dataSource.match(/\.limit\(200\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(dataSource.match(/\.limit\(80\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(dataSource).toContain("getCompanionTrainingLoad(userId)");
    expect(dataSource).toContain('session.handedness === "dominant"');
    expect(dataSource).toContain('session.implementKind === "club"');
  });

  it("keeps recent speed evidence in an exportable desktop workbench table", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('viewKey="speed-evidence"');
    expect(source).toContain('scope="speed"');
    expect(source).toContain('exportTableId="speed-evidence"');
    expect(source).toContain('data-workbench-scope="speed"');
    expect(source).toContain('data-workbench-export-table="speed-evidence"');
    expect(source).toContain('mainTableLabel="Speed evidence session ledger"');
    expect(source).toContain("stickyFirstColumn");
    expect(source).toContain("forekinghell-speed-evidence.csv");
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");
    expect(source).toContain("focus-aaa outline-none");

    for (const column of [
      "session",
      "date",
      "source",
      "count",
      "avg",
      "max",
      "min",
      "target",
      "action",
    ]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });

  it("does not add a persistent AI rail to the speed centre", () => {
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("WorkbenchPrompts");
    expect(source).not.toContain("rail={");
  });
});

describe("speed centre desktop-only bundle", () => {
  it("excludes the obsolete companion and iOS render graph", () => {
    expect(source).toContain('<DesktopWorkbenchLayout scope="speed">');

    for (const obsoleteSurface of [
      "MobileSpeedAnswer",
      "MobileSpeedDisclosures",
      "MobileSpeedTrendEvidence",
      "MobileSpeedLog",
      "SpeedEvidenceCard",
      "@/components/app/ios-mobile",
      "lg:hidden",
      "hidden lg:contents",
      "mobile={",
    ]) {
      expect(source).not.toContain(obsoleteSurface);
    }
  });

  it("keeps ordinary workbench UI theme-aware while preserving the custom speed chart", () => {
    const ordinaryUi = source.replace(
      /function SpeedTrendChart[\s\S]*?function ClubSpeedRowCard/,
      "",
    );

    expect(source).toContain("bg-[#111611]");
    expect(ordinaryUi).toContain("bg-card");
    expect(ordinaryUi).toContain("var(--status-success-surface)");
    expect(ordinaryUi).toContain("var(--status-warning-surface)");
    expect(ordinaryUi).not.toMatch(
      /\b(?:bg-white|text-slate-|border-slate-|bg-red-|bg-emerald-|bg-amber-)/,
    );
  });

  it("uses semantic shadcn alerts for both speed error notices", () => {
    expect(source).toContain(
      'import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"',
    );
    expect(source).toContain('<Alert variant="destructive">');
    expect(source).toContain("<AlertTitle>Speed update not saved</AlertTitle>");
    expect(source).toContain("<AlertDescription>{speedError}</AlertDescription>");
    expect(source).toContain("<AlertTitle>R-Cloud data unavailable</AlertTitle>");
    expect(source).toContain("<AlertDescription>{data.rapsodo.error}</AlertDescription>");
    expect(source).not.toMatch(
      /rounded-lg border border-\[var\(--status-(?:error|warning)-border\)\]/,
    );
  });

  it("keeps imported speed selectors and readouts on semantic shadcn controls", () => {
    for (const selectorSource of [clubFocusSource, futureBagSource]) {
      expect(selectorSource).toContain(
        'import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"',
      );
      expect(selectorSource).toContain("<ToggleGroup");
      expect(selectorSource).toContain("<ToggleGroupItem");
      expect(selectorSource).toContain('type="single"');
      expect(selectorSource).toContain("value={");
      expect(selectorSource).toContain("onValueChange=");
      expect(selectorSource).not.toContain('role="tablist"');
      expect(selectorSource).not.toContain("aria-pressed=");
      expect(selectorSource).not.toContain('import { Button } from "@/components/ui/button"');
    }

    expect(clubFocusSource).toContain('aria-label="Speed club focus"');
    expect(clubFocusSource).toContain("var(--status-success-surface)");
    expect(clubFocusSource).not.toMatch(/bg-white|text-slate-|border-emerald|bg-emerald/);

    expect(futureBagSource).toContain('import { Slider } from "@/components/ui/slider"');
    expect(futureBagSource).toContain("<Slider");
    expect(futureBagSource).toContain("<Badge");
    expect(futureBagSource).toContain('aria-label="Future bag club filter"');
    expect(futureBagSource).not.toContain('type="range"');
    expect(futureBagSource).not.toMatch(
      /bg-white|text-slate-|border-(?:emerald|amber|sky|violet)-|bg-(?:emerald|amber|sky|violet)-|text-white/,
    );
  });
});
