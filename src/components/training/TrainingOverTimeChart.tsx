"use client";

import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { FitnessFreshnessPoint } from "@/lib/training/fitnessFreshness";
import type { TrainingSessionMarker } from "@/lib/training/trainingData";

type TrainingOverTimeChartProps = {
  data: FitnessFreshnessPoint[];
  sessionMarkers: TrainingSessionMarker[];
};

type TrainingChartPoint = FitnessFreshnessPoint & {
  displayForm: number;
};

const DISPLAY_FORM_GAIN_ALPHA = 0.28;
const DISPLAY_FORM_SETBACK_RESPONSE = 0.7;

const chartConfig = {
  fitness: {
    label: "Golf Conditioning",
    color: "#087A3D",
  },
  fatigue: {
    label: "Acute load",
    color: "#D97706",
  },
  displayForm: {
    label: "Golf Form",
    color: "#2563EB",
  },
} satisfies ChartConfig;

export function TrainingOverTimeChart({ data, sessionMarkers }: TrainingOverTimeChartProps) {
  const chartData = withSmoothedDisplayForm(data);
  const workloadDomain = chartDomain(
    data.flatMap((point) => [point.fitness, point.fatigue]),
    100,
    10,
  );
  const formDomain = formIndexDomain(chartData.flatMap((point) => [point.form, point.displayForm]));
  const latestPointIndex = chartData.length - 1;

  return (
    <ChartContainer
      config={chartConfig}
      className="h-[20rem] w-full min-w-0 aspect-auto"
      initialDimension={{ width: 720, height: 320 }}
    >
      <LineChart
        data={chartData}
        accessibilityLayer
        margin={{ left: 0, right: 12, top: 12, bottom: 4 }}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        {sessionMarkers.map((marker) => (
          <ReferenceLine
            key={`${marker.date}-${marker.sessionCount}`}
            x={marker.date}
            yAxisId="workload"
            stroke="#475569"
            strokeDasharray="2 4"
            strokeOpacity={marker.sessionCount > 1 ? 0.36 : 0.22}
            strokeWidth={marker.sessionCount > 1 ? 1.5 : 1}
          />
        ))}
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          minTickGap={24}
          tickFormatter={formatAxisDate}
        />
        <YAxis
          yAxisId="workload"
          tickLine={false}
          axisLine={false}
          width={36}
          domain={workloadDomain}
          tickFormatter={formatAxisNumber}
        />
        <YAxis
          yAxisId="form"
          orientation="right"
          tickLine={false}
          axisLine={false}
          width={36}
          domain={formDomain}
          tickFormatter={formatAxisNumber}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(value) => formatLongDate(String(value))}
              formatter={(value, name) => (
                <>
                  <span className="text-muted-foreground">
                    {chartConfig[String(name) as keyof typeof chartConfig]?.label ?? name}
                  </span>
                  <span className="font-mono font-medium tabular-nums text-foreground">
                    {formatAxisNumber(Number(value))}
                  </span>
                </>
              )}
            />
          }
        />
        <Legend content={<ChartLegendContent />} />
        <ReferenceLine
          y={100}
          yAxisId="form"
          stroke="var(--color-displayForm)"
          strokeDasharray="3 4"
          strokeOpacity={0.28}
          label={{
            value: "Baseline",
            position: "insideRight",
            fill: "#2563EB",
            fontSize: 11,
            fontWeight: 600,
          }}
        />
        <Line
          type="monotone"
          yAxisId="workload"
          dataKey="fitness"
          stroke="var(--color-fitness)"
          strokeWidth={2.5}
          dot={false}
        />
        <Line
          type="monotone"
          yAxisId="workload"
          dataKey="fatigue"
          stroke="var(--color-fatigue)"
          strokeWidth={2.5}
          dot={false}
        />
        <Line
          type="monotone"
          yAxisId="form"
          dataKey="displayForm"
          stroke="var(--color-displayForm)"
          strokeWidth={2.5}
          dot={false}
          label={renderLatestFormLabel(latestPointIndex)}
        />
      </LineChart>
    </ChartContainer>
  );
}

type LatestFormLabelProps = {
  index?: unknown;
  value?: unknown;
  x?: unknown;
  y?: unknown;
  payload?: unknown;
};

function renderLatestFormLabel(lastIndex: number) {
  return function LatestFormLabel({ index, payload, value, x, y }: LatestFormLabelProps) {
    const formValue = rawFormValue(payload) ?? Number(value);

    if (
      index !== lastIndex ||
      !Number.isFinite(formValue) ||
      typeof x !== "number" ||
      typeof y !== "number"
    ) {
      return <g />;
    }

    return (
      <text
        x={x - 8}
        y={Math.max(14, y - 10)}
        fill="#2563EB"
        fontSize={12}
        fontWeight={700}
        paintOrder="stroke"
        stroke="#fffdf7"
        strokeWidth={3}
        textAnchor="end"
      >
        {`Golf Form ${formatAxisNumber(formValue)}`}
      </text>
    );
  };
}

function withSmoothedDisplayForm(data: FitnessFreshnessPoint[]): TrainingChartPoint[] {
  let easedForm = Number.isFinite(data[0]?.form) ? data[0]!.form : 100;
  let previousRawForm = easedForm;
  const points = data.map((point, index) => {
    if (index === 0) {
      return { ...point, displayForm: point.form };
    }

    const form = Number.isFinite(point.form) && point.form > 0 ? point.form : easedForm;
    const rawDelta = form - previousRawForm;

    if (rawDelta < -0.25) {
      easedForm = Math.max(
        70,
        Math.min(form, easedForm + rawDelta * DISPLAY_FORM_SETBACK_RESPONSE),
      );
    } else {
      easedForm += (form - easedForm) * DISPLAY_FORM_GAIN_ALPHA;
    }

    previousRawForm = form;

    return { ...point, displayForm: easedForm };
  });

  const latestPoint = points.at(-1);
  if (latestPoint) {
    return points.map((point, index) => {
      if (index !== points.length - 1) {
        return point;
      }

      return {
        ...point,
        displayForm: latestPoint.form,
      };
    });
  }

  return points;
}

function rawFormValue(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("form" in payload)) {
    return null;
  }

  const form = Number(payload.form);
  return Number.isFinite(form) ? form : null;
}

function chartDomain(values: number[], fallbackMax: number, padding: number): [number, number] {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  if (finiteValues.length === 0) {
    return [0, fallbackMax];
  }

  const min = Math.min(...finiteValues);
  const max = Math.max(...finiteValues);

  return [Math.min(0, Math.floor(min - padding)), Math.max(fallbackMax, Math.ceil(max + padding))];
}

function formIndexDomain(values: number[]): [number, number] {
  const finiteValues = values.filter((value) => Number.isFinite(value) && value > 0);
  if (finiteValues.length === 0) {
    return [80, 125];
  }

  const min = Math.min(100, ...finiteValues);
  const max = Math.max(100, ...finiteValues);
  const padding = 3;
  const minSpan = 12;
  const midpoint = (min + max) / 2;
  const halfSpan = Math.max((max - min) / 2 + padding, minSpan / 2);

  return [
    Math.max(70, Math.floor(midpoint - halfSpan)),
    Math.min(130, Math.ceil(midpoint + halfSpan)),
  ];
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
