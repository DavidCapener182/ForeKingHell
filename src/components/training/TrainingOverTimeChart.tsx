"use client";

import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ChartAccessibleFallback } from "@/components/app/chart-accessible-fallback";
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
  displayForm: {
    label: "Golf Form",
    theme: {
      light: "#2563EB",
      dark: "#2563EB",
      clubhouse: "#1555D6",
    },
  },
  fitness: {
    label: "Training Fitness",
    theme: {
      light: "#087A3D",
      dark: "#087A3D",
      clubhouse: "#123A29",
    },
  },
  fatigue: {
    label: "Recent Load",
    theme: {
      light: "#D97706",
      dark: "#D97706",
      clubhouse: "#AD8A48",
    },
  },
  sessionQuality: {
    label: "Session Quality",
    theme: {
      light: "#BE123C",
      dark: "#BE123C",
      clubhouse: "#75342E",
    },
  },
} satisfies ChartConfig;

export function TrainingOverTimeChart({ data, sessionMarkers }: TrainingOverTimeChartProps) {
  const chartData = withSmoothedDisplayForm(data);
  const sessionQualityValues = chartData
    .map((point) => point.sessionQuality)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const workloadDomain = chartDomain(
    data.flatMap((point) => [point.fitness, point.fatigue]),
    100,
    10,
  );
  const formDomain = formIndexDomain(chartData.flatMap((point) => [point.form, point.displayForm]));
  const latestPointIndex = chartData.length - 1;
  const summary = trainingOverTimeSummary(chartData, sessionMarkers.length);
  const fallbackRows = chartData.slice(-12).map((point) => ({
    _key: point.date,
    date: formatLongDate(point.date),
    form: formatAxisNumber(point.form),
    displayForm: formatAxisNumber(point.displayForm),
    fitness: formatAxisNumber(point.fitness),
    fatigue: formatAxisNumber(point.fatigue),
    readiness: formatAxisNumber(point.readiness),
    sessionQuality: formatOptionalAxisNumber(point.sessionQuality),
  }));

  return (
    <div className="grid min-w-0 gap-3">
      <ChartContainer
        config={chartConfig}
        className="h-[17rem] w-full min-w-0 aspect-auto"
        initialDimension={{ width: 720, height: 272 }}
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
              stroke="var(--chart-marker, #475569)"
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
          <YAxis yAxisId="quality" hide domain={[0, 100]} />
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
            yAxisId="form"
            dataKey="displayForm"
            stroke="var(--color-displayForm)"
            strokeWidth={2.5}
            dot={false}
            label={renderLatestFormLabel(latestPointIndex)}
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
          {sessionQualityValues.length > 0 ? (
            <Line
              type="monotone"
              yAxisId="quality"
              dataKey="sessionQuality"
              stroke="var(--color-sessionQuality)"
              strokeWidth={2.25}
              connectNulls
              dot={{ r: 3, strokeWidth: 1.5, fill: "#fffdf7" }}
              activeDot={{ r: 5 }}
            />
          ) : null}
        </LineChart>
      </ChartContainer>
      <ChartAccessibleFallback
        title="Training over time"
        summary={summary}
        columns={[
          { key: "date", label: "Date" },
          { key: "form", label: "Golf form" },
          { key: "fitness", label: "Fitness" },
          { key: "fatigue", label: "Recent load" },
          { key: "readiness", label: "Readiness" },
          { key: "sessionQuality", label: "Session quality" },
        ]}
        rows={fallbackRows}
      />
    </div>
  );
}

function trainingOverTimeSummary(data: TrainingChartPoint[], markerCount: number) {
  const latest = data.at(-1);

  if (!latest) {
    return "No training-over-time points are available for the selected period.";
  }

  const previous = data.at(-2);
  const formDelta = previous && Number.isFinite(previous.form) ? latest.form - previous.form : null;
  const latestQuality = latestSessionQualityPoint(data);
  const deltaCopy =
    formDelta === null
      ? "No prior point is available for a movement read."
      : `Golf form moved ${formatSignedAxisNumber(formDelta)} since the previous visible point.`;
  const qualityCopy = latestQuality
    ? `Latest scored session quality is ${formatAxisNumber(latestQuality.sessionQuality)}/100 on ${formatLongDate(
        latestQuality.date,
      )}.`
    : "No scored session-quality point is visible in this range.";

  return `Latest golf form is ${formatAxisNumber(latest.form)} with fitness ${formatAxisNumber(
    latest.fitness,
  )}, recent load ${formatAxisNumber(latest.fatigue)} and readiness ${formatAxisNumber(
    latest.readiness,
  )}. ${deltaCopy} ${qualityCopy} ${markerCount.toLocaleString(
    "en-GB",
  )} session markers are shown.`;
}

function latestSessionQualityPoint(data: TrainingChartPoint[]) {
  return [...data].reverse().find(
    (
      point,
    ): point is TrainingChartPoint & {
      sessionQuality: number;
    } => typeof point.sessionQuality === "number" && Number.isFinite(point.sessionQuality),
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

function formatOptionalAxisNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Not scored";
  }

  return formatAxisNumber(value);
}

function formatSignedAxisNumber(value: number) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded.toLocaleString("en-GB")}`;
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
