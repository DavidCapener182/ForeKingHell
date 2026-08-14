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
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatClubType } from "@/lib/club-format";
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

type TimelineFilter = "all" | "practice" | "round";
type DateFilter = "all" | "Today" | "This week" | "Earlier";

export function SessionTimeline({
  sessions,
  accountId,
}: {
  sessions: SessionTimelineItem[];
  accountId?: string;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const [source, setSource] = useState("all");
  const [club, setClub] = useState("all");
  const [date, setDate] = useState<DateFilter>("all");
  const [activeSessionId, setActiveSessionId] = useState(sessions[0]?.id ?? null);
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
  const visible = useMemo(
    () =>
      sessions.filter((session) => {
        if (filter === "round" && !session.isRound) return false;
        if (filter === "practice" && session.isRound) return false;
        if (source !== "all" && session.sourceLabel !== source) return false;
        if (club !== "all" && !session.clubs.includes(club)) return false;
        return date === "all" || session.dateGroup === date;
      }),
    [club, date, filter, sessions, source],
  );
  const grouped = useMemo(() => groupSessions(visible), [visible]);
  const activeSession =
    visible.find((session) => session.id === activeSessionId) ?? visible[0] ?? null;
  const selectedSessions = selected.flatMap((id) => {
    const session = sessions.find((item) => item.id === id);
    return session ? [session] : [];
  });
  const compareHref =
    selected.length === 2
      ? `/analyse/compare?sessionId=${encodeURIComponent(selected[0])}&baselineSessionId=${encodeURIComponent(selected[1])}`
      : null;
  const activeFilterCount =
    Number(source !== "all") + Number(club !== "all") + Number(date !== "all");

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
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      return current.length >= 2 ? [current[1], id] : [...current, id];
    });
  }

  function clearFilters() {
    setFilter("all");
    setSource("all");
    setClub("all");
    setDate("all");
  }

  return (
    <div className="grid min-w-0 gap-3" data-sessions-history-workbench>
      <section
        className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border bg-card p-2.5"
        aria-label="Filter session history"
        data-session-toolbar
      >
        <Tabs value={filter} onValueChange={(value) => setFilter(value as TimelineFilter)}>
          <TabsList aria-label="Session type" className="grid grid-cols-3">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="practice">Practice</TabsTrigger>
            <TabsTrigger value="round">Rounds</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="h-6 w-px bg-border" aria-hidden />
        <FilterSheet
          label="Source"
          value={source}
          options={[{ value: "all", label: "All sources" }, ...sourceOptions.map(asOption)]}
          onChange={setSource}
        />
        <FilterSheet
          label="Club"
          value={club}
          options={[{ value: "all", label: "All clubs" }, ...clubOptions]}
          onChange={setClub}
        />
        <FilterSheet
          label="Date"
          value={date}
          options={[
            { value: "all", label: "Any date" },
            { value: "Today", label: "Today" },
            { value: "This week", label: "This week" },
            { value: "Earlier", label: "Earlier" },
          ]}
          onChange={(value) => setDate(value as DateFilter)}
        />
        <span className="ml-auto text-xs text-muted-foreground">
          {visible.length} of {sessions.length}
        </span>
        {activeFilterCount > 0 || filter !== "all" ? (
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
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
                        checked={selected.includes(session.id)}
                        onInspect={() => setActiveSessionId(session.id)}
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
                    onClick={clearFilters}
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
          selected={Boolean(activeSession && selected.includes(activeSession.id))}
          onToggle={toggle}
        />
      </div>

      {selected.length > 0 ? (
        <div
          aria-live="polite"
          className="sticky bottom-4 z-20 mx-auto flex w-[min(44rem,calc(100%-1rem))] items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-card/95 p-3 shadow-xl backdrop-blur"
          data-session-compare-tray
        >
          <div className="min-w-0">
            <p className="font-semibold">
              {selected.length === 2 ? "Ready to compare" : "Select one more session"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {selectedSessions.map((session) => session.title).join(" versus ")}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected([])}>
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
      role="button"
      tabIndex={0}
      variant={active ? "muted" : "default"}
      className={cn(
        "relative cursor-pointer rounded-none border-0 px-4 py-3 pl-5 focus-visible:ring-2 focus-visible:ring-ring",
        active && "bg-primary/[0.055]",
      )}
      aria-current={active ? "true" : undefined}
      onClick={onInspect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onInspect();
        }
      }}
    >
      <ItemMedia className="relative z-[1] grid size-6 place-items-center rounded-full bg-card">
        <Checkbox
          checked={checked}
          onCheckedChange={onToggle}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Select ${session.title} for comparison`}
        />
      </ItemMedia>
      <ItemContent className="space-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <ItemTitle className="max-w-full">{session.title}</ItemTitle>
          <Badge variant="outline" className="font-normal">
            {session.typeLabel}
          </Badge>
        </div>
        <ItemDescription className="overflow-visible whitespace-normal text-clip">
          {session.dateLabel} · {session.timeLabel}
          {session.contextLabel !== session.title ? ` · ${session.contextLabel}` : ""}
        </ItemDescription>
        <p className="truncate text-sm font-medium text-foreground">{session.verdict}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{session.sourceLabel}</span>
          <span>{session.evidenceConfidence} confidence</span>
          {session.planLinked ? (
            <span className="inline-flex items-center gap-1 text-primary">
              <Target className="size-3" aria-hidden /> Plan linked
            </span>
          ) : null}
        </div>
      </ItemContent>
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
          <Button type="button" variant="outline" onClick={() => onToggle(session.id)}>
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

function FilterSheet({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const selectedLabel = options.find((option) => option.value === value)?.label;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          {label}
          {value !== "all" ? (
            <Badge variant="secondary" className="max-w-24 truncate">
              {selectedLabel}
            </Badge>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(24rem,92vw)] sm:max-w-96">
        <SheetHeader className="border-b pr-12">
          <SheetTitle>Filter by {label.toLowerCase()}</SheetTitle>
          <SheetDescription>
            Keep the history focused without changing the underlying session record.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-2 overflow-y-auto px-4 pb-4">
          {options.map((option) => (
            <SheetClose asChild key={option.value}>
              <Button
                type="button"
                variant={option.value === value ? "secondary" : "ghost"}
                className="min-h-11 justify-start"
                onClick={() => onChange(option.value)}
              >
                <span className="grid size-4 place-items-center" aria-hidden>
                  {option.value === value ? <Check className="size-4" /> : null}
                </span>
                {option.label}
              </Button>
            </SheetClose>
          ))}
        </div>
      </SheetContent>
    </Sheet>
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
