import { ChartAccessibleFallback } from "@/components/app/chart-accessible-fallback";
import { cn } from "@/lib/utils";

export type FacePathDeliveryDatum = {
  label: string;
  patternLabel: string;
  pathDeg: number | null;
  faceDeg: number | null;
  faceToPathDeg: number | null;
  sampleSize?: number | null;
};

type TargetWindow = {
  path: AngleWindow;
  face: AngleWindow;
};

type AngleWindow = {
  label: string;
  min: number;
  max: number;
};

type TargetWindowState = {
  label: string;
  tone: "green" | "amber" | "slate";
};

const CHART_ORIGIN = { x: 130, y: 66 };
const CHART_HALF_RUN = 105;
const CHART_VISUAL_SCALE = 2.5;

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

export function FacePathDeliveryChart({
  datum,
  idPrefix,
  className,
  chartClassName,
  compact = false,
  showAccessibleFallback = true,
  showMetricPills = true,
  targetWindow,
}: {
  datum: FacePathDeliveryDatum;
  idPrefix: string;
  className?: string;
  chartClassName?: string;
  compact?: boolean;
  showAccessibleFallback?: boolean;
  showMetricPills?: boolean;
  targetWindow?: TargetWindow;
}) {
  const markerSuffix = sanitizeMarkerId(idPrefix);
  const pathLine = deliveryLine(datum.pathDeg);
  const faceLine = deliveryLine(datum.faceDeg);
  const pathArrowId = `club-path-arrow-${markerSuffix}`;
  const faceArrowId = `club-face-arrow-${markerSuffix}`;

  return (
    <div className={cn("grid gap-2.5", className)}>
      <div
        className={cn(
          "clubhouse-chart-plot rounded-[16px] bg-[var(--delivery-chart-background,#ffffff)] px-3 py-3",
          chartClassName,
        )}
      >
        <svg
          aria-label={`${datum.label} ${datum.patternLabel} club face and club path direction`}
          role="img"
          viewBox="0 18 260 96"
          className={cn("w-full", compact ? "h-28 sm:h-32" : "h-40 sm:h-44")}
        >
          <defs>
            <marker
              id={pathArrowId}
              markerHeight="6.5"
              markerUnits="strokeWidth"
              markerWidth="7"
              orient="auto"
              refX="7"
              refY="3.5"
              viewBox="0 0 7 7"
            >
              <path d="M 0 0 L 7 3.5 L 0 7 z" fill="var(--delivery-path, #B91C1C)" />
            </marker>
            <marker
              id={faceArrowId}
              markerHeight="6.5"
              markerUnits="strokeWidth"
              markerWidth="7"
              orient="auto"
              refX="7"
              refY="3.5"
              viewBox="0 0 7 7"
            >
              <path d="M 0 0 L 7 3.5 L 0 7 z" fill="var(--delivery-face, #111827)" />
            </marker>
          </defs>
          <line
            x1="238"
            y1="66"
            x2="22"
            y2="66"
            stroke="var(--delivery-target, #A7B0A8)"
            strokeDasharray="10 8"
            strokeWidth="2"
          />
          <text
            x="230"
            y="56"
            fill="var(--chart-axis, #667085)"
            fontSize="11"
            fontWeight="700"
            textAnchor="end"
          >
            Target
          </text>
          {pathLine ? (
            <line
              x1={pathLine.x1}
              y1={pathLine.y1}
              x2={pathLine.x2}
              y2={pathLine.y2}
              markerEnd={`url(#${pathArrowId})`}
              stroke="var(--delivery-path, #B91C1C)"
              strokeLinecap="round"
              strokeWidth="3.75"
            />
          ) : null}
          {faceLine ? (
            <line
              x1={faceLine.x1}
              y1={faceLine.y1}
              x2={faceLine.x2}
              y2={faceLine.y2}
              markerEnd={`url(#${faceArrowId})`}
              stroke="var(--delivery-face, #111827)"
              strokeLinecap="round"
              strokeWidth="3.75"
            />
          ) : null}
          <circle
            cx="130"
            cy="66"
            r="7"
            fill="var(--delivery-centre, #F8FAF8)"
            stroke="var(--delivery-face, #111827)"
            strokeWidth="2"
          />
        </svg>
      </div>

      {showMetricPills ? (
        <div className="grid gap-2 text-[11px] font-bold leading-4 md:grid-cols-3">
          <span
            data-delivery-series="face"
            className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-lg bg-[#F9FAFB] px-2.5 py-2 text-[#111827]"
          >
            <span className="h-0.5 w-5 shrink-0 rounded-full bg-[var(--delivery-face,#111827)]" />
            <span>Club Face {formatSignedDegrees(datum.faceDeg)}</span>
          </span>
          <span
            data-delivery-series="path"
            className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-lg bg-[#FEF2F2] px-2.5 py-2 text-[#B91C1C]"
          >
            <span className="h-0.5 w-5 shrink-0 rounded-full bg-[var(--delivery-path,#B91C1C)]" />
            <span>Club Path {formatSignedDegrees(datum.pathDeg)}</span>
          </span>
          <span
            data-delivery-series="delta"
            className="inline-flex min-w-0 items-center justify-center rounded-lg bg-[#F7FBF8] px-2.5 py-2 text-[#087A3D]"
          >
            <span>Face-to-path {formatSignedDegrees(datum.faceToPathDeg)}</span>
          </span>
        </div>
      ) : null}

      {targetWindow ? (
        <div className="grid gap-1.5 rounded-xl bg-muted/40 px-2.5 py-2 text-[11px] leading-4">
          <p className="font-bold uppercase tracking-normal text-foreground">Target window</p>
          <TargetWindowRow
            label={targetWindow.path.label}
            windowLabel={formatAngleWindow(targetWindow.path)}
            current={formatSignedDegrees(datum.pathDeg)}
            state={angleTargetState(datum.pathDeg, targetWindow.path)}
          />
          <TargetWindowRow
            label={targetWindow.face.label}
            windowLabel={formatAngleWindow(targetWindow.face)}
            current={formatSignedDegrees(datum.faceDeg)}
            state={angleTargetState(datum.faceDeg, targetWindow.face)}
          />
        </div>
      ) : null}

      {showAccessibleFallback ? (
        <ChartAccessibleFallback
          title={`${datum.label} face/path delivery`}
          summary={facePathFallbackSummary(datum, targetWindow)}
          columns={[
            { key: "metric", label: "Metric" },
            { key: "value", label: "Value" },
            { key: "target", label: "Target" },
            { key: "status", label: "Status" },
          ]}
          rows={facePathFallbackRows(datum, targetWindow)}
        />
      ) : null}
    </div>
  );
}

function deliveryLine(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const angle = visualAngle(value);
  const rise = Math.tan(angle) * CHART_HALF_RUN;

  return {
    x1: CHART_ORIGIN.x + CHART_HALF_RUN,
    y1: roundChartPoint(CHART_ORIGIN.y + rise),
    x2: CHART_ORIGIN.x - CHART_HALF_RUN,
    y2: roundChartPoint(CHART_ORIGIN.y - rise),
  };
}

function visualAngle(value: number) {
  return (clampNumber(value * CHART_VISUAL_SCALE, -24, 24) * Math.PI) / 180;
}

function TargetWindowRow({
  label,
  windowLabel,
  current,
  state,
}: {
  label: string;
  windowLabel: string;
  current: string;
  state: TargetWindowState;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-lg bg-card/74 px-2 py-1.5">
      <span className="min-w-0 text-foreground">
        {label}: <span className="font-semibold text-foreground">{windowLabel}</span>
      </span>
      <span
        data-target-tone={state.tone}
        className={cn(
          "shrink-0 font-bold",
          state.tone === "green"
            ? "text-[var(--status-success-foreground)]"
            : state.tone === "amber"
              ? "text-[var(--status-warning-foreground)]"
              : "text-foreground",
        )}
      >
        Current {current} · {state.label}
      </span>
    </div>
  );
}

function angleTargetState(
  value: number | null | undefined,
  window: AngleWindow,
): TargetWindowState {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return {
      label: "Needs data",
      tone: "slate",
    };
  }

  if (value >= window.min && value <= window.max) {
    return {
      label: "OK",
      tone: "green",
    };
  }

  return {
    label: value > window.max ? "Slightly open" : "Slightly closed",
    tone: "amber",
  };
}

function facePathFallbackSummary(
  datum: FacePathDeliveryDatum,
  targetWindow: TargetWindow | undefined,
) {
  const sample =
    typeof datum.sampleSize === "number" && Number.isFinite(datum.sampleSize)
      ? ` from ${numberFormatter.format(datum.sampleSize)} measured shots`
      : "";
  const targetDetail = targetWindow
    ? ` Target windows are ${targetWindow.path.label.toLowerCase()} ${formatAngleWindow(
        targetWindow.path,
      )} and ${targetWindow.face.label.toLowerCase()} ${formatAngleWindow(targetWindow.face)}.`
    : "";

  return `${datum.label} is classified as ${datum.patternLabel}${sample}. Club path is ${formatSignedDegrees(
    datum.pathDeg,
  )}, club face is ${formatSignedDegrees(datum.faceDeg)}, and face-to-path is ${formatSignedDegrees(
    datum.faceToPathDeg,
  )}.${targetDetail}`;
}

function facePathFallbackRows(
  datum: FacePathDeliveryDatum,
  targetWindow: TargetWindow | undefined,
) {
  return [
    {
      _key: "path",
      metric: "Club path",
      value: formatSignedDegrees(datum.pathDeg),
      target: targetWindow ? formatAngleWindow(targetWindow.path) : "No target window",
      status: targetWindow ? angleTargetState(datum.pathDeg, targetWindow.path).label : "Reference",
    },
    {
      _key: "face",
      metric: "Club face",
      value: formatSignedDegrees(datum.faceDeg),
      target: targetWindow ? formatAngleWindow(targetWindow.face) : "No target window",
      status: targetWindow ? angleTargetState(datum.faceDeg, targetWindow.face).label : "Reference",
    },
    {
      _key: "face-to-path",
      metric: "Face-to-path",
      value: formatSignedDegrees(datum.faceToPathDeg),
      target: "Pattern balance",
      status: datum.patternLabel,
    },
    {
      _key: "sample",
      metric: "Sample",
      value:
        typeof datum.sampleSize === "number" && Number.isFinite(datum.sampleSize)
          ? numberFormatter.format(datum.sampleSize)
          : "Not shown",
      target: "Measured shots",
      status: "Evidence",
    },
  ];
}

function formatAngleWindow(window: AngleWindow) {
  return `${formatSignedNumber(window.min)} to ${formatSignedDegrees(window.max)}`;
}

export function formatSignedDegrees(value: number | null | undefined) {
  return typeof value !== "number" || !Number.isFinite(value)
    ? "--"
    : `${formatSignedNumber(value)} deg`;
}

function formatSignedNumber(value: number) {
  return `${value > 0 ? "+" : ""}${numberFormatter.format(value)}`;
}

function sanitizeMarkerId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function roundChartPoint(value: number) {
  return Math.round(value * 10) / 10;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
