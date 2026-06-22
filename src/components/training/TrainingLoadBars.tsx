"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { FitnessFreshnessPoint } from "@/lib/training/fitnessFreshness";

type TrainingLoadBarsProps = {
  data: FitnessFreshnessPoint[];
};

const chartConfig = {
  load: {
    label: "Session load",
    color: "#111827",
  },
} satisfies ChartConfig;

export function TrainingLoadBars({ data }: TrainingLoadBarsProps) {
  return (
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
        <Bar dataKey="load" fill="var(--color-load)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
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
