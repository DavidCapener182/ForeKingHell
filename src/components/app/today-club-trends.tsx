"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  clubFamilies,
  compareClubSessions,
  describeSessionTrend,
  evidenceClasses,
  formatTrendValue,
  metricReading,
  rollingSessionAverage,
  sessionTradeoffs,
  trendMetrics,
  type ClubTrend,
  type ProgressHistoryState,
} from "@/lib/club-progress";
import {
  parseProgressPreferences,
  progressStorageKey,
  resolveProgressSelection,
} from "@/lib/club-progress-preferences";

const subscribe = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener("club-progress-preferences", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("club-progress-preferences", callback);
  };
};
const serverSnapshot = () => null;
const controlClass =
  "min-h-11 min-w-0 max-w-full rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring";
const provenance = (c: ClubTrend) =>
  `${c.source} · ${c.context} · context ${c.playContext}${c.shotPlayContext !== c.playContext ? ` · shot context ${c.shotPlayContext}` : ""}`;
function latestSeries(clubs: ClubTrend[], clubId: string) {
  return clubs
    .filter((c) => c.clubId === clubId)
    .sort((a, b) => (b.points.at(-1)?.timestamp ?? 0) - (a.points.at(-1)?.timestamp ?? 0))[0];
}
export function TodayClubTrends({
  clubs,
  accountId = "fixture",
  mode = "today",
  history = "complete",
  invalidSessionCount = 0,
  method = "",
}: {
  clubs: ClubTrend[];
  accountId?: string;
  mode?: "today" | "dashboard";
  history?: ProgressHistoryState;
  invalidSessionCount?: number;
  method?: string;
}) {
  const query = useSearchParams();
  const router = useRouter();
  const storageKey = progressStorageKey(accountId);
  const rawSaved = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(storageKey);
      } catch {
        return null;
      }
    },
    serverSnapshot,
  );
  const saved = parseProgressPreferences(rawSaved);
  const selection = resolveProgressSelection(clubs, new URLSearchParams(query.toString()), saved);
  const { club, metric: metricKey, sessionId, window: windowSize, rolling, evidence } = selection;
  const [inspected, setInspected] = useState<string | null>(null);
  const metric = trendMetrics.find((m) => m.key === metricKey)!;
  const physicalClubs = [
    ...new Map(clubs.map((c) => [c.clubId, latestSeries(clubs, c.clubId)!])).values(),
  ];
  const activeFamily = club?.family ?? physicalClubs[0]?.family;
  const update = (values: Record<string, string | null>) => {
    const url = new URL(window.location.href);
    // Capture the effective state in each history entry so Back never falls through to newer preferences.
    const effective = {
      cpClub: club?.clubId ?? null,
      cpSeries: club?.id ?? null,
      cpMetric: metricKey,
      cpWindow: String(windowSize),
      cpRolling: rolling ? "1" : "0",
      cpEvidence: evidence,
      cpSession: query.get("cpSession"),
    };
    for (const [key, value] of Object.entries({ ...effective, ...values }))
      if (value === null) url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    const next = resolveProgressSelection(clubs, url.searchParams, saved);
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          version: 1,
          clubId: next.club?.clubId,
          series: next.club?.id,
          metric: next.metric,
          window: next.window,
          rolling: next.rolling,
          evidence: next.evidence,
        }),
      );
      window.dispatchEvent(new Event("club-progress-preferences"));
    } catch {
      /* Storage may be blocked; URL state still works. */
    }
    // Freeze the old effective selection before pushing, so initial Back is stable too.
    const before = new URL(window.location.href);
    for (const [key, value] of Object.entries(effective)) {
      if (value !== null) before.searchParams.set(key, value);
    }
    window.history.replaceState(null, "", `${before.pathname}${before.search}${before.hash}`);
    // Installed Next.js supports native history updates with useSearchParams, without RSC requests.
    window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
    setInspected(null);
  };
  const chooseClub = (c: ClubTrend) =>
    update({ cpClub: c.clubId, cpSeries: c.id, cpSession: null, cpEvidence: c.defaultEvidence });
  const outsideTodayScope =
    mode === "today" &&
    query.has("cpSession") &&
    !club?.points.some((p) => p.current && p.sessionId === sessionId);
  selection.unavailable ||= outsideTodayScope;
  const comparison = club
    ? compareClubSessions(club, sessionId ?? "", metricKey, evidence, history)
    : null;
  const currentIndex = club?.points.findIndex((p) => p.sessionId === sessionId) ?? -1;
  const points =
    club?.points.slice(Math.max(0, currentIndex - windowSize + 1), currentIndex + 1) ?? [];
  const values = points.map((p) => metricReading(p, metricKey, evidence).value);
  const rollingValues = rollingSessionAverage(
    club?.points
      .slice(0, currentIndex + 1)
      .map((p) => metricReading(p, metricKey, evidence).value) ?? [],
  ).slice(-windowSize);
  const nonMissing = values.filter((v): v is number => v !== null);
  const chartRef = useRef<HTMLDivElement>(null);
  const gradientId = useId();
  const [chartSize, setChartSize] = useState({ width: 760, height: 288 });
  const hasReadings = nonMissing.length > 0;
  useEffect(() => {
    const element = chartRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setChartSize({ width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [club?.id, selection.unavailable, hasReadings]);
  // Always include zero; the full metric scale avoids exaggerating small changes.
  const min = Math.min(0, ...nonMissing);
  const max = Math.max(metricKey === "smashFactor" ? 0.1 : 1, ...nonMissing) * 1.1;
  const left = 52;
  const right = chartSize.width - 28;
  const top = 24;
  const bottom = chartSize.height - 40;
  const x = (i: number) =>
    points.length === 1 ? (left + right) / 2 : left + (i * (right - left)) / (points.length - 1);
  const hitRadius =
    points.length <= 1 ? 16 : Math.min(16, (right - left) / (points.length - 1) / 2);
  const y = (v: number) => bottom - ((v - min) / (max - min)) * (bottom - top);
  const path = (numbers: (number | null)[]) =>
    numbers
      .map((v, i) =>
        v === null ? "" : `${i > 0 && numbers[i - 1] !== null ? "L" : "M"} ${x(i)} ${y(v)}`,
      )
      .join(" ");
  const areaPath = values
    .reduce<{ paths: string[]; segment: number[] }>(
      (result, value, i) => {
        if (value !== null) result.segment.push(i);
        if ((value === null || i === values.length - 1) && result.segment.length) {
          const indices = result.segment;
          if (indices.length > 1)
            result.paths.push(
              `M ${x(indices[0])} ${bottom} ` +
                indices.map((index) => `L ${x(index)} ${y(values[index]!)}`).join(" ") +
                ` L ${x(indices.at(-1)!)} ${bottom} Z`,
            );
          result.segment = [];
        }
        return result;
      },
      { paths: [], segment: [] },
    )
    .paths.join(" ");
  const focused = points.find((p) => p.sessionId === inspected) ?? comparison?.current;
  const focusedIndex = points.findIndex((p) => p.sessionId === focused?.sessionId);
  const bagClubs =
    mode === "today" && query.has("cpSession")
      ? physicalClubs.flatMap((c) => {
          const series = clubs.find(
            (s) =>
              s.clubId === c.clubId &&
              s.points.some((p) => p.current && p.sessionId === query.get("cpSession")),
          );
          return series ? [series] : [];
        })
      : physicalClubs;
  const answer =
    !comparison || selection.unavailable
      ? "The requested club, context or session is unavailable in this scope."
      : mode === "dashboard"
        ? `${club!.label} ${metric.label.toLowerCase()}: ${describeSessionTrend(points, metricKey, evidence).split(" · ")[0]}.`
        : `${club!.label}: ${comparison.text.toLowerCase()}.`;
  return (
    <section
      id="club-progress"
      data-club-progress
      data-progress-mode={mode}
      className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)] gap-3 rounded-2xl border border-border bg-card p-4 sm:p-6"
      aria-label="Shared club progress"
    >
      <div aria-live="polite" data-progress-answer>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {mode === "today" ? "Selected practice upload" : "Recent practice sessions"}
        </p>
        <h2 className="mt-1 text-xl font-semibold">Am I improving?</h2>
        <p className="mt-2 text-sm font-medium">{answer}</p>
        {club && sessionId && !selection.unavailable && (
          <p className="mt-1 text-sm text-muted-foreground">{sessionTradeoffs(club, sessionId)}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          Session measurements describe changes; distance, speed, smash and launch alone do not
          establish overall improvement.
        </p>
      </div>
      {history === "failed" && (
        <div role="alert" className="rounded-lg border p-3 text-sm">
          History loading failed. Current upload values are retained where available.{" "}
          <Button variant="outline" className="ml-2 min-h-11" onClick={() => router.refresh()}>
            Retry history
          </Button>
        </div>
      )}
      {invalidSessionCount > 0 && (
        <p role="status" className="text-sm">
          {invalidSessionCount} uploads omitted because their recorded session timestamp is invalid.
        </p>
      )}
      <nav aria-label="Club families" className="flex min-w-0 flex-wrap gap-1">
        {clubFamilies.map((family) => (
          <Button
            key={family}
            className="min-h-11"
            variant={family === activeFamily ? "secondary" : "ghost"}
            disabled={!physicalClubs.some((c) => c.family === family)}
            aria-pressed={family === activeFamily}
            onClick={() => chooseClub(physicalClubs.find((c) => c.family === family)!)}
          >
            {family}
          </Button>
        ))}
      </nav>
      <Tabs
        value={club?.clubId ?? ""}
        onValueChange={(id) => chooseClub(latestSeries(clubs, id)!)}
        className="min-w-0"
      >
        <div className="min-w-0 overflow-x-auto">
          <TabsList aria-label="Progress club" className="h-auto justify-start">
            {physicalClubs
              .filter((c) => c.family === activeFamily)
              .map((c) => {
                const p = compareClubSessions(
                  c,
                  c.points.findLast((p) => p.current)?.sessionId ?? "",
                  metricKey,
                );
                return (
                  <TabsTrigger
                    className="min-h-11 whitespace-nowrap"
                    key={c.clubId}
                    value={c.clubId}
                  >
                    {c.label}{" "}
                    <span className="ml-2 tabular-nums">
                      {p.delta === null
                        ? "—"
                        : `${p.delta >= 0 ? "↑" : "↓"} ${formatTrendValue(Math.abs(p.delta), metricKey)}`}
                    </span>
                  </TabsTrigger>
                );
              })}
          </TabsList>
        </div>
      </Tabs>
      <Tabs
        value={metricKey}
        onValueChange={(key) => update({ cpMetric: key })}
        className="min-w-0"
      >
        <div className="min-w-0 overflow-x-auto">
          <TabsList aria-label="Progress metric" className="h-auto justify-start">
            {trendMetrics.map((m) => (
              <TabsTrigger key={m.key} value={m.key} className="min-h-11 whitespace-nowrap">
                {m.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>
      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        {club && (
          <label className="grid min-w-0 gap-1 text-sm">
            Comparable series
            <select
              aria-label="Comparable series"
              className={`${controlClass} w-full`}
              value={club.id}
              onChange={(e) => update({ cpSeries: e.target.value, cpSession: null })}
            >
              {clubs
                .filter((c) => c.clubId === club.clubId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {provenance(c)}
                  </option>
                ))}
            </select>
          </label>
        )}
        {club && (
          <label className="grid min-w-0 gap-1 text-sm">
            Comparison upload
            <select
              aria-label="Comparison upload"
              className={`${controlClass} w-full`}
              value={sessionId ?? ""}
              onChange={(e) => update({ cpSession: e.target.value })}
            >
              {selection.unavailable && (
                <option value={sessionId}>Requested upload unavailable</option>
              )}
              {club.points
                .filter((p) => mode === "dashboard" || p.current)
                .map((p) => (
                  <option key={p.sessionId} value={p.sessionId}>
                    {p.date} · {p.fileName ?? "Upload"} · {p.sessionId.slice(0, 8)}
                  </option>
                ))}
            </select>
          </label>
        )}
        {metric.clubEvidence && (
          <label className="grid min-w-0 gap-1 text-sm">
            Club data evidence
            <select
              aria-label="Club data evidence"
              className={`${controlClass} w-full`}
              value={evidence}
              onChange={(e) => update({ cpEvidence: e.target.value })}
            >
              {evidenceClasses.map((trust) => (
                <option key={trust}>{trust}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      {comparison && !selection.unavailable ? (
        <>
          <p className="text-xs text-muted-foreground">
            {metric.description} · {provenance(club!)}
            {metric.clubEvidence ? ` · ${evidence} club data` : ""}. Provider does not establish
            unchanged device identity.
            {club?.playContext === "unknown"
              ? " Practice context is unrecorded; comparability is limited."
              : ""}
          </p>
          <dl data-progress-cards className="grid min-w-0 gap-3 sm:grid-cols-3">
            {(
              [
                ["Current", comparison.a, comparison.current],
                ["Previous", comparison.b, comparison.previous],
              ] as const
            ).map(([title, reading, point]) => (
              <div key={title} className="min-w-0 rounded-xl border p-3">
                <dt className="text-sm text-muted-foreground">{title}</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">
                  {formatTrendValue(reading.value, metricKey)}
                </dd>
                <dd className="mt-1 text-xs">
                  {reading.count} readings ·{" "}
                  {point?.date ??
                    (history === "complete" ? "No baseline session" : "History unavailable")}
                </dd>
                {point && (
                  <dd className="break-words text-xs text-muted-foreground">
                    {point.fileName ?? point.sessionId.slice(0, 8)}
                  </dd>
                )}
              </div>
            ))}
            <div className="min-w-0 rounded-xl border p-3">
              <dt className="text-sm text-muted-foreground">Change</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">
                {comparison.delta === null
                  ? "Unavailable"
                  : `${comparison.delta >= 0 ? "+" : "−"}${formatTrendValue(Math.abs(comparison.delta), metricKey)}`}
              </dd>
              <dd className="mt-1 text-sm">{comparison.text}</dd>
            </div>
          </dl>
          {comparison.sampleContext && (
            <p className="text-xs text-muted-foreground">{comparison.sampleContext}</p>
          )}
        </>
      ) : (
        <p role="status">
          {clubs.length
            ? "Choose an available club and comparable upload. Explicit unavailable scopes are not filled from another session."
            : "No eligible full shots for an active saved club in the selected practice scope."}
        </p>
      )}
      <div>
        <h3 className="mb-2 text-sm font-semibold">Whole bag · {metric.label}</h3>
        <div aria-label="Whole-bag changes" className="flex min-w-0 gap-2 overflow-x-auto pb-2">
          {bagClubs.map((c) => {
            const id =
              c.id === club?.id && sessionId
                ? sessionId
                : mode === "today" && query.has("cpSession")
                  ? query.get("cpSession")!
                  : (c.points.findLast((p) => p.current)?.sessionId ?? "");
            const p = compareClubSessions(
              c,
              id,
              metricKey,
              c.id === club?.id ? evidence : c.defaultEvidence,
              history,
            );
            return (
              <button
                type="button"
                key={c.clubId}
                aria-pressed={c.id === club?.id}
                className={`${controlClass} w-44 shrink-0 p-3 text-left ${c.id === club?.id ? "border-primary bg-secondary" : ""}`}
                onClick={() =>
                  update({
                    cpClub: c.clubId,
                    cpSeries: c.id,
                    cpSession: id,
                    cpEvidence: c.defaultEvidence,
                  })
                }
              >
                <span className="block truncate font-medium" title={c.label}>
                  {c.label}
                </span>
                <span className="block tabular-nums">
                  {formatTrendValue(p.a.value, metricKey)} ·{" "}
                  {p.delta === null
                    ? p.text
                    : `${p.delta >= 0 ? "+" : "−"}${formatTrendValue(Math.abs(p.delta), metricKey)}`}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {Math.min(p.a.count, p.b.count) < 10 ? "Early signal · " : ""}
                  {metric.clubEvidence ? `${c.defaultEvidence} · ` : ""}
                  {c.source} · {c.playContext}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {club && !selection.unavailable && (
        <>
          <div className="flex flex-wrap items-center gap-2" aria-label="History controls">
            {[5, 10, 20].map((n) => (
              <Button
                key={n}
                className="min-h-11"
                variant={windowSize === n ? "secondary" : "outline"}
                aria-pressed={windowSize === n}
                onClick={() => update({ cpWindow: String(n) })}
              >
                Last {n}
              </Button>
            ))}
            <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm">
              <input
                type="checkbox"
                checked={rolling}
                onChange={(e) => update({ cpRolling: e.target.checked ? "1" : "0" })}
                className="size-5"
              />
              3-session rolling average
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            {points.length} of {windowSize} requested sessions
            {points.length < windowSize
              ? history === "complete"
                ? " · fewer sessions available"
                : " · fewer sessions available within the loading bound"
              : ""}
            . {history === "bounded" ? "History truncated by the documented loading bound." : ""}{" "}
            Europe/London · vertical axis includes zero ({metric.unit || "ratio"}). Missing readings
            leave breaks.
          </p>
          {nonMissing.length ? (
            <div className="overflow-hidden rounded-xl border border-border bg-background">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">
                    {metric.label} over {points.length} sessions
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    One point per session · {metric.unit || "ratio"}
                  </p>
                </div>
                {focused && (
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums text-primary">
                      {formatTrendValue(
                        metricReading(focused, metricKey, evidence).value,
                        metricKey,
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{focused.date.split(",")[0]}</p>
                  </div>
                )}
              </div>
              <div ref={chartRef} className="h-72 w-full min-w-0 sm:h-80" data-session-chart>
                <svg
                  viewBox={`0 0 ${chartSize.width} ${chartSize.height}`}
                  className="block h-full w-full"
                  role="img"
                  aria-label={`${club.label} ${metric.label} session graph, ${metric.unit || "ratio"}; use the inspection buttons for exact values`}
                >
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.12" />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.01" />
                    </linearGradient>
                  </defs>
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
                    <g key={ratio}>
                      <line
                        x1={left}
                        x2={right}
                        y1={y(min + ratio * (max - min))}
                        y2={y(min + ratio * (max - min))}
                        stroke="var(--border)"
                        strokeDasharray={ratio === 0 ? undefined : "3 5"}
                      />
                      <text
                        x={left - 12}
                        y={y(min + ratio * (max - min)) + 4}
                        textAnchor="end"
                        fill="var(--muted-foreground)"
                        fontSize="11"
                        className="tabular-nums"
                      >
                        {(min + ratio * (max - min)).toFixed(metric.digits)}
                      </text>
                    </g>
                  ))}
                  <path d={areaPath} fill={`url(#${gradientId})`} />
                  {focusedIndex >= 0 && values[focusedIndex] !== null && (
                    <line
                      x1={x(focusedIndex)}
                      x2={x(focusedIndex)}
                      y1={top}
                      y2={bottom}
                      stroke="var(--primary)"
                      strokeOpacity="0.2"
                      strokeDasharray="4 4"
                    />
                  )}
                  <path
                    data-session-path
                    d={path(values)}
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {rolling && (
                    <path
                      data-rolling-path
                      d={path(rollingValues)}
                      fill="none"
                      stroke="var(--muted-foreground)"
                      strokeDasharray="6 4"
                      strokeWidth="2"
                    />
                  )}
                  {points.map(
                    (p, i) =>
                      values[i] !== null && (
                        <g key={p.sessionId}>
                          {p.sessionId === focused?.sessionId && (
                            <circle
                              cx={x(i)}
                              cy={y(values[i]!)}
                              r="12"
                              fill="var(--primary)"
                              fillOpacity="0.09"
                              pointerEvents="none"
                            />
                          )}
                          <circle
                            data-session-point={p.sessionId}
                            cx={x(i)}
                            cy={y(values[i]!)}
                            r={
                              p.sessionId === sessionId
                                ? 5
                                : p.sessionId === comparison?.previous?.sessionId
                                  ? 5
                                  : 3.5
                            }
                            fill={p.sessionId === sessionId ? "var(--primary)" : "var(--card)"}
                            stroke="var(--primary)"
                            strokeWidth={p.sessionId === comparison?.previous?.sessionId ? 2.5 : 2}
                            className="cursor-pointer"
                            onPointerEnter={() => setInspected(p.sessionId)}
                            onClick={() => setInspected(p.sessionId)}
                          >
                            <title>{`${p.date}: ${formatTrendValue(values[i], metricKey)}`}</title>
                          </circle>
                          <circle
                            cx={x(i)}
                            cy={y(values[i]!)}
                            r={hitRadius}
                            fill="transparent"
                            className="cursor-pointer"
                            onPointerEnter={() => setInspected(p.sessionId)}
                            onClick={() => setInspected(p.sessionId)}
                            aria-hidden="true"
                          />
                        </g>
                      ),
                  )}
                  {points.map((p, i) => {
                    const every = Math.max(
                      1,
                      Math.ceil((points.length - 1) / (chartSize.width < 600 ? 2 : 5)),
                    );
                    if (i !== points.length - 1 && i % every !== 0) return null;
                    if (i !== points.length - 1 && i !== 0 && points.length - 1 - i < every / 2)
                      return null;
                    return (
                      <text
                        key={p.sessionId}
                        x={x(i)}
                        y={chartSize.height - 14}
                        textAnchor={
                          points.length === 1
                            ? "middle"
                            : i === 0
                              ? "start"
                              : i === points.length - 1
                                ? "end"
                                : "middle"
                        }
                        fill="var(--muted-foreground)"
                        fontSize="11"
                      >
                        {new Date(p.timestamp).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          timeZone: "Europe/London",
                        })}
                      </text>
                    );
                  })}
                </svg>
              </div>
            </div>
          ) : (
            <p className="py-5 text-sm">
              No {metric.label.toLowerCase()} readings in these sessions. Try another metric.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Filled point: selected comparison upload. Ring: immediate previous session.{" "}
            {rolling
              ? "Dashed line: equal-session 3-session rolling average; a missing value leaves a gap."
              : ""}
          </p>
          <div
            aria-label="Inspect session points"
            className="flex min-w-0 gap-2 overflow-x-auto pb-2"
          >
            {points.map((p, i) => (
              <button
                key={p.sessionId}
                type="button"
                className={`${controlClass} shrink-0`}
                aria-pressed={focused?.sessionId === p.sessionId}
                onFocus={() => setInspected(p.sessionId)}
                onClick={() => setInspected(p.sessionId)}
              >
                {i + 1} · {p.date}
                {p.sessionId === sessionId
                  ? " · current"
                  : p.sessionId === comparison?.previous?.sessionId
                    ? " · previous"
                    : ""}
              </button>
            ))}
          </div>
          {focused && (
            <div
              data-inspected-session
              aria-live="polite"
              className="rounded-lg border p-3 text-sm"
            >
              <p>
                {focused.date} ·{" "}
                {formatTrendValue(metricReading(focused, metricKey, evidence).value, metricKey)} ·{" "}
                {metricReading(focused, metricKey, evidence).count} readings
              </p>
              <p className="text-xs text-muted-foreground">
                {provenance(club)}
                {metric.clubEvidence ? ` · ${evidence}` : ""}
                {focused.weather ? ` · ${focused.weather}` : ""}
                {focused.ambiguousTime ? " · ambiguous timestamp tie" : ""}
              </p>
              <a
                className="inline-flex min-h-11 items-center underline"
                href={`/sessions/${focused.sessionId}`}
              >
                Review source upload · {focused.fileName ?? focused.sessionId.slice(0, 8)}
              </a>
            </div>
          )}
          <details>
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">
              Session values and evidence method
            </summary>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">
                  {club.label} {metric.label} session values
                </caption>
                <thead>
                  <tr>
                    <th className="p-2">Upload (Europe/London)</th>
                    <th className="p-2">Value ({metric.unit || "ratio"})</th>
                    <th className="p-2">Readings</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((p) => (
                    <tr key={p.sessionId} className="border-t">
                      <td className="p-2">
                        <Link
                          className="inline-flex min-h-11 items-center underline"
                          prefetch={false}
                          href={`/sessions/${p.sessionId}`}
                        >
                          {p.date} · {p.fileName ?? p.sessionId.slice(0, 8)}
                          {p.sessionId === sessionId
                            ? " · current"
                            : p.sessionId === comparison?.previous?.sessionId
                              ? " · previous"
                              : ""}
                        </Link>
                      </td>
                      <td className="p-2 tabular-nums">
                        {formatTrendValue(metricReading(p, metricKey, evidence).value, metricKey)}
                      </td>
                      <td className="p-2">{metricReading(p, metricKey, evidence).count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Eligible recorded full-shot practice, without distance outlier trimming. Session means
              and carry sample standard deviation are separate from stock-yardage medians and
              practice-day or pooled-shot reports. Previous means the immediate preceding eligible
              session in this exact series, even when its metric is missing. At least 3 readings in
              both sessions are required for interpreted changes; fewer than 10 is an early signal.
              Stable uses descriptive bands (2 yd carry/lateral miss/spread; 1 mph ball speed), not
              a statistical test. Dashboard uses equal-session linear regression against recorded
              session time with at least 5 adequately sampled sessions. A rolling average never
              changes the comparison or verdict. Session.date orders uploads; tied timestamps have
              deterministic ID ordering but no interpreted change. Provider does not prove device
              identity. Unknown context stays separate. {method}
            </p>
            {mode === "dashboard" && (
              <p className="mt-2 text-xs text-muted-foreground">
                {describeSessionTrend(points, metricKey, evidence)}
              </p>
            )}
            <Link className="inline-flex min-h-11 items-center text-sm underline" href="/goals">
              Review saved goals
            </Link>
          </details>
        </>
      )}
    </section>
  );
}
