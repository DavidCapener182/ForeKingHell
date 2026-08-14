import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  Brain,
  Crosshair,
  FileText,
  GitCompareArrows,
  LineChart,
  Sparkles,
  Target,
  Upload,
} from "lucide-react";

import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { DesktopInsightRail, DesktopWorkbenchLayout } from "@/components/app/desktop-workbench";
import {
  defaultClubCompareFilters,
  defaultPlayerCompareFilters,
  getClubCompareData,
  getPlayerCompareData,
  type ClubCompareFilters,
  type PlayerCompareFilters,
} from "@/lib/compare-data";
import { ClubCompareClient } from "@/app/compare/club-compare-client";
import { PlayerCompareClient } from "@/app/compare/player-compare-client";
import { ProgressCompareClient } from "@/app/compare/progress-compare-client";
import type { SavedWorkspaceComparison } from "@/app/compare/comparison-workspace";
import { getDb } from "@/db/client";
import { analysisSnapshots } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;
const integerFormatter = new Intl.NumberFormat("en-GB");
const compareWorkbenchPrompts = [
  {
    label: "Explain this page",
    prompt:
      "Explain the current ForeKingHell Compare workspace using visible progress, club-vs-club and player comparison evidence only. Do not invent missing numbers.",
    icon: GitCompareArrows,
  },
  {
    label: "What changed?",
    prompt:
      "Compare the latest period against the baseline and explain what changed, how confident the signal is, and what to check next.",
    icon: Sparkles,
  },
  {
    label: "Build practice plan",
    prompt:
      "Build a practice plan from this Compare workspace. Use the visible deltas and mark any low-confidence recommendation.",
    icon: Target,
  },
  {
    label: "Save this insight",
    prompt:
      "Save the clearest comparison insight with cited visible evidence, confidence level, and one next action.",
    icon: LineChart,
  },
  {
    label: "Generate report",
    prompt:
      "Generate a comparison report with progress summary, key changed metrics, confidence, and recommended practice action.",
    icon: FileText,
  },
];

export default async function ComparePage({ searchParams }: { searchParams: SearchParams }) {
  if (!process.env.DATABASE_URL?.trim()) {
    return (
      <PageShell>
        <PageHeader
          eyebrow={<StatusPill tone="amber">Configuration</StatusPill>}
          title="Compare clubs"
          description="DATABASE_URL is required before club comparisons can be calculated."
        />
      </PageShell>
    );
  }

  const params = await searchParams;
  const activeView = parseCompareView(stringParam(params.view));
  const userId = await requireCurrentUserId();
  const [playerData, data, savedRows] = await Promise.all([
    getPlayerCompareData(parsePlayerFilters(params)),
    getClubCompareData(parseFilters(params)),
    getDb()
      .select()
      .from(analysisSnapshots)
      .where(
        and(
          eq(analysisSnapshots.userId, userId),
          sql`${analysisSnapshots.chartStateJson}->>'view' = 'workspace_comparison'`,
        ),
      )
      .orderBy(desc(analysisSnapshots.capturedAt))
      .limit(36),
  ]);
  const savedComparisons = savedRows.flatMap(savedWorkspaceComparison);
  const latestSession = data.progress.latestSession;
  const comparison = data.progress.previousWeek;
  const selectedClubLabel =
    data.clubA && data.clubB ? `${data.clubA.label} vs ${data.clubB.label}` : "Choose clubs";
  const selectedClubDetail =
    data.clubA && data.clubB
      ? `${integerFormatter.format(data.clubA.stockShots)} vs ${integerFormatter.format(data.clubB.stockShots)} stock shots in the selected club view.`
      : `${integerFormatter.format(data.clubs.length)} clubs are available for side-by-side review.`;
  const selectedPlayerLabel =
    playerData.playerA && playerData.playerB
      ? `${playerData.playerA.displayName} vs ${playerData.playerB.displayName}`
      : "Choose players";
  const selectedPlayerDetail =
    playerData.playerA && playerData.playerB
      ? `${integerFormatter.format(playerData.playerA.rounds)} vs ${integerFormatter.format(playerData.playerB.rounds)} rounds, plus public stock-yardage evidence where available.`
      : `${integerFormatter.format(playerData.players.length)} visible profiles are available for player comparison.`;

  return (
    <PageShell>
      <div data-compare-desktop-workbench>
        <DesktopWorkbenchLayout
          scope="compare"
          railBreakpoint="wide"
          rail={
            <DesktopInsightRail
              title="AI compare rail"
              description="Progress, club and player comparison context stays available while reviewing side-by-side evidence."
              metrics={[
                {
                  label: "Latest sample",
                  value: latestSession
                    ? `${integerFormatter.format(latestSession.shotCount)} shots`
                    : "No session",
                  detail: latestSession
                    ? `${latestSession.label} · ${latestSession.dateLabel}`
                    : "Import a practice session before asking for period comparisons.",
                  tone: latestSession ? "green" : "slate",
                },
                {
                  label: "Period signal",
                  value: comparison.benefit.verdict,
                  detail: comparison.benefit.summary,
                  tone: comparisonBenefitTone(comparison.benefit.verdict),
                },
                {
                  label: "Club comparison",
                  value: selectedClubLabel,
                  detail: selectedClubDetail,
                  tone: data.clubA && data.clubB ? "sky" : "amber",
                },
                {
                  label: "Player comparison",
                  value: selectedPlayerLabel,
                  detail: selectedPlayerDetail,
                  tone: playerData.playerA && playerData.playerB ? "green" : "slate",
                },
              ]}
              evidence={[
                `${comparison.focus.label} is compared with ${comparison.label.toLowerCase()}.`,
                `${integerFormatter.format(comparison.focus.stockShots)} current stock shots and ${integerFormatter.format(comparison.baseline.stockShots)} baseline stock shots feed the period view.`,
                selectedClubDetail,
                "Player comparisons only use visible profile, scoring, stock-yardage and tournament data.",
              ]}
              prompts={compareWorkbenchPrompts}
              actions={[
                {
                  label: "Open shots",
                  href: "/shots",
                  detail: "Review the raw shot rows behind the deltas.",
                  icon: Crosshair,
                },
                {
                  label: "Coach desk",
                  href: "/coach",
                  detail: "Turn comparison signals into drills.",
                  icon: Brain,
                },
                {
                  label: "Progress",
                  href: "/progress",
                  detail: "Review trend and bag movement context.",
                  icon: LineChart,
                },
              ]}
            />
          }
        >
          <div className="flex items-center justify-end gap-4">
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link href="/import" prefetch={false}>
                  <Upload className="size-4" />
                  Import data
                </Link>
              </Button>
            </div>
          </div>

          <PageHeader
            eyebrow={<StatusPill tone="green">Your progress comparisons</StatusPill>}
            title="Compare"
            description="Start with your latest week against recent practice, then drill into club-vs-club and player comparisons."
            actions={
              <Button asChild size="lg" className="rounded-lg">
                <Link href="/shots" prefetch={false}>
                  <Crosshair className="size-4" />
                  Open shots
                </Link>
              </Button>
            }
          />

          <ButtonGroup
            aria-label="Comparison view"
            className="max-w-full justify-start overflow-x-auto"
            data-compare-active-view
          >
            {(["progress", "clubs", "players"] as const).map((view) => {
              const active = activeView === view;

              return (
                <Button key={view} asChild size="sm" variant={active ? "secondary" : "outline"}>
                  <Link href={`/compare?view=${view}`} aria-current={active ? "page" : undefined}>
                    {view === "progress" ? "Progress" : view === "clubs" ? "Clubs" : "Players"}
                  </Link>
                </Button>
              );
            })}
          </ButtonGroup>
          <div className="grid gap-4 pt-2">
            {activeView === "progress" ? (
              <ProgressCompareClient
                data={data.progress}
                savedComparisons={savedComparisons.filter((item) => item.view === "progress")}
              />
            ) : activeView === "clubs" ? (
              <ClubCompareClient
                data={data}
                savedComparisons={savedComparisons.filter((item) => item.view === "clubs")}
              />
            ) : (
              <PlayerCompareClient
                data={playerData}
                savedComparisons={savedComparisons.filter((item) => item.view === "players")}
              />
            )}
          </div>
        </DesktopWorkbenchLayout>
      </div>
    </PageShell>
  );
}

function parseFilters(searchParams: Awaited<SearchParams>): ClubCompareFilters {
  const defaults = defaultClubCompareFilters();

  return {
    clubAId:
      stringParam(searchParams.clubAId) || stringParam(searchParams.clubId) || defaults.clubAId,
    clubBId: stringParam(searchParams.clubBId) || defaults.clubBId,
  };
}

function parsePlayerFilters(searchParams: Awaited<SearchParams>): PlayerCompareFilters {
  const defaults = defaultPlayerCompareFilters();

  return {
    playerAId: stringParam(searchParams.playerAId) || defaults.playerAId,
    playerBId: stringParam(searchParams.playerBId) || defaults.playerBId,
  };
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function parseCompareView(value: string) {
  if (value === "clubs" || value === "players") return value;
  return "progress" as const;
}

function comparisonBenefitTone(verdict: string) {
  if (verdict === "Beneficial") return "green" as const;
  if (verdict === "Useful") return "sky" as const;
  if (verdict === "Mixed") return "amber" as const;
  return "slate" as const;
}

function savedWorkspaceComparison(
  row: typeof analysisSnapshots.$inferSelect,
): SavedWorkspaceComparison[] {
  const view = row.chartStateJson.compareView;
  if (view !== "progress" && view !== "clubs" && view !== "players") return [];

  return [
    {
      id: row.id,
      view,
      name: row.name,
      capturedAt: row.capturedAt.toISOString(),
      description: String(
        row.summaryJson.summary ??
          `${String(row.summaryJson.focusLabel ?? "Focus")} vs ${String(row.summaryJson.baselineLabel ?? "baseline")}`,
      ),
      notes: row.notes,
    },
  ];
}
