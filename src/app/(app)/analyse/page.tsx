import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CloudSun,
  Command,
  Crosshair,
  Database,
  ShieldCheck,
} from "lucide-react";
import { and, count, desc, eq, sql } from "drizzle-orm";

import { AnalyseProvenancePanel } from "@/app/analyse/analyse-provenance-panel";
import { AppCommandContentTrigger } from "@/components/app/app-command-trigger";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { ConnectedMetricBar } from "@/components/app/connected-metric-bar";
import { PageShell, StatusPill } from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDb } from "@/db/client";
import { clubs, sessions, shots } from "@/db/schema";
import {
  analysisConfidence,
  confidenceDisplayLabel,
  type AnalysisConfidenceLabel,
} from "@/lib/analysis-confidence";
import { formatClubType } from "@/lib/club-format";
import { requireCurrentUserId } from "@/lib/current-user";
import { excludedRecordQualityTags, excludedRecordShotCategories } from "@/lib/shot-records";
import { formatSessionDateRange, validSessionDate } from "@/lib/session-date-range";

export const dynamic = "force-dynamic";

export default async function AnalysePage() {
  const data = await getAnalyseOverview();

  if (data.totalShots === 0) {
    return (
      <PageShell>
        <PerformanceLabMasthead />
        <AppEmptyState
          icon={<Database className="size-6" aria-hidden />}
          title="Import measured evidence to start analysis"
          description="The Performance Lab waits for trusted launch-monitor evidence before it describes a pattern or recommends a change."
          primaryAction={
            <Button asChild>
              <Link href="/import">Import a session</Link>
            </Button>
          }
          secondaryAction={
            <Button asChild variant="outline">
              <Link href="/providers">Connect a provider</Link>
            </Button>
          }
        />
      </PageShell>
    );
  }

  return (
    <PageShell className="bg-[radial-gradient(circle_at_top_right,rgba(8,122,61,0.055),transparent_34rem)]">
      <PerformanceLabMasthead />

      <InsightHero data={data} />

      <ConnectedMetricBar
        label="Connected performance evidence"
        className="rounded-2xl"
        metrics={[
          {
            label: "Trusted shots",
            value: data.trustedShots.toLocaleString("en-GB"),
            detail: data.dateRange,
          },
          {
            label: "Useful sessions",
            value: data.usefulSessions.toLocaleString("en-GB"),
            detail: "Sessions contributing trusted evidence",
          },
          {
            label: "Bag confidence",
            value: `${data.coveredClubs}/${data.clubCount}`,
            detail: `${data.bagCoveragePercent}% of active clubs evidenced`,
          },
          {
            label: "Data health",
            value: data.dataHealth.label,
            detail: data.dataHealth.detail,
          },
        ]}
      />

      <Tabs defaultValue="overview" className="grid min-w-0 gap-5" data-analyse-workspace-tabs>
        <div className="flex min-w-0 flex-col gap-3 border-b border-border/70 pb-3 xl:flex-row xl:items-end xl:justify-between">
          <TabsList
            variant="line"
            aria-label="Analyse workspace"
            className="max-w-full justify-start gap-4 overflow-x-auto pb-1"
          >
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="compare">Compare</TabsTrigger>
            <TabsTrigger value="shots">Shots</TabsTrigger>
            <TabsTrigger value="conditions">Conditions</TabsTrigger>
            <TabsTrigger value="data-quality">Data Quality</TabsTrigger>
          </TabsList>
          <AppCommandContentTrigger label="Find an advanced analysis" className="w-full xl:w-72" />
        </div>

        <TabsContent value="overview" className="grid min-w-0 gap-5">
          <section
            className="grid min-w-0 gap-4 xl:grid-cols-12 xl:grid-rows-[minmax(16rem,1fr)_minmax(13rem,0.78fr)]"
            aria-label="Performance Lab analysis entry points"
          >
            <CompareFeature data={data} className="xl:col-span-7 xl:row-span-2" />
            <ShotPatternsFeature data={data} className="xl:col-span-5" />
            <ConditionsFeature data={data} className="xl:col-span-3" />
            <DataQualityFeature data={data} className="xl:col-span-2" />
          </section>
          <CommandCentreNote />
        </TabsContent>

        <TabsContent value="compare">
          <FocusedAnalysis
            eyebrow="Compare"
            title="Understand what changed"
            description="Put two matched sessions side by side, then check sample strength before you call the movement real."
            href="/analyse/compare"
            action="Open comparison lab"
            visual={<ComparisonGraphic comparison={data.comparison} expanded />}
          />
        </TabsContent>

        <TabsContent value="shots">
          <FocusedAnalysis
            eyebrow="Shot patterns"
            title="Find your real dispersion and miss"
            description={`${data.insight.clubLabel} is the clearest place to begin. Inspect the measured landing pattern without letting one outlier write the story.`}
            href={data.insight.shotsHref}
            action={`Inspect ${data.insight.clubLabel} shots`}
            visual={<DispersionGraphic insight={data.insight} expanded />}
          />
        </TabsContent>

        <TabsContent value="conditions">
          <FocusedAnalysis
            eyebrow="Conditions"
            title="See how environment changes your numbers"
            description="Separate recorded venue, weather and surface context before accepting a carry change as swing progress."
            href="/analyse/conditions"
            action="Open conditions analysis"
            visual={<ConditionTagCloud tags={data.conditionTags} expanded />}
          />
        </TabsContent>

        <TabsContent value="data-quality">
          <FocusedAnalysis
            eyebrow="Data quality"
            title="Know what evidence you can trust"
            description="See which confidence inputs are healthy, mixed or limited, then open the evidence workspace only when something needs attention."
            href="/analyse/workspace"
            action="Open evidence workspace"
            visual={<ConfidenceDistribution components={data.confidence.components} expanded />}
          />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

function PerformanceLabMasthead() {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <StatusPill tone="sky">Performance Lab</StatusPill>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Analyse
          </span>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          One clear read of the evidence, then the right place to investigate it.
        </p>
      </div>
    </header>
  );
}

function InsightHero({ data }: { data: AnalyseOverview }) {
  return (
    <section className="relative isolate overflow-hidden rounded-[1.75rem] border border-emerald-950/20 bg-[#0a2318] px-5 py-6 text-white shadow-[0_24px_70px_rgba(4,30,18,0.18)] sm:px-7 sm:py-7 lg:px-9 lg:py-8">
      <HeroFieldGraphic />
      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)] lg:items-end">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200/80">
            Current read
          </p>
          <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl">
            What does the data say?
          </h1>
          <div className="mt-8 max-w-4xl border-l-2 border-emerald-300/80 pl-4 sm:pl-5">
            <p className="text-xl font-semibold leading-tight text-balance sm:text-2xl lg:text-[2rem]">
              {data.insight.title}
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-50/72 sm:text-base">
              {data.insight.detail}
            </p>
          </div>
        </div>

        <div className="grid gap-4 rounded-2xl border border-white/12 bg-[#17372a] p-4 shadow-inner">
          <div className="grid grid-cols-2 gap-3">
            <HeroMetric label="Confidence" value={confidenceDisplayLabel(data.confidence.label)} />
            <HeroMetric label="Evidence" value={`${data.insight.evidenceCount} shots`} />
            <HeroMetric
              label="Affected area"
              value={data.insight.scoringArea}
              className="col-span-2"
            />
          </div>
          <Button
            asChild
            className="min-h-11 bg-white text-emerald-950 shadow-none hover:bg-emerald-50"
          >
            <Link href={data.insight.shotsHref}>
              {data.insight.actionLabel}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
          <AnalyseProvenancePanel
            trustedShots={data.trustedShots}
            sessions={data.sessionCount}
            usefulSessions={data.usefulSessions}
            activeClubs={data.clubCount}
            coveredClubs={data.coveredClubs}
            excludedShots={data.excludedShots}
            dateRange={data.dateRange}
            explanation={confidenceExplanation(data.confidence.label)}
            components={data.confidence.components}
          />
        </div>
      </div>
    </section>
  );
}

function HeroMetric({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.15em] text-emerald-100/55">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function HeroFieldGraphic() {
  return (
    <svg
      className="pointer-events-none absolute inset-y-0 right-0 h-full w-[62%] opacity-30"
      viewBox="0 0 700 360"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="analyse-field-fade" x1="0" x2="1">
          <stop offset="0" stopColor="white" stopOpacity="0" />
          <stop offset="1" stopColor="#6ee7b7" stopOpacity=".24" />
        </linearGradient>
      </defs>
      <path d="M700 55C540 90 390 170 270 360H700Z" fill="url(#analyse-field-fade)" />
      {[90, 150, 215, 280].map((y) => (
        <path
          key={y}
          d={`M260 ${y} C430 ${y - 70} 560 ${y - 55} 700 ${y - 35}`}
          fill="none"
          stroke="white"
          strokeOpacity=".16"
        />
      ))}
      <path
        d="M522 330C525 235 555 150 630 55"
        fill="none"
        stroke="#6ee7b7"
        strokeOpacity=".55"
        strokeWidth="2"
        strokeDasharray="6 8"
      />
      <circle cx="630" cy="55" r="6" fill="#a7f3d0" />
    </svg>
  );
}

function CompareFeature({ data, className }: { data: AnalyseOverview; className?: string }) {
  return (
    <Link
      href="/analyse/compare"
      className={`group focus-aaa relative flex min-h-[27rem] flex-col overflow-hidden rounded-[1.5rem] bg-foreground p-5 text-background shadow-sm outline-none transition-transform duration-200 hover:-translate-y-0.5 motion-reduce:transition-none sm:p-7 ${className ?? ""}`}
    >
      <FeatureHeading
        icon={<BarChart3 className="size-4" aria-hidden />}
        eyebrow="Compare"
        title="Understand what changed"
        inverse
      />
      <p className="mt-3 max-w-md text-sm leading-6 text-background/65">
        Put like-for-like sessions beside each other, then judge the movement against the evidence.
      </p>
      <div className="my-auto py-7">
        <ComparisonGraphic comparison={data.comparison} />
      </div>
      <FeatureAction inverse>Open comparison lab</FeatureAction>
    </Link>
  );
}

function ShotPatternsFeature({ data, className }: { data: AnalyseOverview; className?: string }) {
  return (
    <Link
      href={data.insight.shotsHref}
      className={`group focus-aaa relative grid min-h-64 overflow-hidden rounded-[1.5rem] border border-emerald-950/15 bg-[#e9f2e8] p-5 text-emerald-950 outline-none transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lg motion-reduce:transition-none dark:bg-emerald-950 dark:text-emerald-50 sm:grid-cols-[minmax(0,0.9fr)_minmax(12rem,1.1fr)] sm:p-6 ${className ?? ""}`}
    >
      <div className="relative z-10 flex flex-col">
        <FeatureHeading
          icon={<Crosshair className="size-4" aria-hidden />}
          eyebrow="Shot patterns"
          title="Find your real dispersion and miss"
        />
        <p className="mt-3 text-sm leading-6 text-emerald-950/65 dark:text-emerald-100/65">
          Start with {data.insight.clubLabel}: {data.insight.evidenceCount} trusted shots shape this
          pattern.
        </p>
        <FeatureAction className="mt-auto pt-6">Inspect the pattern</FeatureAction>
      </div>
      <DispersionGraphic insight={data.insight} />
    </Link>
  );
}

function ConditionsFeature({ data, className }: { data: AnalyseOverview; className?: string }) {
  return (
    <Link
      href="/analyse/conditions"
      className={`group focus-aaa flex min-h-52 flex-col rounded-[1.5rem] border border-border bg-card p-5 outline-none transition-colors hover:border-primary/35 sm:p-6 ${className ?? ""}`}
    >
      <FeatureHeading
        icon={<CloudSun className="size-4" aria-hidden />}
        eyebrow="Conditions"
        title="See how environment changes your numbers"
      />
      <ConditionTagCloud tags={data.conditionTags} />
      <FeatureAction className="mt-auto pt-5">Separate the conditions</FeatureAction>
    </Link>
  );
}

function DataQualityFeature({ data, className }: { data: AnalyseOverview; className?: string }) {
  return (
    <Link
      href="/analyse/workspace"
      className={`group focus-aaa flex min-h-52 flex-col overflow-hidden rounded-[1.5rem] border border-border bg-muted/35 p-4 outline-none transition-colors hover:border-primary/35 ${className ?? ""}`}
    >
      <FeatureHeading
        icon={<ShieldCheck className="size-4" aria-hidden />}
        eyebrow="Data quality"
        title="Know what evidence you can trust"
        compact
      />
      <ConfidenceDistribution components={data.confidence.components} />
      <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-xs font-semibold">
        <span>{data.dataHealth.label}</span>
        <ArrowRight
          className="size-4 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </div>
    </Link>
  );
}

function FeatureHeading({
  icon,
  eyebrow,
  title,
  inverse = false,
  compact = false,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  inverse?: boolean;
  compact?: boolean;
}) {
  return (
    <div>
      <div
        className={`flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.17em] ${inverse ? "text-background/55" : "text-muted-foreground"}`}
      >
        {icon}
        {eyebrow}
      </div>
      <h2
        className={`mt-2 font-heading font-semibold leading-tight text-balance ${compact ? "text-lg" : "text-2xl"}`}
      >
        {title}
      </h2>
    </div>
  );
}

function FeatureAction({
  children,
  inverse = false,
  className = "",
}: {
  children: React.ReactNode;
  inverse?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-2 text-sm font-semibold ${inverse ? "text-background" : "text-foreground"} ${className}`}
    >
      <span>{children}</span>
      <ArrowRight
        className="size-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none"
        aria-hidden
      />
    </div>
  );
}

function ComparisonGraphic({
  comparison,
  expanded = false,
}: {
  comparison: AnalyseOverview["comparison"];
  expanded?: boolean;
}) {
  const maximum = Math.max(...comparison.map((row) => row.carryYd ?? 0), 1);
  return (
    <div className={`grid gap-5 ${expanded ? "mx-auto w-full max-w-4xl py-8" : ""}`}>
      <div className="flex items-end justify-between gap-4 border-b border-current/15 pb-2 text-xs uppercase tracking-[0.13em] opacity-60">
        <span>Average carry</span>
        <span>Matched club · {comparison[0]?.clubLabel ?? "Current focus"}</span>
      </div>
      {comparison.map((row, index) => (
        <div
          key={`${row.label}-${index}`}
          className="grid grid-cols-[5.5rem_minmax(0,1fr)_3.5rem] items-center gap-3"
        >
          <span className="text-xs font-semibold uppercase tracking-[0.11em] opacity-65">
            {row.label}
          </span>
          <div className="h-9 overflow-hidden rounded-sm bg-current/10 p-1">
            <div
              className={`h-full rounded-[2px] ${index === 0 ? "bg-emerald-400" : "bg-current/40"}`}
              style={{ width: `${Math.max(18, ((row.carryYd ?? 0) / maximum) * 100)}%` }}
            />
          </div>
          <span className="text-right font-semibold tabular-nums">
            {row.carryYd === null ? "—" : `${Math.round(row.carryYd)} yd`}
          </span>
        </div>
      ))}
      <div className="grid grid-cols-2 gap-3 border-t border-current/15 pt-4 text-xs opacity-70">
        {comparison.map((row, index) => (
          <p key={`${row.label}-detail-${index}`}>
            <span className="font-semibold">{row.label}:</span> {row.shotCount} shots ·{" "}
            {formatYards(row.avgAbsSideYd)} average offline
          </p>
        ))}
      </div>
    </div>
  );
}

function DispersionGraphic({
  insight,
  expanded = false,
}: {
  insight: AnalyseOverview["insight"];
  expanded?: boolean;
}) {
  const direction = insight.meanSideYd < 0 ? -1 : 1;
  const points = [
    [46, 64],
    [55, 46],
    [43, 38],
    [62, 57],
    [50, 72],
    [67, 40],
    [37, 52],
  ].map(([x, y]) => [x + direction * Math.min(12, Math.abs(insight.meanSideYd)), y]);

  return (
    <div
      className={`relative min-h-44 ${expanded ? "mx-auto aspect-[16/7] w-full max-w-4xl" : "self-stretch"}`}
    >
      <svg
        className="absolute inset-0 size-full"
        viewBox="0 0 120 100"
        role="img"
        aria-label={`${insight.clubLabel} miniature dispersion preview`}
      >
        <path d="M60 96V5" stroke="currentColor" strokeOpacity=".22" strokeDasharray="2 3" />
        <path
          d="M22 88C27 58 39 27 60 7C81 27 93 58 98 88"
          fill="none"
          stroke="currentColor"
          strokeOpacity=".14"
        />
        <ellipse
          cx={60 + direction * Math.min(12, Math.abs(insight.meanSideYd))}
          cy="53"
          rx="27"
          ry="34"
          fill="none"
          stroke="currentColor"
          strokeOpacity=".42"
          strokeWidth="1.4"
        />
        <ellipse
          cx={60 + direction * Math.min(12, Math.abs(insight.meanSideYd))}
          cy="53"
          rx="15"
          ry="21"
          fill="currentColor"
          fillOpacity=".08"
          stroke="currentColor"
          strokeOpacity=".28"
        />
        {points.map(([x, y], index) => (
          <circle
            key={index}
            cx={x}
            cy={y}
            r="2.2"
            fill="currentColor"
            opacity={index === 1 ? ".95" : ".62"}
          />
        ))}
        <circle cx="60" cy="93" r="2" fill="currentColor" opacity=".5" />
      </svg>
      <div className="absolute right-0 bottom-0 rounded-full bg-white/72 px-2.5 py-1 text-[0.68rem] font-semibold text-emerald-950 shadow-sm backdrop-blur dark:bg-emerald-50/90">
        {insight.missLabel}
      </div>
    </div>
  );
}

function ConditionTagCloud({ tags, expanded = false }: { tags: string[]; expanded?: boolean }) {
  return (
    <div
      className={`flex flex-wrap content-start gap-2 ${expanded ? "mx-auto max-w-4xl justify-center py-14" : "mt-5"}`}
    >
      {tags.map((tag, index) => (
        <span
          key={tag}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${index === 0 ? "border-primary/30 bg-primary/8 text-primary" : "border-border bg-background/70 text-muted-foreground"} ${expanded ? "px-4 py-2 text-sm" : ""}`}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

function ConfidenceDistribution({
  components,
  expanded = false,
}: {
  components: AnalyseOverview["confidence"]["components"];
  expanded?: boolean;
}) {
  const counts = {
    healthy: components.filter((item) => item.assessment === "healthy").length,
    mixed: components.filter((item) => item.assessment === "mixed").length,
    limited: components.filter((item) => item.assessment === "limited").length,
  };
  return (
    <div className={expanded ? "mx-auto grid w-full max-w-4xl gap-5 py-10" : "mt-5 grid gap-3"}>
      <div
        className="flex h-2.5 overflow-hidden rounded-full bg-border/50"
        aria-label={`${counts.healthy} healthy, ${counts.mixed} mixed and ${counts.limited} limited confidence inputs`}
      >
        {components.map((item) => (
          <span
            key={item.key}
            className={
              item.assessment === "healthy"
                ? "bg-emerald-500"
                : item.assessment === "mixed"
                  ? "bg-amber-400"
                  : "bg-rose-400"
            }
            style={{ width: `${100 / components.length}%` }}
          />
        ))}
      </div>
      <div className={`grid gap-2 text-xs ${expanded ? "sm:grid-cols-3" : ""}`}>
        <ConfidenceCount label="Healthy" value={counts.healthy} dot="bg-emerald-500" />
        <ConfidenceCount label="Mixed" value={counts.mixed} dot="bg-amber-400" />
        <ConfidenceCount label="Limited" value={counts.limited} dot="bg-rose-400" />
      </div>
      {expanded ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {components.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between rounded-xl border bg-card px-3 py-2.5"
            >
              <span className="text-sm font-medium">{item.label}</span>
              <Badge variant="outline" className="capitalize">
                {item.assessment}
              </Badge>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ConfidenceCount({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <span className={`size-1.5 rounded-full ${dot}`} />
        {label}
      </span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function FocusedAnalysis({
  eyebrow,
  title,
  description,
  href,
  action,
  visual,
}: {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  action: string;
  visual: React.ReactNode;
}) {
  return (
    <section className="grid min-h-[28rem] overflow-hidden rounded-[1.5rem] border border-border bg-card lg:grid-cols-[minmax(18rem,0.7fr)_minmax(0,1.3fr)]">
      <div className="flex flex-col justify-between gap-8 border-b border-border bg-muted/25 p-6 lg:border-r lg:border-b-0 lg:p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {eyebrow}
          </p>
          <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-balance">
            {title}
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        <Button asChild className="min-h-11 w-fit">
          <Link href={href}>
            {action}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </div>
      <div className="grid min-h-64 place-items-center overflow-hidden p-5 sm:p-8">{visual}</div>
    </section>
  );
}

function CommandCentreNote() {
  return (
    <aside className="flex flex-col gap-3 rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-foreground text-background">
          <Command className="size-4" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-semibold">Advanced tools stay in the command centre</p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            Search snapshots, session impact, progress and coaching actions without turning Analyse
            into a route directory.
          </p>
        </div>
      </div>
      <AppCommandContentTrigger label="Search analysis tools" className="w-full shrink-0 sm:w-64" />
    </aside>
  );
}

async function getAnalyseOverview() {
  const userId = await requireCurrentUserId();
  const db = getDb();
  const excludedQualityValues = sql.join(
    excludedRecordQualityTags.map((tag) => sql`${tag}`),
    sql`, `,
  );
  const excludedCategoryValues = sql.join(
    excludedRecordShotCategories.map((category) => sql`${category}`),
    sql`, `,
  );
  const trustedWhere = and(
    eq(shots.userId, userId),
    eq(sessions.userId, userId),
    sql`lower(coalesce(${shots.qualityTag}, '')) not in (${excludedQualityValues})`,
    sql`lower(coalesce(${shots.shotCategory}, '')) not in (${excludedCategoryValues})`,
    sql`lower(${sessions.source}) not in ('manual', 'manual_edit')`,
  );

  const [shotCounts, sessionCounts, clubCounts, latestSessions, clubPatterns] = await Promise.all([
    db
      .select({
        total: count(shots.id),
        trusted: sql<number>`count(*) filter (where lower(coalesce(${shots.qualityTag}, '')) not in (${excludedQualityValues}) and lower(coalesce(${shots.shotCategory}, '')) not in (${excludedCategoryValues}) and lower(${sessions.source}) not in ('manual', 'manual_edit'))::int`,
        usefulSessions: sql<number>`count(distinct ${shots.sessionId}) filter (where lower(coalesce(${shots.qualityTag}, '')) not in (${excludedQualityValues}) and lower(coalesce(${shots.shotCategory}, '')) not in (${excludedCategoryValues}) and lower(${sessions.source}) not in ('manual', 'manual_edit'))::int`,
        complete: sql<number>`count(*) filter (where ${shots.carryYd} is not null and ${shots.sideCarryYd} is not null)::int`,
        carryCv: sql<
          number | null
        >`(stddev_samp(${shots.carryYd}) / nullif(abs(avg(${shots.carryYd})), 0))::float`,
      })
      .from(shots)
      .innerJoin(sessions, eq(shots.sessionId, sessions.id))
      .where(and(eq(shots.userId, userId), eq(sessions.userId, userId))),
    db
      .select({ total: count(sessions.id), earliest: sql<Date | null>`min(${sessions.date})` })
      .from(sessions)
      .where(eq(sessions.userId, userId)),
    db
      .select({ total: count(clubs.id) })
      .from(clubs)
      .where(and(eq(clubs.userId, userId), eq(clubs.active, true))),
    db
      .select({
        id: sessions.id,
        date: sessions.date,
        playContext: sessions.playContext,
        weather: sessions.weatherJson,
      })
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .orderBy(desc(sessions.date))
      .limit(8),
    db
      .select({
        clubId: clubs.id,
        clubType: clubs.type,
        shotCount: sql<number>`count(*)::int`,
        sessionCount: sql<number>`count(distinct ${shots.sessionId})::int`,
        meanCarryYd: sql<number | null>`avg(${shots.carryYd})::float`,
        meanSideYd: sql<number | null>`avg(${shots.sideCarryYd})::float`,
        meanAbsSideYd: sql<number | null>`avg(abs(${shots.sideCarryYd}))::float`,
        sideSpreadYd: sql<number | null>`stddev_samp(${shots.sideCarryYd})::float`,
      })
      .from(shots)
      .innerJoin(sessions, eq(shots.sessionId, sessions.id))
      .innerJoin(clubs, eq(shots.clubId, clubs.id))
      .where(and(trustedWhere, eq(clubs.active, true)))
      .groupBy(clubs.id, clubs.type),
  ]);

  const totalShots = Number(shotCounts[0]?.total ?? 0);
  const trustedShots = Number(shotCounts[0]?.trusted ?? 0);
  const usefulSessions = Number(shotCounts[0]?.usefulSessions ?? 0);
  const sessionCount = Number(sessionCounts[0]?.total ?? 0);
  const clubCount = Number(clubCounts[0]?.total ?? 0);
  const latestSessionDate = validSessionDate(latestSessions[0]?.date);
  const confidence = analysisConfidence({
    sampleSize: trustedShots,
    sessionCount: usefulSessions,
    recencyDays: latestSessionDate
      ? Math.max(0, (Date.now() - latestSessionDate.getTime()) / 86_400_000)
      : null,
    outlierRate: totalShots ? Math.max(0, totalShots - trustedShots) / totalShots : 1,
    metricCompleteness: totalShots ? Number(shotCounts[0]?.complete ?? 0) / totalShots : 0,
    coefficientOfVariation:
      shotCounts[0]?.carryCv == null ? null : Math.abs(Number(shotCounts[0].carryCv)),
    crossSessionConsistency: null,
  });

  const strongestPattern = [...clubPatterns]
    .filter((row) => Number(row.shotCount) >= 5 && row.meanAbsSideYd !== null)
    .sort((left, right) => Number(right.meanAbsSideYd ?? 0) - Number(left.meanAbsSideYd ?? 0))[0];
  const coveredClubs = clubPatterns.filter((row) => Number(row.shotCount) >= 5).length;
  const insight = buildInsight(strongestPattern, confidence.label, trustedShots);

  const comparisonRows = strongestPattern
    ? await db
        .select({
          date: sessions.date,
          carryYd: sql<number | null>`avg(${shots.carryYd})::float`,
          avgAbsSideYd: sql<number | null>`avg(abs(${shots.sideCarryYd}))::float`,
          shotCount: sql<number>`count(*)::int`,
        })
        .from(shots)
        .innerJoin(sessions, eq(shots.sessionId, sessions.id))
        .where(and(trustedWhere, eq(shots.clubId, strongestPattern.clubId)))
        .groupBy(sessions.id, sessions.date)
        .orderBy(desc(sessions.date))
        .limit(2)
    : [];

  const comparison = [0, 1].map((index) => {
    const row = comparisonRows[index];
    return {
      label: index === 0 ? "Latest" : "Previous",
      clubLabel: insight.clubLabel,
      carryYd: row?.carryYd == null ? null : Number(row.carryYd),
      avgAbsSideYd: row?.avgAbsSideYd == null ? null : Number(row.avgAbsSideYd),
      shotCount: Number(row?.shotCount ?? 0),
    };
  });
  const excludedShots = Math.max(0, totalShots - trustedShots);
  const excludedRate = totalShots ? excludedShots / totalShots : 1;

  return {
    totalShots,
    trustedShots,
    excludedShots,
    usefulSessions,
    sessionCount,
    clubCount,
    coveredClubs,
    bagCoveragePercent: clubCount ? Math.min(100, Math.round((coveredClubs / clubCount) * 100)) : 0,
    latestSessionId: latestSessions[0]?.id ?? null,
    dateRange: formatSessionDateRange(sessionCounts[0]?.earliest ?? null, latestSessionDate),
    confidence,
    insight,
    comparison,
    conditionTags: buildConditionTags(latestSessions),
    dataHealth:
      excludedRate <= 0.05
        ? {
            label: "Healthy",
            detail: excludedShots
              ? `${excludedShots} rows held outside analysis`
              : "No rows currently excluded",
          }
        : excludedRate <= 0.12
          ? { label: "Monitor", detail: `${excludedShots} rows held outside analysis` }
          : { label: "Needs review", detail: `${excludedShots} rows held outside analysis` },
  };
}

type AnalyseOverview = Awaited<ReturnType<typeof getAnalyseOverview>>;

function buildInsight(
  pattern:
    | {
        clubId: string;
        clubType: string;
        shotCount: number;
        meanSideYd: number | null;
        meanAbsSideYd: number | null;
      }
    | undefined,
  confidence: AnalysisConfidenceLabel,
  trustedShots: number,
) {
  if (!pattern) {
    return {
      clubLabel: "Bag",
      title: confidenceHeadline(confidence),
      detail: confidenceExplanation(confidence),
      evidenceCount: trustedShots,
      scoringArea: "Evidence coverage",
      actionLabel: "Review latest evidence",
      shotsHref: "/today",
      meanSideYd: 0,
      missLabel: "Pattern still forming",
    };
  }

  const clubLabel = formatClubType(pattern.clubType);
  const meanSideYd = Number(pattern.meanSideYd ?? 0);
  const meanAbsSideYd = Number(pattern.meanAbsSideYd ?? 0);
  const directional = Math.abs(meanSideYd) >= 2;
  const direction = meanSideYd < 0 ? "left" : "right";

  return {
    clubLabel,
    title: directional
      ? `${clubLabel} has the clearest current ${direction} pattern`
      : `${clubLabel} has the widest active dispersion`,
    detail: directional
      ? `${Number(pattern.shotCount)} trusted shots finish ${Math.abs(meanSideYd).toFixed(1)} yd ${direction} on average and ${meanAbsSideYd.toFixed(1)} yd offline. Start here before changing the whole bag.`
      : `${Number(pattern.shotCount)} trusted shots finish ${meanAbsSideYd.toFixed(1)} yd offline on average without one dominant side. Tighten the window before chasing a directional fix.`,
    evidenceCount: Number(pattern.shotCount),
    scoringArea: scoringArea(pattern.clubType),
    actionLabel: `Inspect ${clubLabel} pattern`,
    shotsHref: `/shots?clubId=${pattern.clubId}`,
    meanSideYd,
    missLabel: directional
      ? `${Math.abs(meanSideYd).toFixed(1)} yd ${direction} bias`
      : `${meanAbsSideYd.toFixed(1)} yd average miss`,
  };
}

function scoringArea(clubType: string) {
  if (clubType === "driver" || /[wh]$/.test(clubType)) return "Tee-shot control";
  if (/i$/.test(clubType)) return "Approach dispersion";
  if (["pw", "gw", "aw", "sw", "lw", "wedge"].includes(clubType)) return "Scoring-zone control";
  return "Shot pattern";
}

function buildConditionTags(
  rows: Array<{
    playContext: string;
    weather: { conditions?: string | null; wind?: string | null; temperature?: string | null };
  }>,
) {
  const values = rows.flatMap((row) => [
    formatContext(row.playContext),
    row.weather?.conditions?.trim() || null,
    row.weather?.wind?.trim() || null,
    row.weather?.temperature?.trim() || null,
  ]);
  const tags = [...new Set(values.filter((value): value is string => Boolean(value)))].slice(0, 5);
  return tags.length ? tags : ["Context not recorded", "Weather coverage limited"];
}

function formatContext(value: string) {
  if (!value || value === "unknown") return null;
  return value
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function confidenceExplanation(confidence: AnalysisConfidenceLabel) {
  return confidence === "strong"
    ? "The sample is recent, complete and broad enough to support repeatable comparisons."
    : confidence === "reliable"
      ? "The sample can support decisions, but club and context coverage should still be checked."
      : confidence === "developing"
        ? "A pattern is visible, but another measured session would reduce the risk of reacting to noise."
        : "There is not enough recent, trusted evidence to make a reliable change claim yet.";
}

function confidenceHeadline(confidence: AnalysisConfidenceLabel) {
  return confidence === "early"
    ? "Build the evidence before making a swing-change claim"
    : confidence === "developing"
      ? "Patterns are emerging; verify them across another session"
      : confidence === "reliable"
        ? "There is enough evidence for club-level trend decisions"
        : "Your history can support strong, repeatable comparisons";
}

function formatYards(value: number | null) {
  return value === null ? "—" : `${Number(value).toFixed(1)} yd`;
}
