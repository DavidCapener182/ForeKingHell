"use client";
import { useId, useState } from "react";
import { MobileSegmentedControl } from "@/components/app/mobile-controls";
import styles from "./mobile-training.module.css";
import type { FitnessFreshnessPoint } from "@/lib/training/fitnessFreshness";

const views = {
  fitness: {
    label: "Fitness",
    detail: "Your longer-term training load. It reflects logged activity, not a fitness test.",
  },
  fatigue: {
    label: "Recent load",
    detail: "Recent logged training demand. Missing activities can make this look lower.",
  },
  form: {
    label: "Golf form",
    detail: "The existing model of measured golf performance. It is not a physical-readiness test.",
  },
};
export function MobileTrainingChart({
  data,
  inspect = false,
}: {
  data: FitnessFreshnessPoint[];
  inspect?: boolean;
}) {
  const gradientId = useId();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [view, setView] = useState<keyof typeof views>("fitness");
  const available = data.filter(
    (p) => Number.isFinite(p[view]) && Number.isFinite(Date.parse(p.date)),
  );
  const values = available.map((p) => p[view]);
  const matchingIndex = available.findIndex((p) => p.date === selectedDate);
  const selectedIndex = matchingIndex >= 0 ? matchingIndex : Math.max(0, available.length - 1);
  const selected = available[selectedIndex];
  const firstTime = Date.parse(available[0]?.date ?? "");
  const timeSpan = Date.parse(available.at(-1)?.date ?? "") - firstTime;
  const x = (point: FitnessFreshnessPoint) =>
    8 + ((Date.parse(point.date) - firstTime) / (timeSpan || 1)) * 284;
  const low = Math.min(...values),
    high = Math.max(...values);
  const points = values
    .map((v, i) => `${x(available[i])},${126 - ((v - low) / (high - low || 1)) * 106}`)
    .join(" ");
  return (
    <div className={styles.chart} data-mobile-training-chart>
      <MobileSegmentedControl
        ariaLabel="Training measure"
        value={view}
        onValueChange={(value) => setView(value as keyof typeof views)}
        options={[
          { value: "fitness", label: "Fitness" },
          { value: "fatigue", label: "Load" },
          { value: "form", label: "Form" },
        ]}
      />
      {inspect && selected ? (
        <div className={styles.readout}>
          <p>
            {views[view].label} <span>· {trainingDisplayDate(selected.date)}</span>
          </p>
          <strong>{selected[view].toFixed(1)}</strong>
          <span>modelled index</span>
        </div>
      ) : null}
      {values.length > 1 ? (
        <figure className={styles.figure}>
          <svg
            viewBox="0 0 300 146"
            role="img"
            aria-label={`${views[view].label}: ${Math.round(values[0])} to ${Math.round(values.at(-1)!)}. ${trainingDisplayDate(available[0].date)} to ${trainingDisplayDate(available.at(-1)!.date)}.`}
          >
            <text
              x="292"
              y="12"
              textAnchor="end"
              fontSize="11"
              fill="var(--mobile-secondary-label)"
            >
              {high.toFixed(1)}
            </text>
            <text
              x="292"
              y="142"
              textAnchor="end"
              fontSize="11"
              fill="var(--mobile-secondary-label)"
            >
              {low.toFixed(1)}
            </text>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--ios-tint, var(--primary))" stopOpacity="0.16" />
                <stop offset="100%" stopColor="var(--ios-tint, var(--primary))" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon points={`8,126 ${points} 292,126`} fill={`url(#${gradientId})`} />
            <path d="M8 126H292" stroke="var(--mobile-separator)" />
            <polyline
              points={points}
              fill="none"
              stroke="var(--ios-tint, var(--primary))"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {inspect && selected ? (
              <>
                <path
                  d={`M${x(selected)} 18V126`}
                  stroke="var(--mobile-secondary-label)"
                  strokeDasharray="3 3"
                />
                <circle
                  cx={x(selected)}
                  cy={126 - ((selected[view] - low) / (high - low || 1)) * 106}
                  r="4"
                  fill="var(--ios-tint, var(--primary))"
                  stroke="var(--mobile-surface)"
                  strokeWidth="2"
                />
              </>
            ) : null}
          </svg>
          <figcaption className="flex justify-between mobile-type-caption text-muted-foreground">
            <span>{trainingDisplayDate(available[0].date)}</span>
            <span>{trainingDisplayDate(available.at(-1)!.date)}</span>
          </figcaption>
        </figure>
      ) : (
        <p className="mobile-type-callout text-muted-foreground">
          More activity will establish a trend.
        </p>
      )}
      {inspect && available.length > 1 ? (
        <label className={styles.scrubber}>
          <span>Explore a day</span>
          <input
            type="range"
            min="0"
            max={available.length - 1}
            step="1"
            value={selectedIndex}
            aria-label="Training day"
            aria-valuetext={`${trainingDisplayDate(selected.date)}, ${views[view].label} ${selected[view].toFixed(1)}`}
            onChange={(event) => setSelectedDate(available[Number(event.target.value)].date)}
          />
        </label>
      ) : null}
      <p className="mobile-type-footnote text-muted-foreground">{views[view].detail}</p>
      <details>
        <summary className="mobile-progress-disclosure">Last 7 days · exact values</summary>
        <dl className="divide-y">
          {available.slice(-7).map((p) => (
            <div key={p.date} className="flex justify-between py-2 mobile-type-callout">
              <dt>{trainingDisplayDate(p.date)}</dt>
              <dd className="tabular-nums">{p[view].toFixed(1)}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
export function trainingDisplayDate(value: string) {
  const d = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  if (!Number.isFinite(d.getTime())) return "Not available";
  // Node and WebKit use different en-GB abbreviations for September.
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
}
