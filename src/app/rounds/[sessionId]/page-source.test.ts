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
const roundShotMapSource = readFileSync(
  join(process.cwd(), "src/app/rounds/[sessionId]/round-shot-map.tsx"),
  "utf8",
);
const lazyOfflineRoundEditFormSource = readFileSync(
  join(process.cwd(), "src/app/rounds/[sessionId]/lazy-offline-round-edit-form.tsx"),
  "utf8",
);
const lazyRoundEditSelectSource = readFileSync(
  join(process.cwd(), "src/app/rounds/[sessionId]/lazy-round-edit-select.tsx"),
  "utf8",
);
const roundEditSelectSource = readFileSync(
  join(process.cwd(), "src/app/rounds/[sessionId]/round-edit-select.tsx"),
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
    expect(source).toContain("<RoundCorrectionsPanel shotCount={round.shots.length}>");
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

    const correctionsBlock =
      source.match(/view === "corrections"[\s\S]*?<\/DesktopWorkbenchLayout>/)?.[0] ?? "";
    expect(correctionsBlock).not.toContain("bg-white");
    expect(correctionsBlock).not.toContain("bg-amber-50");
    expect(correctionsBlock).toContain("<Alert>");
  });

  it("defers view-specific correction and offline-edit client code", () => {
    expect(source).not.toContain(
      'import { OfflineRoundEditForm } from "@/components/offline-round-edit-form"',
    );
    expect(source).toContain(
      'import { LazyOfflineRoundEditForm as OfflineRoundEditForm } from "@/app/rounds/[sessionId]/lazy-offline-round-edit-form"',
    );
    expect(source).not.toContain(
      'import { RoundCorrectionsPanel } from "@/app/rounds/[sessionId]/round-corrections-panel"',
    );
    expect(source).toContain('view === "corrections" && hasClubData');
    expect(source).toContain('await import("@/app/rounds/[sessionId]/round-corrections-panel")');
    expect(lazyOfflineRoundEditFormSource).toContain('"use client"');
    expect(lazyOfflineRoundEditFormSource).toContain('import dynamic from "next/dynamic"');
    expect(lazyOfflineRoundEditFormSource).toContain(
      'import("@/components/offline-round-edit-form")',
    );
  });

  it("keeps shadcn edit selects while deferring their Radix graph from first load", () => {
    expect(source).not.toContain('from "@/components/ui/select"');
    expect(source).toContain("<LazyRoundEditSelect");
    expect(lazyRoundEditSelectSource).toContain('"use client"');
    expect(lazyRoundEditSelectSource).toContain('import dynamic from "next/dynamic"');
    expect(lazyRoundEditSelectSource).toContain(
      'import("@/app/rounds/[sessionId]/round-edit-select")',
    );
    expect(roundEditSelectSource).toContain('from "@/components/ui/select"');
    expect(roundEditSelectSource).toContain("<Select");
    expect(roundEditSelectSource).toContain("<SelectContent>");
    expect(roundEditSelectSource).toContain("<SelectItem");
  });

  it("presents the round outcome with shared result and connected metric components", () => {
    const summaryBlock = source.match(/view === "summary"[\s\S]*?view === "map"/)?.[0] ?? "";

    expect(summaryBlock).toContain("<ResultHero");
    expect(summaryBlock).toContain("<ConnectedMetricBar");
  });

  it("keeps ordinary round controls and status surfaces semantic across themes", () => {
    expect(source).not.toContain("bg-white");
    expect(source).not.toContain("#0B7A3B");
    expect(source).not.toContain("#064E3B");
    expect(source).not.toMatch(/(?:bg|text|border|ring)-(?:emerald|sky|amber|rose)-/);
    expect(source).toContain("var(--status-success-surface)");
    expect(source).toContain("bg-primary text-primary-foreground");
    expect(source).toContain("bg-slate-950");
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
    expect(mobileCollapsibleSource).toContain("<Collapsible");
    expect(mobileCollapsibleSource).toContain("open={isDesktop || open}");
    expect(mobileCollapsibleSource).toContain("<CollapsibleTrigger");
    expect(mobileCollapsibleSource).toContain("<CollapsibleContent");
    expect(mobileCollapsibleSource).toContain("group-data-[state=open]/collapsible:rotate-180");
    expect(mobileCollapsibleSource).not.toContain("<details");
    expect(mobileCollapsibleSource).not.toContain('<section className="contents">');
  });

  it("uses direct shadcn-styled round-review disclosure triggers across the RSC boundary", () => {
    const reviewAccordion =
      source.match(/function ReviewAccordion[\s\S]*?function RoundHoleSelector/)?.[0] ?? "";

    expect(reviewAccordion).toContain("className={buttonVariants");
    expect(reviewAccordion).toContain('variant: "ghost"');
    expect(reviewAccordion).not.toContain("<CollapsibleTrigger asChild>");
    expect(reviewAccordion).not.toMatch(/<button\b/);
  });

  it("server-branches the purpose-built companion review from the desktop workbench", () => {
    expect(source).toContain("<MobileRoundDetail");
    expect(source).toContain("<MobileAppShell");
    expect(source).toContain("<MobileTopBar title={courseName} />");
    expect(source).toContain("getRequestAppSurface");
    expect(source).toContain('surface === "companion"');
    expect(source).toContain('surface === "workbench" ? await import');
    expect(source).not.toContain('className="hidden lg:grid"');
    expect(source).not.toMatch(
      /import \{[\s\S]*DesktopWorkbenchLayout[\s\S]*\} from "@\/components\/app\/desktop-workbench"/,
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

  it("uses themed shadcn controls around the specialist round shot map", () => {
    const ordinaryChrome =
      roundShotMapSource.match(
        /return \(\n    <div className="grid gap-4 xl:grid-cols[\s\S]*?function HoleVectorFallback/,
      )?.[0] ?? "";
    const specialistMap =
      roundShotMapSource.match(
        /function HoleVectorFallback[\s\S]*?function roundShotMapSummary/,
      )?.[0] ?? "";

    expect(ordinaryChrome).toContain("data-round-shot-selection");
    expect(ordinaryChrome).toContain("<ToggleGroup");
    expect(ordinaryChrome).toContain("data-round-distance-toggle");
    expect(ordinaryChrome).toContain("data-round-map-toggle");
    expect(ordinaryChrome).not.toContain("<button");
    expect(ordinaryChrome).not.toContain("bg-[#0B7A3B] text-white");
    expect(ordinaryChrome).not.toContain("border-[#111827] shadow-sm");
    expect(ordinaryChrome).not.toContain("border border-slate-200 bg-white");
    expect(ordinaryChrome).not.toContain('className="bg-white/82"');
    expect(ordinaryChrome).not.toContain("text-[#111827]");
    expect(roundShotMapSource).toContain("bg-card/88");
    expect(roundShotMapSource).toContain("ring-border/80");

    expect(specialistMap).toContain("bg-[#101827]");
    expect(specialistMap).toContain("focus-visible:ring-white");
    expect(specialistMap).toContain('stroke="#111827"');
    expect(specialistMap).toContain("projectedShots.map");
  });
});
