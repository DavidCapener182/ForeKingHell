import Link from "next/link";
import {
  ArrowRight,
  Brain,
  Flag,
  Gauge,
  LineChart,
  ListChecks,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Upload,
  Zap,
  type LucideIcon,
} from "lucide-react";

import {
  CompactReadoutGrid,
  DataPanel,
  MetricCard,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { MobileSummaryHero } from "@/components/visuals/mobile-summary-hero";
import { PageArtwork, ShotTraceMotif } from "@/components/visuals/page-artwork";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { formatClubType } from "@/lib/club-format";
import type { ClubAnalytics } from "@/lib/club-analytics";
import { getProgressData } from "@/lib/progress-data";
import { buildProgressSummary, type ProgressClubRow } from "@/lib/progress-summary";

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});
const integerFormatter = new Intl.NumberFormat("en-GB");

export default async function ProgressPage() {
  const data = await getProgressData();
  const summary = buildProgressSummary(data.clubs);
  const mostImproved = summary.rankings.mostImproved;
  const needsWork = summary.rankings.needsWork;

  return (
    <PageShell>
      <div className="flex items-center justify-between gap-4">
        <Button asChild variant="ghost" className="px-0">
          <Link href="/dashboard" prefetch={false}>
            <ArrowRight className="size-4 rotate-180" />
            Dashboard
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/bag" prefetch={false}>
              <Target className="size-4" />
              Bag
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/import" prefetch={false}>
              <Upload className="size-4" />
              Import CSV
            </Link>
          </Button>
        </div>
      </div>

      <PageHeader
        eyebrow={<StatusPill tone="sky">What changed?</StatusPill>}
        title="Progress"
        description="A bag-wide readout of what is improving, what is drifting, which clubs you can trust, and what to practise next."
        visual={<PageArtwork variant="progress" alt="" className="h-full min-h-44" />}
        actions={
          mostImproved ? (
            <Button asChild size="lg" className="rounded-xl bg-[#111827] text-white">
              <Link href={`/bag/${mostImproved.clubId}/analytics`} prefetch={false}>
                <Brain className="size-4" />
                Open best signal
              </Link>
            </Button>
          ) : (
            <Button asChild size="lg" className="rounded-xl bg-[#111827] text-white">
              <Link href="/import" prefetch={false}>
                <Upload className="size-4" />
                Import first CSV
              </Link>
            </Button>
          )
        }
        metrics={[
          {
            label: "Tracked clubs",
            value: integerFormatter.format(summary.totals.clubs),
            detail: `${integerFormatter.format(summary.totals.trackedCleanShots)} clean stock shots`,
          },
          {
            label: "Saved shots",
            value: integerFormatter.format(summary.totals.shots),
            detail: "Launch monitor rows used for trend checks",
          },
          {
            label: "Average trust",
            value: `${summary.totals.averageTrust}%`,
            detail: "Distance, direction, strike, and sample depth",
          },
          {
            label: "Playable rate",
            value: formatRate(summary.totals.averagePlayableRate),
            detail: "Average across clubs with enough directional data",
          },
        ]}
      />

      {data.clubs.length === 0 ? (
        <DataPanel>
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            <Sparkles className="size-9 text-emerald-500" />
            <div>
              <p className="text-xl font-semibold">No progress baseline yet</p>
              <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                Import a Rapsodo CSV and ForeKingHell will build first-vs-latest club
                comparisons automatically.
              </p>
            </div>
            <Button asChild>
              <Link href="/import" prefetch={false}>
                <Upload className="size-4" />
                Import CSV
              </Link>
            </Button>
          </CardContent>
        </DataPanel>
      ) : (
        <>
          <MobileSummaryHero
            eyebrow={<StatusPill tone="green">Progress readout</StatusPill>}
            title={mostImproved ? `Biggest improvement: ${formatClubType(mostImproved.clubType)}` : "Build a baseline first"}
            description={needsWork ? `Next practice block: ${formatClubType(needsWork.clubType)}.` : "Import comparable sessions to show movement."}
            metricLabel="Average trust"
            metricValue={`${summary.totals.averageTrust}%`}
            visual={<ShotTraceMotif className="h-16 w-20 text-emerald-700" />}
            action={
              <Button asChild size="sm" className="rounded-xl bg-[#111827] text-white">
                <Link href={needsWork ? `/bag/${needsWork.clubId}/analytics` : "/import"} prefetch={false}>
                  Next
                </Link>
              </Button>
            }
          />

          <section className="hidden gap-4 sm:grid md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Biggest movement"
              value={mostImproved ? formatClubType(mostImproved.clubType) : "--"}
              detail={mostImproved ? improvementDetail(mostImproved) : "Need comparable baselines"}
              href={mostImproved ? `/bag/${mostImproved.clubId}/analytics` : undefined}
              icon={TrendingUp}
              tone="green"
            />
            <MetricCard
              label="Most trusted"
              value={summary.rankings.mostTrusted ? formatClubType(summary.rankings.mostTrusted.clubType) : "--"}
              detail={
                summary.rankings.mostTrusted
                  ? `${summary.rankings.mostTrusted.trustIndex}% trust / ${summary.rankings.mostTrusted.confidenceLabel}`
                  : "Need more shots"
              }
              href={summary.rankings.mostTrusted ? `/bag/${summary.rankings.mostTrusted.clubId}/analytics` : undefined}
              icon={Gauge}
              tone="sky"
            />
            <MetricCard
              label="Needs work"
              value={needsWork ? formatClubType(needsWork.clubType) : "--"}
              detail={needsWork ? `${needsWork.trustIndex}% trust with ${needsWork.primaryMiss} miss` : "No weak signal yet"}
              href={needsWork ? `/bag/${needsWork.clubId}/analytics` : undefined}
              icon={ListChecks}
              tone="pink"
            />
            <MetricCard
              label="Most volatile"
              value={summary.rankings.mostVolatile ? formatClubType(summary.rankings.mostVolatile.clubType) : "--"}
              detail={
                summary.rankings.mostVolatile
                  ? `${formatRate(findAnalytics(data.clubs, summary.rankings.mostVolatile.clubId)?.accuracy.bigMissRate ?? null)} big miss rate`
                  : "Need side-carry data"
              }
              href={summary.rankings.mostVolatile ? `/bag/${summary.rankings.mostVolatile.clubId}/analytics` : undefined}
              icon={TrendingDown}
              tone="amber"
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1fr_0.95fr]">
            <DataPanel>
              <SectionHeader
                title="Coach summary"
                description="The highest-signal changes across the bag."
                action={<StatusPill tone="green">Personal baseline</StatusPill>}
              />
              <CardContent>
                <CompactReadoutGrid
                  columnsClassName="md:grid-cols-2"
                  items={summary.signals.map((signal) => ({
                    label: signal.label,
                    value: signal.value,
                    detail: signal.detail,
                    tone: signal.tone,
                    href: signal.clubId ? `/bag/${signal.clubId}/analytics` : "/bag",
                  }))}
                />
              </CardContent>
            </DataPanel>

            <DataPanel>
              <SectionHeader
                title="Practice plan"
                description="Ranked by trust gap, big misses, launch window, and strike quality."
                action={<Brain className="size-5 text-emerald-500" />}
              />
              <CardContent className="space-y-3">
                {summary.practicePlan.map((priority, index) => (
                  <Link
                    key={priority.clubId}
                    href={`/bag/${priority.clubId}/analytics`}
                    prefetch={false}
                    className="apple-panel-strong block p-4 transition-colors hover:border-emerald-300"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Badge variant="outline">#{index + 1}</Badge>
                        <h2 className="mt-2 text-lg font-semibold tracking-normal">
                          {priority.title}
                        </h2>
                      </div>
                      <StatusPill tone={priority.tone}>{priority.score}</StatusPill>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{priority.reason}</p>
                    <p className="mt-2 text-sm font-medium">{priority.drill}</p>
                  </Link>
                ))}
              </CardContent>
            </DataPanel>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <DataPanel>
              <SectionHeader
                title="Bag movement"
                description="Latest clean baseline vs first clean baseline. Offline going down is good."
                action={<LineChart className="size-5 text-sky-500" />}
              />
              <CardContent>
                <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:px-0">
                  {summary.clubRows.map((row) => (
                    <div key={row.clubId} className="min-w-[82vw] shrink-0 sm:min-w-0">
                      <ClubMovementRow row={row} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </DataPanel>

            <DataPanel>
              <SectionHeader
                title="Journey"
                description="Notable moments ForeKingHell can already infer from your data."
                action={<Flag className="size-5 text-pink-500" />}
              />
              <CardContent className="space-y-3">
                {summary.journey.map((event, index) => (
                  <Link
                    key={`${event.title}-${index}`}
                    href={`/bag/${event.clubId}/analytics`}
                    prefetch={false}
                    className="apple-panel-strong grid grid-cols-[auto_1fr] gap-3 p-4 hover:border-emerald-300"
                  >
                    <div className="mt-1 size-3 rounded-full bg-[#111827] ring-4 ring-emerald-100" />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{event.title}</p>
                        <StatusPill tone={event.tone}>{formatClubType(event.clubType)}</StatusPill>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{event.detail}</p>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </DataPanel>
          </section>
        </>
      )}
    </PageShell>
  );
}

function ClubMovementRow({ row }: { row: ProgressClubRow }) {
  return (
    <Link
      href={`/bag/${row.clubId}/analytics`}
      prefetch={false}
      className="apple-panel-strong grid gap-4 p-4 transition-colors hover:border-emerald-300 lg:grid-cols-[1fr_1.25fr]"
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold tracking-normal">{formatClubType(row.clubType)}</h2>
          <Badge variant="outline">{row.confidenceLabel}</Badge>
        </div>
        <p className="mt-1 truncate text-sm text-muted-foreground">{row.brandModel}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <StatusPill tone="sky">{row.trustIndex}% trust</StatusPill>
          <StatusPill tone="slate">{row.sampleSize} clean</StatusPill>
          <StatusPill tone="green">{formatYards(row.stockCarryYd)}</StatusPill>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        <DeltaTile label="Carry" value={row.carryDeltaYd} suffix="yd" goodWhen="positive" icon={TrendingUp} />
        <DeltaTile label="Ball speed" value={row.ballSpeedDeltaMph} suffix="mph" goodWhen="positive" icon={Zap} />
        <DeltaTile label="Offline" value={row.offlineDeltaYd} suffix="yd" goodWhen="negative" icon={Target} />
        <DeltaTile label="Launch" value={row.launchDeltaDeg} suffix="deg" goodWhen="neutral" icon={LineChart} />
      </div>
    </Link>
  );
}

function DeltaTile({
  label,
  value,
  suffix,
  goodWhen,
  icon: Icon,
}: {
  label: string;
  value: number | null;
  suffix: string;
  goodWhen: "positive" | "negative" | "neutral";
  icon: LucideIcon;
}) {
  const good =
    value !== null &&
    (goodWhen === "positive" ? value >= 0 : goodWhen === "negative" ? value <= 0 : Math.abs(value) <= 2);

  return (
    <div className="rounded-xl bg-white/85 p-3 ring-1 ring-slate-200/80">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{label}</span>
        <Icon className="size-3.5" />
      </div>
      <p className={good ? "mt-2 font-semibold text-emerald-700" : "mt-2 font-semibold text-amber-700"}>
        {value === null ? "--" : `${value > 0 ? "+" : ""}${numberFormatter.format(value)} ${suffix}`}
      </p>
    </div>
  );
}

function findAnalytics(
  clubs: Array<{ clubId: string; analytics: ClubAnalytics }>,
  clubId: string,
) {
  return clubs.find((club) => club.clubId === clubId)?.analytics;
}

function improvementDetail(row: ProgressClubRow) {
  const parts = [
    row.carryDeltaYd === null ? null : `${formatSigned(row.carryDeltaYd)} yd carry`,
    row.offlineDeltaYd === null
      ? null
      : `${Math.abs(row.offlineDeltaYd)} yd ${row.offlineDeltaYd <= 0 ? "tighter" : "wider"}`,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" / ") : `${row.trustIndex}% trust`;
}

function formatYards(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)} yd`;
}

function formatRate(value: number | null) {
  return value === null ? "--" : `${Math.round(value)}%`;
}

function formatSigned(value: number) {
  return `${value > 0 ? "+" : ""}${numberFormatter.format(value)}`;
}
