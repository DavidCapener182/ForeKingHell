import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/feed/page.tsx"), "utf8");

describe("feed desktop activity ledger", () => {
  it("keeps feed activity review table-first without replacing the card stream", () => {
    expect(source).toContain("FeedActivityLedger");
    expect(source).toContain("FeedCardList");
    expect(source).toContain('<PageShell className="bg-slate-50/20">');
    expect(source).not.toContain('<PageShell size="7xl"');
    expect(source).toContain("DesktopWorkbenchLayout");
    expect(source).toContain('<DesktopWorkbenchLayout scope="feed" className="hidden sm:grid">');
    expect(source).toContain("</DesktopWorkbenchLayout>");
    expect(source).toContain('aria-label="Feed profile shortcuts"');
    expect(source).toContain('aria-label="Feed social insight rail"');
    expect(source).toContain("Network pulse");
    expect(source).toContain("Privacy state");
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('data-workbench-scope="feed-activity"');
    expect(source).toContain('exportTableId="feed-activity-ledger"');
    expect(source).toContain('data-workbench-export-table="feed-activity-ledger"');
    expect(source).toContain('mainTableLabel="Feed activity ledger table"');
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("rail={");

    for (const column of [
      "activity",
      "golfer",
      "type",
      "metric",
      "proof",
      "privacy",
      "engagement",
      "date",
      "action",
    ]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });
});
