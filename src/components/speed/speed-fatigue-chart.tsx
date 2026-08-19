import { AlertTriangle, CheckCircle2, Gauge } from "lucide-react";

import { ChartAccessibleFallback } from "@/components/app/chart-accessible-fallback";
import { StatusPill } from "@/components/premium";
import { analyseSpeedFatigueSwings, type SpeedFatigueAnalysis } from "@/lib/speed-development";

export type SpeedFatigueReading = {
  swingNumber: number;
  clubSpeedMph: number;
};

type ChartPoint = SpeedFatigueReading & {
  x: number;
  y: number;
};

const CHART_WIDTH = 900;
const CHART_HEIGHT = 260;
const CHART_LEFT = 52;
const CHART_RIGHT = 24;
const CHART_TOP = 28;
const CHART_BOTTOM = 42;

const speedFormatter = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function SpeedFatigueChart({ readings }: { readings: SpeedFatigueReading[] }) {
  const orderedReadings = [...readings]
    .filter((reading) => Number.isFinite(reading.clubSpeedMph))
    .sort((left, right) => left.swingNumber - right.swingNumber);
  const analysis = analyseSpeedFatigueSwings(orderedReadings);
  const chart = buildChart(orderedReadings, analysis.thresholdMph);
  const summary = fatigueSummary(orderedReadings, analysis);
  const peakSwingNumber = analysis.peakSwingNumber;
  const stopSwingNumber = analysis.stopAfterSwingNumber;

  return (
    <section
      className="grid min-w-0 gap-4 rounded-xl border border-border/70 bg-muted/30 p-4"
      aria-labelledby="speed-fatigue-chart-title"
      data-speed-fatigue-chart
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Gauge className="size-4 text-primary" aria-hidden="true" />
            <h3 id="speed-fatigue-chart-title" className="text-base font-semibold text-foreground">
              In-session speed fatigue
            </h3>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Every recorded swing against 96% of today’s peak. The stop rule needs two consecutive
            readings at or below the line.
          </p>
        </div>
        <StatusPill tone={fatigueTone(orderedReadings, analysis)}>
          {fatigueStatusLabel(orderedReadings, analysis)}
        </StatusPill>
      </header>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="grid min-w-0 gap-3">
          <div className="grid grid-cols-3 gap-2">
            <FatigueMetric
              label="Peak"
              value={formatSpeed(analysis.peakSpeedMph)}
              detail={peakSwingNumber === null ? "Swing not measured" : `Swing ${peakSwingNumber}`}
            />
            <FatigueMetric
              label="96% line"
              value={formatSpeed(analysis.thresholdMph)}
              detail="Four percent below peak"
            />
            <FatigueMetric
              label="Latest drop"
              value={formatPercent(analysis.dropFromPeakPercent)}
              detail="Against today’s peak"
            />
          </div>

          {chart ? (
            <div className="min-w-0 overflow-x-auto rounded-lg border border-border/70 bg-card p-2">
              <svg
                viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                className="h-64 min-w-[42rem] w-full"
                role="img"
                aria-label={summary}
                data-speed-fatigue-plot
              >
                <line
                  x1={CHART_LEFT}
                  x2={CHART_WIDTH - CHART_RIGHT}
                  y1={CHART_HEIGHT - CHART_BOTTOM}
                  y2={CHART_HEIGHT - CHART_BOTTOM}
                  stroke="var(--border)"
                />
                {[0, 0.5, 1].map((position) => {
                  const y = CHART_TOP + position * (CHART_HEIGHT - CHART_TOP - CHART_BOTTOM);
                  const value = chart.maxSpeed - position * (chart.maxSpeed - chart.minSpeed);

                  return (
                    <g key={position} aria-hidden="true">
                      <line
                        x1={CHART_LEFT}
                        x2={CHART_WIDTH - CHART_RIGHT}
                        y1={y}
                        y2={y}
                        stroke="var(--border)"
                        strokeDasharray="3 5"
                      />
                      <text
                        x={CHART_LEFT - 8}
                        y={y + 4}
                        fill="var(--muted-foreground)"
                        fontSize="11"
                        textAnchor="end"
                      >
                        {formatChartAxis(value)}
                      </text>
                    </g>
                  );
                })}

                {analysis.thresholdMph !== null ? (
                  <g aria-hidden="true">
                    <line
                      x1={CHART_LEFT}
                      x2={CHART_WIDTH - CHART_RIGHT}
                      y1={chart.thresholdY}
                      y2={chart.thresholdY}
                      stroke="var(--status-warning-foreground)"
                      strokeWidth="2"
                      strokeDasharray="8 6"
                    />
                    <text
                      x={CHART_WIDTH - CHART_RIGHT}
                      y={Math.max(CHART_TOP + 12, chart.thresholdY - 8)}
                      fill="var(--status-warning-foreground)"
                      fontSize="11"
                      fontWeight="600"
                      textAnchor="end"
                    >
                      96% line · {formatSpeed(analysis.thresholdMph)}
                    </text>
                  </g>
                ) : null}

                <path
                  d={chart.path}
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="3"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  aria-hidden="true"
                />

                {chart.points.map((point, index) => {
                  const state = fatiguePointState(point, analysis);
                  return (
                    <g key={`${point.swingNumber}-${index}`} aria-hidden="true">
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={state === "peak" ? 6 : 5}
                        fill={fatiguePointFill(state)}
                        stroke="var(--card)"
                        strokeWidth="2"
                      />
                      {showXAxisLabel(index, chart.points.length) ? (
                        <text
                          x={point.x}
                          y={CHART_HEIGHT - 16}
                          fill="var(--muted-foreground)"
                          fontSize="11"
                          textAnchor="middle"
                        >
                          {point.swingNumber}
                        </text>
                      ) : null}
                    </g>
                  );
                })}
                <text
                  x={CHART_WIDTH / 2}
                  y={CHART_HEIGHT - 2}
                  fill="var(--muted-foreground)"
                  fontSize="11"
                  textAnchor="middle"
                  aria-hidden="true"
                >
                  Swing number
                </text>
              </svg>
              <ul
                className="flex min-w-[42rem] flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/70 px-2 pt-2 text-xs text-muted-foreground"
                aria-label="Speed fatigue chart legend"
              >
                <li className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
                  Recorded speed
                </li>
                <li className="flex items-center gap-2">
                  <span
                    className="size-2 rounded-full bg-[var(--status-success-foreground)]"
                    aria-hidden="true"
                  />
                  Session peak
                </li>
                <li className="flex items-center gap-2">
                  <span
                    className="size-2 rounded-full bg-[var(--status-warning-foreground)]"
                    aria-hidden="true"
                  />
                  At or below 96% line
                </li>
              </ul>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
              Individual swing readings are required before fatigue can be measured.
            </div>
          )}
        </div>

        <FatigueAdvisory
          readings={orderedReadings}
          analysis={analysis}
          stopSwingNumber={stopSwingNumber}
        />
      </div>

      <ChartAccessibleFallback
        title="Speed fatigue"
        summary={summary}
        columns={[
          { key: "swing", label: "Swing" },
          { key: "speed", label: "Speed" },
          { key: "vsPeak", label: "Vs peak" },
          { key: "threshold", label: "96% line" },
          { key: "signal", label: "Signal" },
        ]}
        rows={orderedReadings.map((reading, index) => ({
          _key: `${reading.swingNumber}-${index}`,
          swing: String(reading.swingNumber),
          speed: formatSpeed(reading.clubSpeedMph),
          vsPeak: formatDeltaFromPeak(reading.clubSpeedMph, analysis.peakSpeedMph),
          threshold: formatSpeed(analysis.thresholdMph),
          signal: accessiblePointSignal(reading, analysis),
        }))}
      />
    </section>
  );
}

function FatigueAdvisory({
  readings,
  analysis,
  stopSwingNumber,
}: {
  readings: SpeedFatigueReading[];
  analysis: SpeedFatigueAnalysis;
  stopSwingNumber: number | null;
}) {
  if (analysis.stopRecommended) {
    return (
      <aside
        className="grid content-start gap-3 rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] p-4 text-[var(--status-warning-foreground)]"
        aria-live="polite"
        aria-atomic="true"
        data-fatigue-advisory="stop"
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <AlertTriangle className="size-4" aria-hidden="true" />
          End maximum-speed work
        </div>
        <p className="text-sm leading-6 text-foreground">
          Two consecutive swings crossed the 96% fatigue line. End the maximum-speed block
          {stopSwingNumber === null ? " now" : ` after swing ${stopSwingNumber}`} and move to
          controlled transfer work.
        </p>
        <p className="text-xs leading-5">
          This is a session-volume coaching rule, not an injury or medical assessment.
        </p>
      </aside>
    );
  }

  const needsMoreEvidence = readings.length < 3;

  return (
    <aside
      className="grid content-start gap-3 rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-surface)] p-4 text-[var(--status-success-foreground)]"
      data-fatigue-advisory="continue"
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        <CheckCircle2 className="size-4" aria-hidden="true" />
        {needsMoreEvidence ? "Build the fatigue read" : "No two-swing fatigue trigger"}
      </div>
      <p className="text-sm leading-6 text-foreground">
        {needsMoreEvidence
          ? "At least three individual swing readings are needed before a peak plus two consecutive drops can be judged."
          : "No two consecutive swings have crossed the 96% line. Keep full rest between maximum efforts and continue monitoring speed."}
      </p>
    </aside>
  );
}

function FatigueMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border/70 bg-card p-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-lg font-semibold tabular-nums text-foreground">{value}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground" title={detail}>
        {detail}
      </p>
    </div>
  );
}

function buildChart(readings: SpeedFatigueReading[], thresholdMph: number | null) {
  if (readings.length === 0) {
    return null;
  }

  const speeds = readings.map((reading) => reading.clubSpeedMph);
  const domainValues = thresholdMph === null ? speeds : [...speeds, thresholdMph];
  const rawMin = Math.min(...domainValues);
  const rawMax = Math.max(...domainValues);
  const domainPadding = Math.max(1, (rawMax - rawMin) * 0.18);
  const minSpeed = Math.floor((rawMin - domainPadding) * 10) / 10;
  const maxSpeed = Math.ceil((rawMax + domainPadding) * 10) / 10;
  const speedRange = Math.max(1, maxSpeed - minSpeed);
  const plotWidth = CHART_WIDTH - CHART_LEFT - CHART_RIGHT;
  const plotHeight = CHART_HEIGHT - CHART_TOP - CHART_BOTTOM;
  const xForIndex = (index: number) =>
    readings.length === 1
      ? CHART_LEFT + plotWidth / 2
      : CHART_LEFT + (index / (readings.length - 1)) * plotWidth;
  const yForSpeed = (speed: number) => CHART_TOP + ((maxSpeed - speed) / speedRange) * plotHeight;
  const points: ChartPoint[] = readings.map((reading, index) => ({
    ...reading,
    x: xForIndex(index),
    y: yForSpeed(reading.clubSpeedMph),
  }));

  return {
    minSpeed,
    maxSpeed,
    points,
    path: points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" "),
    thresholdY: thresholdMph === null ? CHART_HEIGHT - CHART_BOTTOM : yForSpeed(thresholdMph),
  };
}

function fatiguePointState(point: ChartPoint, analysis: SpeedFatigueAnalysis) {
  if (point.swingNumber === analysis.peakSwingNumber) {
    return "peak" as const;
  }

  if (analysis.thresholdMph !== null && point.clubSpeedMph <= analysis.thresholdMph) {
    return "below" as const;
  }

  return "within" as const;
}

function fatiguePointFill(state: ReturnType<typeof fatiguePointState>) {
  switch (state) {
    case "peak":
      return "var(--status-success-foreground)";
    case "below":
      return "var(--status-warning-foreground)";
    case "within":
      return "var(--primary)";
  }
}

function accessiblePointSignal(reading: SpeedFatigueReading, analysis: SpeedFatigueAnalysis) {
  if (reading.swingNumber === analysis.peakSwingNumber) {
    return "Peak";
  }

  if (reading.swingNumber === analysis.stopAfterSwingNumber) {
    return "Second consecutive swing at or below line — stop trigger";
  }

  if (analysis.thresholdMph !== null && reading.clubSpeedMph <= analysis.thresholdMph) {
    return "At or below 96% line";
  }

  return "Within speed window";
}

function fatigueSummary(readings: SpeedFatigueReading[], analysis: SpeedFatigueAnalysis) {
  if (readings.length === 0 || analysis.peakSpeedMph === null) {
    return "No individual swing readings are available, so in-session speed fatigue cannot be measured.";
  }

  const peakSwing = analysis.peakSwingNumber;
  const stopSwing = analysis.stopAfterSwingNumber;
  const peakPart = `Peak speed was ${formatSpeed(analysis.peakSpeedMph)}${
    peakSwing === null ? "" : ` on swing ${peakSwing}`
  }. The 96% line was ${formatSpeed(analysis.thresholdMph)}.`;

  if (analysis.stopRecommended) {
    return `${peakPart} Two consecutive swings crossed the fatigue line${
      stopSwing === null ? "" : ` by swing ${stopSwing}`
    }, so maximum-speed work should end.`;
  }

  return `${peakPart} No two consecutive swings crossed the fatigue line, so there is no stop trigger.`;
}

function fatigueTone(readings: SpeedFatigueReading[], analysis: SpeedFatigueAnalysis) {
  if (analysis.stopRecommended) {
    return "amber" as const;
  }

  return readings.length < 3 ? ("slate" as const) : ("green" as const);
}

function fatigueStatusLabel(readings: SpeedFatigueReading[], analysis: SpeedFatigueAnalysis) {
  if (analysis.stopRecommended) {
    return "Stop max block";
  }

  return readings.length < 3 ? "Building evidence" : "No fatigue trigger";
}

function formatSpeed(value: number | null) {
  return value === null ? "Not measured" : `${speedFormatter.format(value)} mph`;
}

function formatPercent(value: number | null) {
  return value === null ? "Not measured" : `${speedFormatter.format(value)}%`;
}

function formatDeltaFromPeak(value: number, peak: number | null) {
  if (peak === null) {
    return "Not measured";
  }

  const delta = Math.round((value - peak) * 10) / 10;
  return `${delta > 0 ? "+" : ""}${speedFormatter.format(delta)} mph`;
}

function formatChartAxis(value: number) {
  return numberFormatter(value);
}

function numberFormatter(value: number) {
  return Number.isInteger(value) ? String(value) : speedFormatter.format(value);
}

function showXAxisLabel(index: number, pointCount: number) {
  if (pointCount <= 12) {
    return true;
  }

  const interval = Math.ceil(pointCount / 10);
  return index === 0 || index === pointCount - 1 || index % interval === 0;
}
