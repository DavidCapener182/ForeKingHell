"use client";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { ChartAccessibleFallback } from "@/components/app/chart-accessible-fallback";
import { Button } from "@/components/ui/button";
import { UntitledSelect } from "@/components/untitled-ui/form-controls";
import { formatSignedDegrees as degrees } from "@/components/visuals/face-path-delivery-chart";
import { finiteNumbers, mean, percentile } from "@/lib/analysis-statistics";
import type { PathTrendClubSummary } from "@/lib/bag-intelligence";
import {
  deliverySummary,
  observedCurve,
  targetSide,
  type DeliveryObservation,
} from "@/lib/club-delivery";
import type { Handedness } from "@/lib/units";

const shapes = ["Straight", "Draw", "Fade", "My Usual Shape"];
const metrics = {
  path: "Club path (°)",
  face: "Face angle (°)",
  launch: "Start direction (°)",
  side: "Side carry (yd)",
};
type Metric = keyof typeof metrics;
type Windows = Partial<Record<Metric, [number, number]>>;
const metricKeys = Object.keys(metrics) as Metric[];
function subscribe(refresh: () => void) {
  window.addEventListener("storage", refresh);
  return () => window.removeEventListener("storage", refresh);
}
function usePreference(key: string) {
  const [session, setSession] = useState<Record<string, string>>({});
  const stored = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key) ?? "";
      } catch {
        return "";
      }
    },
    () => "",
  );
  return [
    session[key] ?? stored,
    (value: string) => {
      try {
        localStorage.setItem(key, value);
        window.dispatchEvent(new Event("storage"));
      } catch {
        setSession((prev) => ({ ...prev, [key]: value }));
      }
    },
  ] as const;
}
function readWindows(text: string): Windows {
  try {
    const data = JSON.parse(text);
    return Object.fromEntries(
      metricKeys.flatMap((key) => {
        const pair = data?.[key];
        return Array.isArray(pair) &&
          pair.length === 2 &&
          pair.every(Number.isFinite) &&
          pair[0] <= pair[1]
          ? [[key, pair]]
          : [];
      }),
    );
  } catch {
    return {};
  }
}
function TargetEditor({ windows, save }: { windows: Windows; save: (value: string) => void }) {
  const [message, setMessage] = useState("");
  return (
    <details className="rounded-lg border p-3">
      <summary className="cursor-pointer font-semibold">Personal target windows</summary>
      <form
        className="mt-3 grid gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const next: Windows = {};
          for (const key of metricKeys) {
            const lo = String(data.get(key + "Min"));
            const hi = String(data.get(key + "Max"));
            if (!lo && !hi) continue;
            if (!lo || !hi || Number(lo) > Number(hi)) {
              setMessage("Enter both bounds in ascending order for " + metrics[key] + ".");
              return;
            }
            next[key] = [Number(lo), Number(hi)];
          }
          save(JSON.stringify(next));
          setMessage("Windows saved.");
        }}
      >
        <p className="text-xs text-muted-foreground">
          Set either or both delivery and outcome targets for this club and shape. Leave unused
          ranges blank.
        </p>
        {metricKeys.map((key) => (
          <fieldset className="grid grid-cols-2 gap-2" key={key}>
            <legend>{metrics[key]}</legend>
            {["Min", "Max"].map((bound, i) => (
              <input
                key={bound}
                type="number"
                step="any"
                className="min-w-0 rounded border bg-background p-2"
                name={key + bound}
                aria-label={metrics[key] + " " + bound}
                placeholder={bound}
                defaultValue={windows[key]?.[i]}
              />
            ))}
          </fieldset>
        ))}
        <Button type="submit" size="sm" variant="outline">
          Save windows
        </Button>
        <p role="status">{message}</p>
      </form>
    </details>
  );
}
export function DeliveryAssessment({
  club,
  stats,
  hand,
}: {
  club: PathTrendClubSummary;
  stats: ReturnType<typeof deliverySummary>;
  hand: Handedness;
}) {
  const rows = club.delivery;
  const key = "lmwt.delivery." + club.clubId + "." + hand;
  const [savedShape, setShape] = usePreference(key + ".intent");
  const shape = shapes.includes(savedShape) ? savedShape : "My Usual Shape";
  const [usual, setUsual] = usePreference(key + ".usual");
  const intent = shape === "My Usual Shape" ? usual : shape;
  const [saved, setWindows] = usePreference(key + "." + shape + "." + intent);
  const windows = readWindows(saved);
  const options = shapes.map((value) => ({ value, label: value }));
  const starts = finiteNumbers(rows.map((r) => r.launch));
  const finishes = finiteNumbers(rows.map((r) => r.side));
  const axes = finiteNumbers(rows.map((r) => r.axis));
  const countSource = (source: string) => rows.filter((r) => r.source === source).length;
  const provenance = ["measured", "estimated", "unverified", "missing"]
    .filter((source) => countSource(source))
    .map((source) => countSource(source) + " " + source)
    .join(" · ");
  const strikes = rows.flatMap((row) => (row.strike ? [row.strike] : []));
  const sideMean = mean(finishes);
  const sideLabel =
    sideMean === null
      ? "Unavailable"
      : Math.abs(sideMean).toFixed(1) +
        " yd" +
        (sideMean < 0 ? " left" : sideMean > 0 ? " right" : " on target");
  const curves = axes.map((axis) => observedCurve(axis, hand));
  const counts = [...new Set(curves)]
    .map((curve) => curves.filter((c) => c === curve).length + " " + curve)
    .join(", ");
  const outcomes = rows.filter(
    (row) => row.axis !== null && row.launch !== null && row.side !== null,
  );
  function inside(row: DeliveryObservation, key: Metric) {
    const range = windows[key];
    const value = row[key];
    return !range || (value !== null && value >= range[0] && value <= range[1]);
  }
  const matches = outcomes.filter(
    (row) =>
      observedCurve(row.axis!, hand) === intent.toLowerCase() &&
      inside(row, "launch") &&
      inside(row, "side"),
  );
  const extent = Math.max(1, ...stats.deltas.map(Math.abs));
  const recommendation =
    !starts.length || !finishes.length
      ? "Record start direction and side carry against a marked target before changing your delivery."
      : !axes.length
        ? "Check curvature alongside the recorded finishes before adjusting face-to-path."
        : !windows.side
          ? "Choose a playable landing window and check how often this club finishes inside it."
          : "Practise the selected shape to your landing window and track the share of shots that match.";
  const feedback = !intent
    ? "Choose your usual shape to assess intent."
    : !outcomes.length
      ? "Matching intent needs start, verified spin axis and side carry on the same shot."
      : matches.length +
        " of " +
        outcomes.length +
        " complete shots matched " +
        intent.toLowerCase() +
        " curvature" +
        (windows.side || windows.launch
          ? " and your configured outcome windows."
          : ". Start and finish targets are unset.");
  const coverage = (n: number) => n + "/" + rows.length;
  const table = [
    ["Average start", degrees(mean(starts)), coverage(starts.length)],
    ["Average side carry", sideLabel, coverage(finishes.length)],
    ["Verified spin axis", degrees(mean(axes)), coverage(axes.length)],
    ["Face angle", degrees(stats.face), provenance],
    [
      "Club path",
      degrees(stats.path),
      rows.filter((r) => r.pathMeasured).length + "/" + rows.length + " source-verified paths",
    ],
    ["Face-to-path", degrees(stats.delta), coverage(stats.deltas.length)],
    [
      "Strike location",
      [...new Set(strikes)].join(", ") || "Unavailable",
      coverage(strikes.length),
    ],
  ].map(([metric, value, evidence]) => ({ metric: metric!, value: value!, evidence: evidence! }));
  return (
    <div className="mt-3 grid min-w-0 items-start gap-4 border-t pt-3 text-sm xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="grid gap-3">
        <UntitledSelect
          label="Intended shot shape"
          name="deliveryIntent"
          value={shape}
          options={options}
          onValueChange={setShape}
        />
        {shape === "My Usual Shape" && (
          <UntitledSelect
            label="My usual shape for this club"
            name="usualShape"
            value={usual}
            options={[{ value: "", label: "Choose a shape" }, ...options.slice(0, 3)]}
            onValueChange={setUsual}
          />
        )}
        <TargetEditor key={key + shape + intent} windows={windows} save={setWindows} />
        {metricKeys
          .filter((k) => windows[k])
          .map((k) => {
            const valid = rows.filter((r) => r[k] !== null);
            return (
              <p key={k}>
                {metrics[k]} · {windows[k]!.join(" to ")} ·{" "}
                {valid.filter((r) => inside(r, k)).length}/{valid.length} in range
              </p>
            );
          })}
        <div>
          <p className="font-semibold">Face-to-path consistency</p>
          {stats.deltas.length > 0 && (
            <svg
              className="h-8 w-full"
              role="img"
              aria-label="Individual face-to-path readings on a symmetric scale centred on zero"
              viewBox="0 0 300 24"
              preserveAspectRatio="none"
            >
              <path d="M4 12H296 M150 2V22" stroke="currentColor" opacity=".3" />
              {stats.deltas.map((d, i) => (
                <path
                  key={i}
                  d={`M${150 + (d / extent) * 144} 6v12`}
                  stroke="var(--delivery-face,#1555d6)"
                  opacity=".65"
                />
              ))}
            </svg>
          )}
          <p>
            Median {degrees(stats.median)} · Middle 60%{" "}
            {stats.deltas.length > 1
              ? degrees(stats.low) + " to " + degrees(stats.high)
              : "needs two shots"}{" "}
            · {coverage(stats.deltas.length)} paired
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Face source · {provenance}.{" "}
            {countSource("estimated") > 0 &&
              "Calculated or modelled face readings have lower confidence."}{" "}
            {countSource("unverified") > 0 &&
              "Historical readings may include launch-based estimates."}
          </p>
        </div>
      </div>
      <div className="grid min-w-0 gap-3">
        <div className="rounded-xl bg-muted/45 p-3">
          <p className="font-semibold">Observed outcome</p>
          <p>
            Start {degrees(mean(starts))} ({coverage(starts.length)}) · Side carry {sideLabel} (
            {coverage(finishes.length)})
          </p>
          <p>
            {curves.length ? "Verified curvature · " + counts : "Curvature unverified"} ·{" "}
            {coverage(axes.length)} spin axes
          </p>
          <p className="mt-2">{feedback}</p>
        </div>
        <ChartAccessibleFallback
          title={club.label + " face/path delivery"}
          summary={
            (stats.face === null
              ? "Expected start unavailable."
              : "Expected start · " +
                targetSide(stats.face).toLowerCase() +
                ". Likely curve " +
                (stats.delta === null
                  ? "unknown"
                  : stats.delta < 0
                    ? "left"
                    : stats.delta > 0
                      ? "right"
                      : "straight") +
                " with centred contact.") +
            " " +
            (finishes.length > 1
              ? "Middle 60% of finishes span " +
                percentile(finishes, 0.2)!.toFixed(1) +
                " to " +
                percentile(finishes, 0.8)!.toFixed(1) +
                " yd. "
              : "") +
            (/driver|wood|^[1-9]w$/i.test(club.clubType)
              ? "Heel or toe contact can alter curvature. " +
                (strikes.length ? "" : "Strike location unavailable. ")
              : "") +
            recommendation
          }
          columns={[
            { key: "metric", label: "Measurement" },
            { key: "value", label: "Result" },
            { key: "evidence", label: "Coverage / source" },
          ]}
          rows={table}
        />
        <details>
          <summary className="cursor-pointer font-semibold">
            Supporting shots ({rows.length})
          </summary>
          <ul className="mt-2 max-h-52 space-y-2 overflow-auto">
            {rows.map((row, i) => (
              <li key={row.id ?? i}>
                {row.id ? (
                  <Link className="underline" href={"/shots?shotId=" + encodeURIComponent(row.id)}>
                    Shot {i + 1}
                  </Link>
                ) : (
                  "Shot " + (i + 1)
                )}{" "}
                · Path {degrees(row.path)} · Face {degrees(row.face)} ({row.source}) · Start{" "}
                {degrees(row.launch)} · Side {row.side ?? "—"} yd · Axis {degrees(row.axis)}
                {row.strike && " · Strike " + row.strike}
              </li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );
}
