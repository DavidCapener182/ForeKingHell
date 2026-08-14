"use client";

import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { StatusPill, type Tone } from "@/components/premium";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { CompareDelta, CompareSampleSummary, DispersionPoint } from "@/lib/compare-data";

type ComparisonView = "overlay" | "side-by-side" | "delta";

type StageMetric = {
  key: keyof CompareDelta;
  label: string;
  value: number | null;
  unit: "yd" | "mph" | "deg" | "points";
  direction: "better" | "worse" | "mixed" | "unavailable";
  confidence: string;
};

const numberFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

export function SessionComparisonStage({
  focus,
  baseline,
  delta,
  metrics,
  confidenceLabel,
}: {
  focus: CompareSampleSummary;
  baseline: CompareSampleSummary;
  delta: CompareDelta;
  metrics: StageMetric[];
  confidenceLabel: string;
}) {
  const [view, setView] = useState<ComparisonView>("side-by-side");
  const domain = useMemo(
    () => chartDomain(focus.dispersion, baseline.dispersion),
    [focus, baseline],
  );

  return (
    <section
      className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm"
      aria-labelledby="comparison-stage-title"
      data-session-comparison-stage
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Shot pattern
          </p>
          <h2 id="comparison-stage-title" className="mt-0.5 text-lg font-semibold">
            Focus against baseline
          </h2>
        </div>
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(value) => value && setView(value as ComparisonView)}
          variant="outline"
          spacing={0}
          aria-label="Comparison chart view"
          className="max-w-full overflow-x-auto"
        >
          <ToggleGroupItem value="overlay">Overlay</ToggleGroupItem>
          <ToggleGroupItem value="side-by-side">Side-by-side</ToggleGroupItem>
          <ToggleGroupItem value="delta">Delta</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="grid border-b border-border/70 md:grid-cols-2">
        <SampleHeader side="Focus" sample={focus} confidenceLabel={confidenceLabel} tone="focus" />
        <SampleHeader
          side="Baseline"
          sample={baseline}
          confidenceLabel={confidenceLabel}
          tone="baseline"
          className="border-t border-border/70 md:border-l md:border-t-0"
        />
      </div>

      <div className="min-h-[25rem] bg-muted/15 p-3 sm:p-4">
        {view === "side-by-side" ? (
          <div className="grid gap-3 xl:grid-cols-2">
            <SamplePlot
              label="Focus"
              sample={focus}
              domain={domain}
              colour="var(--foreground, #172017)"
            />
            <SamplePlot
              label="Baseline"
              sample={baseline}
              domain={domain}
              colour="var(--chart-comparison, #1555d6)"
            />
          </div>
        ) : null}

        {view === "overlay" ? (
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.65fr)_minmax(17rem,0.65fr)]">
            <OverlayPlot focus={focus} baseline={baseline} domain={domain} />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <CarryDistribution
                label="Focus carry"
                points={focus.dispersion}
                domain={domain}
                colour="var(--foreground, #172017)"
              />
              <CarryDistribution
                label="Baseline carry"
                points={baseline.dispersion}
                domain={domain}
                colour="var(--chart-comparison, #1555d6)"
              />
            </div>
          </div>
        ) : null}

        {view === "delta" ? <DeltaView metrics={metrics} delta={delta} /> : null}
      </div>

      <p className="border-t border-border/70 px-4 py-2.5 text-xs leading-5 text-muted-foreground">
        Plotted points use trusted stock shots with recorded carry and side carry. Exact values and
        confidence sit in the comparison table below.
      </p>
    </section>
  );
}

function SampleHeader({
  side,
  sample,
  confidenceLabel,
  tone,
  className = "",
}: {
  side: string;
  sample: CompareSampleSummary;
  confidenceLabel: string;
  tone: "focus" | "baseline";
  className?: string;
}) {
  return (
    <div className={`min-w-0 px-4 py-3 ${className}`}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{
                background:
                  tone === "focus"
                    ? "var(--foreground, #172017)"
                    : "var(--chart-comparison, #1555d6)",
              }}
              aria-hidden
            />
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {side}
            </p>
          </div>
          <p className="mt-1 truncate text-base font-semibold" title={sample.label}>
            {sample.label}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground" title={sample.detail}>
            {sample.detail}
          </p>
        </div>
        <StatusPill tone={sample.stockShots >= 10 ? "slate" : "amber"}>
          {sample.stockShots} shots
        </StatusPill>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
        <span>
          <span className="text-muted-foreground">Direction </span>
          <strong>{sample.primaryMiss}</strong>
        </span>
        <span>
          <span className="text-muted-foreground">Carry </span>
          <strong>{formatMetric(sample.carryMedianYd, "yd")}</strong>
        </span>
        <span>
          <span className="text-muted-foreground">Confidence </span>
          <strong>{confidenceLabel}</strong>
        </span>
      </div>
    </div>
  );
}

function SamplePlot({
  label,
  sample,
  domain,
  colour,
}: {
  label: string;
  sample: CompareSampleSummary;
  domain: ChartDomain;
  colour: string;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-card p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{label} dispersion</p>
        <p className="text-xs text-muted-foreground">{sample.dispersion.length} plotted</p>
      </div>
      <ShotPlot
        samples={[{ label, points: sample.dispersion, colour, opacity: 0.78 }]}
        domain={domain}
        ariaLabel={`${label} dispersion. ${sample.dispersion.length} shots plotted; median carry ${formatMetric(sample.carryMedianYd, "yards")}; primary miss ${sample.primaryMiss}.`}
      />
      <CarryDistribution
        label="Carry distribution"
        points={sample.dispersion}
        domain={domain}
        colour={colour}
        compact
      />
    </div>
  );
}

function OverlayPlot({
  focus,
  baseline,
  domain,
}: {
  focus: CompareSampleSummary;
  baseline: CompareSampleSummary;
  domain: ChartDomain;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold">Dispersion overlay</p>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <ChartKey colour="var(--foreground, #172017)" label="Focus" />
          <ChartKey colour="var(--chart-comparison, #1555d6)" label="Baseline" />
        </div>
      </div>
      <ShotPlot
        samples={[
          {
            label: "Baseline",
            points: baseline.dispersion,
            colour: "var(--chart-comparison, #1555d6)",
            opacity: 0.48,
          },
          {
            label: "Focus",
            points: focus.dispersion,
            colour: "var(--foreground, #172017)",
            opacity: 0.82,
          },
        ]}
        domain={domain}
        large
        ariaLabel={`Dispersion overlay with ${focus.dispersion.length} focus shots and ${baseline.dispersion.length} baseline shots.`}
      />
    </div>
  );
}

function ShotPlot({
  samples,
  domain,
  ariaLabel,
  large = false,
}: {
  samples: Array<{
    label: string;
    points: DispersionPoint[];
    colour: string;
    opacity: number;
  }>;
  domain: ChartDomain;
  ariaLabel: string;
  large?: boolean;
}) {
  const width = large ? 900 : 620;
  const height = large ? 430 : 330;
  const left = 48;
  const right = width - 24;
  const top = 28;
  const bottom = height - 38;
  const x = (value: number) =>
    left + ((value + domain.maxSide) / (domain.maxSide * 2 || 1)) * (right - left);
  const y = (value: number) =>
    bottom -
    ((value - domain.minCarry) / (domain.maxCarry - domain.minCarry || 1)) * (bottom - top);
  const centre = x(0);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
      className={large ? "mt-2 aspect-[2.08/1] w-full" : "mt-2 aspect-[1.88/1] w-full"}
    >
      <rect
        x="0"
        y="0"
        width={width}
        height={height}
        rx="10"
        fill="var(--chart-plot-background, #f7f0df)"
      />
      {[0.25, 0.5, 0.75].map((ratio) => {
        const lineY = top + (bottom - top) * ratio;
        return (
          <line
            key={ratio}
            x1={left}
            x2={right}
            y1={lineY}
            y2={lineY}
            stroke="var(--chart-grid, #cbbd9f)"
            strokeOpacity="0.7"
          />
        );
      })}
      <line
        x1={centre}
        x2={centre}
        y1={top}
        y2={bottom}
        stroke="var(--chart-grid-strong, #ad9b77)"
        strokeDasharray="6 6"
      />
      <line
        x1={left}
        x2={right}
        y1={bottom}
        y2={bottom}
        stroke="var(--chart-axis, #667085)"
        strokeOpacity="0.7"
      />
      <text x={centre} y="18" textAnchor="middle" fill="var(--chart-axis, #667085)" fontSize="12">
        Target line
      </text>
      <text x={left} y={height - 14} fill="var(--chart-axis, #667085)" fontSize="12">
        Left
      </text>
      <text
        x={right}
        y={height - 14}
        textAnchor="end"
        fill="var(--chart-axis, #667085)"
        fontSize="12"
      >
        Right
      </text>
      <text x={left + 6} y={top + 14} fill="var(--chart-axis, #667085)" fontSize="12">
        {numberFormatter.format(domain.maxCarry)} yd
      </text>
      {samples.flatMap((sample) =>
        sample.points.map((point) => (
          <circle
            key={`${sample.label}-${point.id}`}
            cx={x(point.sideCarryYd)}
            cy={y(point.carryYd)}
            r={sample.label === "Focus" ? 5 : 4.5}
            fill={sample.colour}
            fillOpacity={sample.opacity}
            stroke="var(--card)"
            strokeWidth="1"
          />
        )),
      )}
    </svg>
  );
}

function CarryDistribution({
  label,
  points,
  domain,
  colour,
  compact = false,
}: {
  label: string;
  points: DispersionPoint[];
  domain: ChartDomain;
  colour: string;
  compact?: boolean;
}) {
  const bins = distributionBins(points, domain, 9);
  const max = Math.max(1, ...bins.map((bin) => bin.count));

  return (
    <div
      className={
        compact
          ? "mt-2 border-t border-border/60 pt-2"
          : "rounded-lg border border-border/70 bg-card p-3"
      }
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold">{label}</p>
        <p className="text-[11px] text-muted-foreground">
          {numberFormatter.format(domain.minCarry)}–{numberFormatter.format(domain.maxCarry)} yd
        </p>
      </div>
      <div
        className={`mt-2 flex items-end gap-1 ${compact ? "h-12" : "h-28"}`}
        role="img"
        aria-label={`${label}: ${points.length} carry values distributed from ${numberFormatter.format(domain.minCarry)} to ${numberFormatter.format(domain.maxCarry)} yards.`}
      >
        {bins.map((bin) => (
          <span
            key={bin.start}
            className="min-w-0 flex-1 rounded-t-sm"
            style={{
              height: `${Math.max(bin.count > 0 ? 8 : 2, (bin.count / max) * 100)}%`,
              background: colour,
              opacity: bin.count > 0 ? 0.74 : 0.12,
            }}
            title={`${numberFormatter.format(bin.start)}–${numberFormatter.format(bin.end)} yd: ${bin.count} shots`}
          />
        ))}
      </div>
    </div>
  );
}

function DeltaView({ metrics, delta }: { metrics: StageMetric[]; delta: CompareDelta }) {
  const visibleMetrics = metrics.filter((metric) => metric.key !== "launchDeltaDeg");

  return (
    <div className="rounded-lg border border-border/70 bg-card">
      <div className="grid grid-cols-[minmax(8rem,1fr)_auto] gap-3 border-b border-border/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground sm:grid-cols-[minmax(10rem,1fr)_minmax(15rem,2fr)_auto]">
        <span>Signal</span>
        <span className="hidden text-center sm:block">Baseline ← change → Focus</span>
        <span>Result</span>
      </div>
      <div className="divide-y divide-border/60">
        {visibleMetrics.map((metric) => (
          <DeltaRow key={metric.key} metric={metric} />
        ))}
      </div>
      {Object.values(delta).every((value) => value === null) ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          There is not enough comparable data to calculate deltas.
        </p>
      ) : null}
    </div>
  );
}

function DeltaRow({ metric }: { metric: StageMetric }) {
  const amount = Math.min(100, metricMagnitude(metric));
  const tone = metricTone(metric);
  const positive = metric.direction === "better";
  const negative = metric.direction === "worse";
  const Icon = positive ? ArrowUpRight : negative ? ArrowDownRight : Minus;

  return (
    <div className="grid grid-cols-[minmax(8rem,1fr)_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[minmax(10rem,1fr)_minmax(15rem,2fr)_auto]">
      <div>
        <p className="font-semibold">{metric.label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{metric.confidence}</p>
      </div>
      <div className="relative hidden h-2 overflow-hidden rounded-full bg-muted sm:block">
        <span className="absolute inset-y-0 left-1/2 w-px bg-border" aria-hidden />
        {metric.value !== null && metric.direction !== "mixed" ? (
          <span
            className={deltaBarClass(tone)}
            style={{
              width: `${amount / 2}%`,
              left: positive ? "50%" : `${50 - amount / 2}%`,
            }}
          />
        ) : null}
      </div>
      <StatusPill tone={tone}>
        <Icon className="size-3.5" aria-hidden />
        {formatSignedMetric(metric.value, metric.unit)}
      </StatusPill>
    </div>
  );
}

function ChartKey({ colour, label }: { colour: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2 rounded-full" style={{ background: colour }} aria-hidden />
      {label}
    </span>
  );
}

type ChartDomain = { maxSide: number; minCarry: number; maxCarry: number };

function chartDomain(focus: DispersionPoint[], baseline: DispersionPoint[]): ChartDomain {
  const points = [...focus, ...baseline];
  if (points.length === 0) return { maxSide: 20, minCarry: 0, maxCarry: 200 };
  const carry = points.map((point) => point.carryYd);
  return {
    maxSide: Math.max(
      15,
      Math.ceil(Math.max(...points.map((point) => Math.abs(point.sideCarryYd))) / 5) * 5,
    ),
    minCarry: Math.max(0, Math.floor((Math.min(...carry) - 5) / 10) * 10),
    maxCarry: Math.ceil((Math.max(...carry) + 5) / 10) * 10,
  };
}

function distributionBins(points: DispersionPoint[], domain: ChartDomain, count: number) {
  const size = (domain.maxCarry - domain.minCarry) / count || 1;
  return Array.from({ length: count }, (_, index) => {
    const start = domain.minCarry + size * index;
    const end = start + size;
    return {
      start,
      end,
      count: points.filter(
        (point) =>
          point.carryYd >= start &&
          (index === count - 1 ? point.carryYd <= end : point.carryYd < end),
      ).length,
    };
  });
}

function metricMagnitude(metric: StageMetric) {
  if (metric.value === null) return 0;
  const scale =
    metric.unit === "points" ? 20 : metric.unit === "mph" ? 4 : metric.unit === "deg" ? 6 : 12;
  return (Math.abs(metric.value) / scale) * 100;
}

function metricTone(metric: StageMetric): Tone {
  if (metric.direction === "unavailable" || metric.direction === "mixed") return "slate";
  if (
    metric.confidence.toLowerCase().includes("early") ||
    metric.confidence.toLowerCase().includes("developing")
  ) {
    return "amber";
  }
  return metric.direction === "better" ? "green" : "pink";
}

function deltaBarClass(tone: Tone) {
  const base = "absolute inset-y-0 rounded-full";
  if (tone === "green") return `${base} bg-[var(--status-success-foreground)]`;
  if (tone === "pink") return `${base} bg-destructive`;
  if (tone === "amber") return `${base} bg-[var(--status-warning-foreground)]`;
  return `${base} bg-muted-foreground`;
}

function formatMetric(value: number | null, unit: string) {
  return value === null ? "Not available" : `${numberFormatter.format(value)} ${unit}`;
}

function formatSignedMetric(value: number | null, unit: StageMetric["unit"]) {
  if (value === null) return "N/A";
  const suffix = unit === "points" ? " pts" : ` ${unit}`;
  return `${value > 0 ? "+" : ""}${numberFormatter.format(value)}${suffix}`;
}
