"use client";

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ChartAccessibleFallback } from "@/components/app/chart-accessible-fallback";
import type { FitnessFreshnessPoint } from "@/lib/training/fitnessFreshness";

type TrainingLoadBarsProps = {
  data: FitnessFreshnessPoint[];
};

const chartConfig = {
  load: {
    label: "Session load",
    theme: {
      light: "#087A3D",
      dark: "#087A3D",
      clubhouse: "#123A29",
    },
  },
} satisfies ChartConfig;

export function TrainingLoadBars({ data }: TrainingLoadBarsProps) {
  const summary = trainingLoadBarsSummary(data);
  const fallbackRows = data.slice(-12).map((point) => ({
    _key: point.date,
    date: formatLongDate(point.date),
    load: formatAxisNumber(point.load),
    readiness: formatAxisNumber(point.readiness),
  }));

  return (
    <div className="grid min-w-0 gap-3">
      <ChartContainer
        config={chartConfig}
        className="h-[12rem] w-full min-w-0 aspect-auto"
        initialDimension={{ width: 720, height: 192 }}
      >
        <BarChart data={data} accessibilityLayer margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            minTickGap={28}
            tickFormatter={formatAxisDate}
          />
          <YAxis tickLine={false} axisLine={false} width={36} tickFormatter={formatAxisNumber} />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent labelFormatter={(value) => formatLongDate(String(value))} />
            }
          />
          <Bar dataKey="load" fill="var(--color-load)" radius={[4, 4, 0, 0]}>
            {data.map((point) => (
              <Cell key={point.date} fill={loadColor(point.load)} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
      <ChartAccessibleFallback
        title="Training load bars"
        summary={summary}
        columns={[
          { key: "date", label: "Date" },
          { key: "load", label: "Load" },
          { key: "readiness", label: "Readiness" },
        ]}
        rows={fallbackRows}
      />
    </div>
  );
}

function trainingLoadBarsSummary(data: FitnessFreshnessPoint[]) {
  const latest = data.at(-1);
  const peak = data.reduce<FitnessFreshnessPoint | null>(
    (currentPeak, point) => (!currentPeak || point.load > currentPeak.load ? point : currentPeak),
    null,
  );

  if (!latest) {
    return "No training-load bars are available for the selected period.";
  }

  const peakPart = peak
    ? `Peak visible load is ${formatAxisNumber(peak.load)} on ${formatLongDate(peak.date)}.`
    : "No peak load is available.";

  return `Latest visible load is ${formatAxisNumber(latest.load)} on ${formatLongDate(
    latest.date,
  )}, with readiness ${formatAxisNumber(latest.readiness)}. ${peakPart}`;
}

function loadColor(load: number) {
  if (load >= 500) {
    return "var(--training-load-critical, #DC2626)";
  }

  if (load >= 300) {
    return "var(--training-load-high, #D97706)";
  }

  if (load > 0) {
    return "var(--training-load-active, #087A3D)";
  }

  return "var(--training-load-empty, #CBD5E1)";
}

function formatAxisNumber(value: number) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return Math.round(value).toLocaleString("en-GB");
}

function formatAxisDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatLongDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
