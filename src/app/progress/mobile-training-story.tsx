"use client";
import { useState } from "react";
import { MobileSegmentedControl } from "@/components/app/mobile-controls";
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
export function MobileTrainingStory({ data }: { data: FitnessFreshnessPoint[] }) {
  const [view, setView] = useState<keyof typeof views>("fitness");
  const available = data.filter((p) => Number.isFinite(p[view]));
  const values = available.map((p) => p[view]);
  const low = Math.min(...values),
    high = Math.max(...values);
  const points = values
    .map(
      (v, i) =>
        `${8 + (i / Math.max(1, values.length - 1)) * 284},${126 - ((v - low) / (high - low || 1)) * 106}`,
    )
    .join(" ");
  return (
    <div className="grid gap-3" data-mobile-training-chart>
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
      {values.length > 1 ? (
        <figure className="mobile-progress-chart">
          <svg
            viewBox="0 0 300 146"
            role="img"
            aria-label={`${views[view].label}: ${Math.round(values[0])} to ${Math.round(values.at(-1)!)}. ${date(available[0].date)} to ${date(available.at(-1)!.date)}.`}
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
            <path d="M8 126H292" stroke="var(--mobile-separator)" />
            <polyline
              points={points}
              fill="none"
              stroke="var(--ios-tint, var(--primary))"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <figcaption className="flex justify-between mobile-type-caption text-muted-foreground">
            <span>{date(available[0].date)}</span>
            <span>{date(available.at(-1)!.date)}</span>
          </figcaption>
        </figure>
      ) : (
        <p className="mobile-type-callout text-muted-foreground">
          More activity will establish a trend.
        </p>
      )}
      <p className="mobile-type-footnote text-muted-foreground">{views[view].detail}</p>
      <details>
        <summary className="mobile-progress-disclosure">Last 7 days · exact values</summary>
        <dl className="divide-y">
          {available.slice(-7).map((p) => (
            <div key={p.date} className="flex justify-between py-2 mobile-type-callout">
              <dt>{date(p.date)}</dt>
              <dd className="tabular-nums">{p[view].toFixed(1)}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
function date(value: string) {
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
