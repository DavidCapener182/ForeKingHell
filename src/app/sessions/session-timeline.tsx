"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, GitCompareArrows, ListFilter, Target, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SessionHistoryFilterSheet } from "@/app/sessions/session-history-filter-sheet";
import {
  deriveSessionHistoryView,
  pruneSessionComparisonSelection,
} from "@/app/sessions/session-history-view";
import { useSessionHistoryUrlState } from "@/app/sessions/use-session-history-url-state";
import { formatClubType } from "@/lib/club-format";
import {
  DEFAULT_SESSION_HISTORY_FILTERS,
  type SessionDateFilter,
  type SessionHistoryFilterPatch,
  type SessionHistoryFilters,
  type SessionTypeFilter,
} from "@/lib/session-history-search-params";
import type { ShotPatternPoint } from "@/lib/shot-pattern-chart-data";
import { cn } from "@/lib/utils";

const SharedShotPatternVisual = dynamic(
  () => import("@/app/today/today-shot-charts").then((module) => module.SharedShotPatternVisual),
  {
    loading: () => (
      <Skeleton className="aspect-[82/43] w-full rounded-lg" aria-label="Drawing shot pattern" />
    ),
  },
);

export type SessionTimelineItem = {
  id: string;
  isRound: boolean;
  title: string;
  dateGroup: "Today" | "This week" | "Earlier";
  dateLabel: string;
  timeLabel?: string;
  shotCount: number;
  resultLabel: string;
  sourceLabel: string;
  typeLabel: string;
  contextLabel: string;
  clubs: string[];
  clubsLabel: string;
  notes: string | null;
  equipmentNotes: string | null;
  verdict: string;
  mainImprovement: string;
  mainIssue: string;
  planLinked: boolean;
  importedEvidence: boolean;
  roundScoreLabel: string | null;
  evidenceConfidence: "High" | "Moderate" | "Low";
  points: ShotPatternPoint[];
  importantMetrics: { label: string; value: string }[];
};

type SessionTimelineProps = {
  sessions: SessionTimelineItem[];
  accountId?: string;
  filters?: SessionHistoryFilters;
  onFiltersChange?: (patch: SessionHistoryFilterPatch) => void;
  onClearFilters?: () => void;
};

export function UrlBackedSessionTimeline({
  sessions,
  accountId,
}: Pick<SessionTimelineProps, "sessions" | "accountId">) {
  const { filters, updateFilters, clearFilters } = useSessionHistoryUrlState(sessions);

  return (
    <SessionTimeline
      sessions={sessions}
      accountId={accountId}
      filters={filters}
      onFiltersChange={updateFilters}
      onClearFilters={clearFilters}
    />
  );
}

export function SessionTimeline({
  sessions,
  accountId,
  filters = DEFAULT_SESSION_HISTORY_FILTERS,
  onFiltersChange = noop,
  onClearFilters = noop,
}: SessionTimelineProps) {
  const sourceOptions = useMemo(
    () => uniqueOptions(sessions.map((session) => session.sourceLabel)),
    [sessions],
  );
  const clubOptions = useMemo(
    () =>
      uniqueOptions(sessions.flatMap((session) => session.clubs)).map((value) => ({
        value,
        label: formatClubType(value),
      })),
    [sessions],
  );
  const { visible, focused: activeSession } = useMemo(
    () => deriveSessionHistoryView(sessions, filters),
    [filters, sessions],
  );
  const grouped = useMemo(() => groupSessions(visible), [visible]);
  const visibleSessionIds = useMemo(() => visible.map((session) => session.id), [visible]);
  const visibilityKey = JSON.stringify(visibleSessionIds);
  const [comparisonState, setComparisonState] = useState(() => ({
    visibilityKey,
    selected: [] as string[],
  }));
  let visibleSelected = comparisonState.selected;
  if (comparisonState.visibilityKey !== visibilityKey) {
    visibleSelected = pruneSessionComparisonSelection(visibleSelected, visibleSessionIds);
    setComparisonState({ visibilityKey, selected: visibleSelected });
  }
  const selectedSessions = visibleSelected.flatMap((id) => {
    const session = visible.find((item) => item.id === id);
    return session ? [session] : [];
  });
  const compareHref =
    visibleSelected.length === 2
      ? `/analyse/compare?sessionId=${encodeURIComponent(visibleSelected[0])}&baselineSessionId=${encodeURIComponent(visibleSelected[1])}`
      : null;
  const activeControlCount =
    Number(filters.type !== "all") +
    Number(filters.source !== "all") +
    Number(filters.club !== "all") +
    Number(filters.date !== "all") +
    Number(filters.sessionId !== null);

  useEffect(() => {
    if (!accountId) return;
    try {
      window.localStorage.setItem(
        `fkh:recent-review:${accountId}`,
        JSON.stringify(
          {
            version: 1,
            storedAt: new Date().toISOString(),
            sessions: sessions.slice(0, 10),
          },
          (key, value) => (key === "points" || key === "importantMetrics" ? undefined : value),
        ),
      );
    } catch {
      // Storage can be unavailable in strict or private browsing modes.
    }
  }, [accountId, sessions]);

  function toggle(id: string) {
    setComparisonState((current) => {
      const currentVisible = pruneSessionComparisonSelection(current.selected, visibleSessionIds);
      const selected = currentVisible.includes(id)
        ? currentVisible.filter((item) => item !== id)
        : currentVisible.length >= 2
          ? [currentVisible[1], id]
          : [...currentVisible, id];

      return { visibilityKey, selected };
    });
  }

  return (
    <div className="grid min-w-0 gap-3" data-sessions-history-workbench>
      <section
        className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border bg-card p-2.5"
        aria-label="Filter session history"
        data-session-toolbar
      >
        <Tabs
          value={filters.type}
          onValueChange={(value) => onFiltersChange({ type: value as SessionTypeFilter })}
        >
          <TabsList aria-label="Session type" className="grid grid-cols-3">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="practice">Practice</TabsTrigger>
            <TabsTrigger value="round">Rounds</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="h-6 w-px bg-border" aria-hidden />
        <SessionHistoryFilterSheet
          label="Source"
          value={filters.source}
          options={[{ value: "all", label: "All sources" }, ...sourceOptions.map(asOption)]}
          onChange={(source) => onFiltersChange({ source })}
        />
        <SessionHistoryFilterSheet
          label="Club"
          value={filters.club}
          options={[{ value: "all", label: "All clubs" }, ...clubOptions]}
          onChange={(club) => onFiltersChange({ club })}
        />
        <SessionHistoryFilterSheet
          label="Date"
          value={filters.date}
          options={[
            { value: "all", label: "Any date" },
            { value: "today", label: "Today" },
            { value: "week", label: "This week" },
            { value: "earlier", label: "Earlier" },
          ]}
          onChange={(date) => onFiltersChange({ date: date as SessionDateFilter })}
        />
        <span className="ml-auto text-xs text-muted-foreground">
          {visible.length} of {sessions.length}
        </span>
        {activeControlCount > 0 ? (
          <Button type="button" variant="ghost" size="sm" onClick={onClearFilters}>
            <X className="size-3.5" aria-hidden />
            Clear
          </Button>
        ) : null}
      </section>

      <div
        className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)] 2xl:grid-cols-[minmax(0,1.2fr)_minmax(25rem,0.8fr)]"
        data-session-master-detail
      >
        <Card className="min-w-0 overflow-hidden shadow-sm" aria-label="Chronological golf history">
          <CardHeader className="border-b py-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">Chronological history</CardTitle>
              <Badge variant="outline">{visible.length} sessions</Badge>
            </div>
          </CardHeader>
          <CardContent className="max-h-[calc(100dvh-18rem)] min-h-[32rem] overflow-y-auto p-0">
            {visible.length ? (
              grouped.map(([group, groupSessions]) => (
                <section key={group} aria-labelledby={`session-group-${slug(group)}`}>
                  <h2
                    id={`session-group-${slug(group)}`}
                    className="sticky top-0 z-10 border-b bg-card/95 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground backdrop-blur"
                  >
                    {group}
                  </h2>
                  <div className="relative divide-y before:absolute before:bottom-0 before:left-[1.85rem] before:top-0 before:w-px before:bg-border/70">
                    {groupSessions.map((session) => (
                      <DesktopSessionRow
                        key={session.id}
                        session={session}
                        active={session.id === activeSession?.id}
                        checked={visibleSelected.includes(session.id)}
                        onInspect={() => onFiltersChange({ sessionId: session.id })}
                        onToggle={() => toggle(session.id)}
                      />
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <div className="grid min-h-80 place-items-center p-6 text-center">
                <div>
                  <ListFilter className="mx-auto size-6 text-muted-foreground" aria-hidden />
                  <p className="mt-3 font-semibold">No sessions match these filters</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Clear the filters to restore your full golf history.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={onClearFilters}
                  >
                    Show all sessions
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <SessionPreview
          session={activeSession}
          selected={Boolean(activeSession && visibleSelected.includes(activeSession.id))}
          onToggle={toggle}
        />
      </div>

      {visibleSelected.length > 0 ? (
        <div
          aria-live="polite"
          className="sticky bottom-4 z-20 mx-auto flex w-[min(44rem,calc(100%-1rem))] items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-card/95 p-3 shadow-xl backdrop-blur"
          data-session-compare-tray
        >
          <div className="min-w-0">
            <p className="font-semibold">
              {visibleSelected.length === 2 ? "Ready to compare" : "Select one more session"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {selectedSessions.map((session) => session.title).join(" versus ")}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setComparisonState({ visibilityKey, selected: [] })}
            >
              Clear
            </Button>
            <Button asChild={Boolean(compareHref)} size="sm" disabled={!compareHref}>
              {compareHref ? (
                <Link href={compareHref}>
                  <GitCompareArrows className="size-4" aria-hidden />
                  Compare
                </Link>
              ) : (
                <span>1 of 2</span>
              )}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DesktopSessionRow({
  session,
  active,
  checked,
  onInspect,
  onToggle,
}: {
  session: SessionTimelineItem;
  active: boolean;
  checked: boolean;
  onInspect: () => void;
  onToggle: () => void;
}) {
  return (
    <Item
      variant={active ? "muted" : "default"}
      className={cn(
        "relative rounded-none border-0 px-4 py-3 pl-5",
        active && "bg-primary/[0.055]",
      )}
    >
      <ItemMedia className="relative z-[1] grid size-6 place-items-center rounded-full bg-card">
        <Checkbox
          checked={checked}
          onCheckedChange={onToggle}
          aria-label={`Select ${session.title} for comparison`}
        />
      </ItemMedia>
      <button
        type="button"
        className="focus-aaa min-w-0 flex-1 rounded-lg text-left"
        aria-pressed={active}
        aria-label={`Preview ${session.title}`}
        onClick={onInspect}
        data-session-inspect
      >
        <span className="block space-y-1">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="max-w-full truncate font-medium leading-5">{session.title}</span>
            <Badge variant="outline" className="font-normal">
              {session.typeLabel}
            </Badge>
          </span>
          <span className="block overflow-visible whitespace-normal text-clip text-xs leading-5 text-muted-foreground">
            {session.dateLabel} · {session.timeLabel}
            {session.contextLabel !== session.title ? ` · ${session.contextLabel}` : ""}
          </span>
          <span className="block truncate text-sm font-medium text-foreground">
            {session.verdict}
          </span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{session.sourceLabel}</span>
            <span>{session.evidenceConfidence} confidence</span>
            {session.planLinked ? (
              <span className="inline-flex items-center gap-1 text-primary">
                <Target className="size-3" aria-hidden /> Plan linked
              </span>
            ) : null}
          </span>
        </span>
      </button>
      <ItemActions>
        <Badge variant={session.isRound ? "secondary" : "outline"}>{session.resultLabel}</Badge>
      </ItemActions>
    </Item>
  );
}

function SessionPreview({
  session,
  selected,
  onToggle,
}: {
  session: SessionTimelineItem | null;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  if (!session) {
    return (
      <Card className="grid min-h-[32rem] place-items-center">
        <p className="text-sm text-muted-foreground">Choose a session to preview its review.</p>
      </Card>
    );
  }

  const href = session.isRound ? `/rounds/${session.id}` : `/sessions/${session.id}`;

  return (
    <Card
      className="min-w-0 self-start overflow-hidden shadow-sm lg:sticky lg:top-3"
      aria-label={`Preview ${session.title}`}
      data-selected-session-preview
    >
      <CardHeader className="gap-3 border-b pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{session.typeLabel}</Badge>
          <Badge variant="outline">{session.evidenceConfidence} confidence</Badge>
          {session.planLinked ? <Badge variant="secondary">Plan linked</Badge> : null}
          <span className="ml-auto text-xs text-muted-foreground">{session.dateLabel}</span>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Session verdict
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">{session.verdict}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {session.title} · {session.sourceLabel}
          </p>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 p-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 min-[1280px]:grid-cols-2">
          <Item variant="muted" size="sm" className="items-start">
            <ItemContent>
              <ItemTitle>Main improvement</ItemTitle>
              <ItemDescription className="overflow-visible whitespace-normal text-clip">
                {session.mainImprovement}
              </ItemDescription>
            </ItemContent>
          </Item>
          <Item variant="muted" size="sm" className="items-start">
            <ItemContent>
              <ItemTitle>Main issue</ItemTitle>
              <ItemDescription className="overflow-visible whitespace-normal text-clip">
                {session.mainIssue}
              </ItemDescription>
            </ItemContent>
          </Item>
        </div>

        <div
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 min-[1280px]:grid-cols-2"
          aria-label="Measured shot thumbnails"
        >
          <PatternThumbnail title="Dispersion" points={session.points} mode="dispersion" />
          <PatternThumbnail title="Flight" points={session.points} mode="trajectory" />
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Important metrics
          </h3>
          <dl className="mt-2 divide-y border-y">
            {session.importantMetrics.map((metric) => (
              <div
                key={metric.label}
                className="flex items-center justify-between gap-4 py-2 text-sm"
              >
                <dt className="text-muted-foreground">{metric.label}</dt>
                <dd className="font-semibold tabular-nums">{metric.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild className="flex-1">
            <Link href={href}>Open full review</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onToggle(session.id)}
            aria-pressed={selected}
          >
            <span
              className={cn(
                "grid size-4 place-items-center rounded border",
                selected ? "border-primary bg-primary text-primary-foreground" : "border-input",
              )}
              aria-hidden
            >
              {selected ? <Check className="size-3" /> : null}
            </span>
            {selected ? "Selected" : "Compare"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PatternThumbnail({
  title,
  points,
  mode,
}: {
  title: string;
  points: ShotPatternPoint[];
  mode: "dispersion" | "trajectory";
}) {
  const chartable = points.some((point) =>
    mode === "dispersion"
      ? point.carryYd !== null && point.sideCarryYd !== null
      : point.carryYd !== null && point.apexFt !== null,
  );

  return (
    <figure className="min-w-0 overflow-hidden rounded-xl border bg-muted/20 p-2">
      <figcaption className="mb-2 flex items-center justify-between text-xs font-semibold">
        {title}
        <span className="font-normal text-muted-foreground">{points.length} shots</span>
      </figcaption>
      {chartable ? (
        <div className="overflow-hidden rounded-lg bg-white">
          <SharedShotPatternVisual shots={points} mode={mode} trajectoryView="averages" />
        </div>
      ) : (
        <div className="grid aspect-[82/43] place-items-center rounded-lg border border-dashed bg-background px-3 text-center text-xs text-muted-foreground">
          {mode === "dispersion" ? "No measured landing pattern" : "No measured apex data"}
        </div>
      )}
    </figure>
  );
}

function groupSessions(sessions: SessionTimelineItem[]) {
  const order: SessionTimelineItem["dateGroup"][] = ["Today", "This week", "Earlier"];
  return order.flatMap((group) => {
    const matches = sessions.filter((session) => session.dateGroup === group);
    return matches.length ? ([[group, matches]] as const) : [];
  });
}

function uniqueOptions(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function asOption(value: string) {
  return { value, label: value };
}

function slug(value: string) {
  return value.toLowerCase().replace(/\s+/g, "-");
}

function noop() {}
