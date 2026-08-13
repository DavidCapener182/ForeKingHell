import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/rounds/[sessionId]/page.tsx"),
  "utf8",
);
const mobileCollapsibleSource = readFileSync(
  join(process.cwd(), "src/app/rounds/[sessionId]/mobile-collapsible.tsx"),
  "utf8",
);

describe("round detail desktop workspace source", () => {
  it("keeps round review inside the desktop workbench with shared wide-monitor rail", () => {
    const layoutBlock =
      source.match(/<DesktopWorkbenchLayout[\s\S]*?<\/DesktopWorkbenchLayout>/)?.[0] ?? "";

    expect(layoutBlock).toContain('scope="round-detail"');
    expect(layoutBlock).not.toContain("railBreakpoint=");
    expect(layoutBlock).toContain("DesktopInsightRail");
    expect(layoutBlock).toContain('title="AI round rail"');
    expect(layoutBlock).toContain("roundDetailPrompts");
    expect(layoutBlock).toContain("Scorecard");
    expect(layoutBlock).toContain("Shot corrections");
  });

  it("uses shadcn tabs to separate the desktop round review into focused views", () => {
    expect(source).toContain("<LazyRoundReviewTabs value={view} sessionId={sessionId} />");
    expect(source).toContain('view === "summary"');
    expect(source).toContain('view === "scorecard"');
    expect(source).toContain('view === "map"');
    expect(source).toContain('view === "evidence"');
    expect(source).toContain('view === "corrections"');
    expect(source).toContain("parseRoundReviewView");
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
    expect(source).toContain("stickyFirstColumn");
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");

    for (const column of ["hole", "shot", "club", "carry", "total", "side", "change-club"]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });

  it("offers a course-linked 3D replay and a separate expiring public share action", () => {
    expect(source).toContain("{round.session.courseId ? (");
    expect(source).toContain("href={`/play/${round.session.courseId}?sessionId=${sessionId}`}");
    expect(source).toContain("Open 3D replay");
    expect(source).toContain("createCourseTwinReplayShareLinkAction");
    expect(source).toContain("Share 3D replay");
  });

  it("uses real mobile disclosures while leaving desktop review content expanded", () => {
    expect(source).toContain(
      'import { MobileCollapsible } from "@/app/rounds/[sessionId]/mobile-collapsible"',
    );
    expect(mobileCollapsibleSource).toContain("useSyncExternalStore");
    expect(mobileCollapsibleSource).toContain('const DESKTOP_MEDIA_QUERY = "(min-width: 64rem)"');
    expect(mobileCollapsibleSource).toContain("open={isDesktop || undefined}");
    expect(mobileCollapsibleSource).toContain("<summary");
    expect(mobileCollapsibleSource).toContain("group-open:block lg:contents");
    expect(mobileCollapsibleSource).toContain("group-open:rotate-180");
    expect(mobileCollapsibleSource).not.toContain('<section className="contents">');
  });

  it("renders a purpose-built mobile round review before the preserved desktop workbench", () => {
    expect(source).toContain("<MobileRoundDetail");
    expect(source).toContain("<MobileAppShell");
    expect(source).toContain("<MobileTopBar title={courseName} />");
    expect(source).toContain('className="hidden lg:grid"');
    expect(source.indexOf("<MobileRoundDetail")).toBeLessThan(
      source.indexOf('className="hidden lg:grid"'),
    );
    expect(source).toContain("<IOSDisclosureGroup");
    expect(source).toContain('value: "performance"');
    expect(source).toContain('value: "scorecard"');
    expect(source).toContain('value: "map"');
    expect(source).toContain('value: "full-site"');
    expect(source).toContain("MobileCompletedScorecard");
    expect(source).toContain("Turning point");
    expect(source).toContain("Strongest area");
    expect(source).toContain("Most costly area");
    expect(source).toContain("Build next practice");
  });

  it("uses hole values in the current-hole summary rather than cumulative round totals", () => {
    const firstCard =
      source.match(/function MobileRoundFirstCard[\s\S]*?function MobileCurrentHoleEditor/)?.[0] ??
      "";

    expect(firstCard).toContain("formatNullableInteger(hole.score)");
    expect(firstCard).toContain("formatNullableInteger(hole.putts)");
    expect(firstCard).not.toContain("totalScore");
    expect(firstCard).not.toContain("totalPutts");
    expect(firstCard).toContain('href="#mobile-current-hole"');
  });

  it("keeps replay in one disclosure and moves completed-round management to Full Site", () => {
    const mobileDetail =
      source.match(/function MobileRoundDetail[\s\S]*?function MobileRoundResultCard/)?.[0] ?? "";

    expect(mobileDetail.match(/<IOSDisclosureGroup/g)).toHaveLength(1);
    expect(mobileDetail).toContain("<MobileRoundMap");
    expect(mobileDetail).not.toContain("<MobileRoundCorrections");
    expect(mobileDetail).not.toContain("<MobileRoundProof");
    expect(mobileDetail).toContain("Corrections & proof");
    expect(mobileDetail).toContain("Open Full Site");
    expect(source).toContain("<LazyRoundShotMap");
    expect(source).toContain('id="mobile-round-review"');
  });
});
