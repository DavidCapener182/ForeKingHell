import Link from "next/link";
import {
  ArrowLeft,
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
import { MobileRouteHeader } from "@/components/mobile-sports";
import { Button } from "@/components/ui/button";
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
  const [playerData, data] = await Promise.all([
    getPlayerCompareData(parsePlayerFilters(params)),
    getClubCompareData(parseFilters(params)),
  ]);
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
      <MobileRouteHeader title="Analyse" group="analyse" activeKey="compare" />

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
        <div className="hidden items-center justify-between gap-4 sm:flex">
          <Button asChild variant="ghost" className="px-0">
            <Link href="/dashboard" prefetch={false}>
              <ArrowLeft className="size-4" />
              Dashboard
            </Link>
          </Button>
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
            <Button
              asChild
              size="lg"
              className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]"
            >
              <Link href="/shots" prefetch={false}>
                <Crosshair className="size-4" />
                Open shots
              </Link>
            </Button>
          }
        />

        <ProgressCompareClient data={data.progress} />

        <ClubCompareClient data={data} />

        <PlayerCompareClient data={playerData} />
      </DesktopWorkbenchLayout>
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

function comparisonBenefitTone(verdict: string) {
  if (verdict === "Beneficial") return "green" as const;
  if (verdict === "Useful") return "sky" as const;
  if (verdict === "Mixed") return "amber" as const;
  return "slate" as const;
}
