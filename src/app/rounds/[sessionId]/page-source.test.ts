import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/rounds/[sessionId]/page.tsx"), "utf8");

describe("round detail desktop workspace source", () => {
  it("keeps round review inside the desktop workbench with a contextual AI rail", () => {
    const layoutBlock =
      source.match(/<DesktopWorkbenchLayout[\s\S]*?<\/DesktopWorkbenchLayout>/)?.[0] ?? "";

    expect(layoutBlock).toContain('scope="round-detail"');
    expect(layoutBlock).not.toContain('railBreakpoint="wide"');
    expect(layoutBlock).toContain("DesktopInsightRail");
    expect(layoutBlock).toContain('title="AI round rail"');
    expect(layoutBlock).toContain("roundDetailPrompts");
    expect(layoutBlock).toContain("Scorecard");
    expect(layoutBlock).toContain("Shot corrections");
  });

  it("keeps round shot corrections as a controlled exportable table", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain("roundShotCorrectionColumns");
    expect(source).toContain("roundShotCorrectionViews");
    expect(source).toContain('data-workbench-scope="round-shots"');
    expect(source).toContain("viewKey={`round-shots-${round.session.id}`}");
    expect(source).toContain('scope="round-shots"');
    expect(source).toContain('exportTableId="round-shots"');
    expect(source).toContain('exportFileName="forekinghell-round-shot-corrections.csv"');
    expect(source).toContain('data-workbench-export-table="round-shots"');
    expect(source).toContain('mainTableLabel="Round shot club corrections table"');
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");

    for (const column of ["hole", "shot", "club", "carry", "total", "side", "change-club"]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });
});
