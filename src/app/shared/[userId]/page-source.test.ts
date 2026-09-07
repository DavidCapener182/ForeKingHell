import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const source = read("src/app/(app)/shared/[userId]/page.tsx");
const ledger = read("src/app/shared/shared-session-ledger.tsx");
const loader = read("src/lib/shared-account-data.ts");
describe("shared account review", () => {
  it("renders a read-only permitted summary and responsive session ledger", () => {
    expect(source).toContain("getSharedAccountData(userId)");
    expect(source).toContain("if (!data) notFound()");
    expect(source).toContain("<PageShell>");
    expect(source).toContain("Read-only shared account overview");
    expect(source).toContain("including when your role is editor");
    expect(source).toContain("<SharedSessionLedger");
    expect(ledger).toContain("className={styles.mobile}");
    expect(ledger).toContain("className={styles.desktop}");
    expect(source).not.toContain("DesktopInsightRail");
  });
  it("keeps filtered exports, saved views and columns scoped to the shared account", () => {
    expect(ledger).toContain("<DesktopWorkbenchControls");
    expect(ledger).toContain("viewKey={`shared-sessions:${pathname}`}");
    expect(ledger).toContain('scope="shared-sessions"');
    expect(ledger).toContain('exportFileName="shared-sessions-filtered.csv"');
    expect(ledger).toContain('data-workbench-export-table="shared-sessions"');
    expect(ledger).toContain("<caption");
    expect(ledger).toContain("tabIndex={0}");
    for (const column of ["date", "type", "session", "source", "score", "holes"])
      expect(ledger).toContain(`data-column="${column}"`);
  });
  it("keeps complete source details and labels partial scorecards", () => {
    expect(ledger).toContain("Latest {rows.length} of {total}");
    expect(ledger).toContain("a partial card is");
    expect(ledger).toContain("<ResponsiveDetailPanel");
    expect(ledger).toContain('"Source file": selected.fileName');
    expect(ledger).toContain(
      '"Scorecard total": selected.totalScore ?? "Incomplete / unavailable"',
    );
  });
  it("checks access before owner-scoped queries and preserves eligibility", () => {
    expect(loader.indexOf("await requireReadableAccountUserId(targetUserId)")).toBeLessThan(
      loader.indexOf("const db = getDb()"),
    );
    for (const table of ["users", "sessions", "shots", "clubs"])
      expect(loader).toContain(
        table === "users" ? "eq(users.id, targetUserId)" : `eq(${table}.userId, targetUserId)`,
      );
    expect(loader).toContain('inArray(shots.reviewStatus, ["included", "restored"])');
    expect(loader).toContain("shotRows.filter(isShotEvidenceEligible)");
    expect(loader).toContain("shotCount: eligibleShotRows.length");
    expect(loader).toContain("recentShotCount: eligibleShotRows.filter");
    expect(loader).toContain("Number.isFinite(shot.totalYd)");
    expect(loader).toContain("shot.totalYd > 0");
  });
});
