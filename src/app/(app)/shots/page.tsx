import Link from "next/link";
import dynamicImport from "next/dynamic";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowUpDown, Database, Flag, Upload } from "lucide-react";
import { and, asc, count, desc, eq, gte, lte, sql } from "drizzle-orm";

import { AppEmptyState } from "@/components/app/app-empty-state";
import {
  DesktopInsightRail,
  DesktopTableWorkbenchControls,
  DesktopWorkbenchLayout,
  commonAiPrompts,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { SavedShotViewsPanel } from "@/app/shots/saved-shot-views-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { PageShell } from "@/components/premium";
import {
  InteractiveDesktopShotMapContent,
  type InteractiveShotShapeMapRow,
} from "@/app/shots/interactive-shot-shape-map";
import {
  ShotsMasterDetailTable,
  type ShotMasterDetailRow,
  type ShotTableSort,
} from "@/app/shots/shots-master-detail-table";
import { ShotFilterToolbar } from "@/app/shots/shot-filter-toolbar";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { clubs, importRows, sessions, shots } from "@/db/schema";
import { getDb } from "@/db/client";
import { formatClubModelName, formatClubType, isTrackedClubType } from "@/lib/club-format";
import { isPlaywrightE2eAuthBypassEnabled, requireCurrentUserId } from "@/lib/current-user";
import { getFeatureIdeasData } from "@/lib/feature-ideas";
import { buildShotShapeTrace, type ShotShapeTrace } from "@/lib/shot-shape-trace";
import { SHOT_MAP_MAX_CARRY_YD, SHOT_MAP_MAX_SIDE_YD } from "@/lib/shot-map-scale";
import { buildShotPatternGroups } from "@/lib/shot-pattern-clusters";
import { reportServerFailure } from "@/lib/server-observability";

export const dynamic = "force-dynamic";

const ShotPatternExplorer = dynamicImport(
  () => import("@/app/shots/shot-pattern-explorer").then((module) => module.ShotPatternExplorer),
  {
    loading: () => (
      <div
        className="grid min-h-64 content-center gap-3 rounded-2xl border border-dashed bg-muted/25 p-4"
        role="status"
        aria-label="Shot-pattern explorer loading"
      >
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-48 w-full" />
        <span className="sr-only">Loading shot-pattern explorer…</span>
      </div>
    ),
  },
);

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

type ShotFilters = {
  page: number;
  club: string;
  sessionId: string;
  category: string;
  q: string;
  from: string;
  to: string;
  sort: ShotSortMetric;
  dir: ShotSortDirection;
  group: "none" | "club" | "session";
};

const PAGE_SIZE = 25;
const shotWorkbenchColumns: DesktopWorkbenchColumn[] = [
  { id: "date", label: "Date", locked: true },
  { id: "file", label: "File" },
  { id: "shot", label: "Shot #" },
  { id: "hole", label: "Hole" },
  { id: "club", label: "Club", locked: true },
  { id: "carry", label: "Carry" },
  { id: "total", label: "Total" },
  { id: "side", label: "Side" },
  { id: "launch", label: "Launch" },
  { id: "ballSpeed", label: "Ball speed" },
  { id: "advanced", label: "Advanced" },
];
const shotSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Driver misses right",
    href: "/shots?club=driver&sort=side",
    detail: "Start from tee shots and side-carry movement.",
  },
  {
    title: "7 iron stock shots",
    href: "/shots?club=7i",
    detail: "Approach-club evidence for stock carry checks.",
  },
  {
    title: "Latest launch numbers",
    href: "/shots?sort=launch",
    detail: "Sort the archive by launch angle for delivery review.",
  },
];
const shotSessionImportColumns: DesktopWorkbenchColumn[] = [
  { id: "file", label: "File", locked: true },
  { id: "date", label: "Date" },
  { id: "type", label: "Type" },
  { id: "shots", label: "Shots", locked: true },
];
const shotSessionSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Latest practice",
    href: "/today",
    detail: "Review the newest imported session before drilling into rows.",
  },
  {
    title: "Import centre",
    href: "/import",
    detail: "Upload or inspect raw CSV quality before it affects analysis.",
  },
  {
    title: "Rapsodo inbox",
    href: "/rapsodo",
    detail: "Check provider sync status and mapping issues.",
  },
];
const shotSortMetrics = [
  "recent",
  "shot",
  "carry",
  "total",
  "side",
  "launch",
  "ballSpeed",
  "clubSpeed",
  "launchDirection",
  "apex",
  "attack",
  "path",
  "face",
  "descent",
  "smash",
] as const;
type ShotSortMetric = (typeof shotSortMetrics)[number];
type ShotSortDirection = "asc" | "desc";

const shotSortLabels: Record<ShotSortMetric, string> = {
  recent: "Newest first",
  shot: "Shot",
  carry: "Carry",
  total: "Total",
  side: "Side",
  launch: "Launch",
  ballSpeed: "Ball mph",
  clubSpeed: "Club speed",
  launchDirection: "Direction",
  apex: "Apex",
  attack: "Attack",
  path: "Path",
  face: "Face angle",
  descent: "Descent",
  smash: "Smash",
};

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

const integerFormatter = new Intl.NumberFormat("en-GB");

export default async function ShotsPage({ searchParams }: { searchParams: SearchParams }) {
  const resolvedSearchParams = await searchParams;
  const filters = parseFilters(resolvedSearchParams);
  const [
    {
      stats,
      rowTypes,
      sessionSummaries,
      savedShots,
      dispersionShots,
      totalFilteredShots,
      clubsForFilter,
      categories,
    },
    featureData,
  ] = await Promise.all([getShotDatabase(filters), getFeatureIdeasData()]);
  const totalPages = Math.max(1, Math.ceil(totalFilteredShots / PAGE_SIZE));
  if (filters.page > totalPages) {
    redirect(pageHref(filters, totalPages));
  }
  const activeFilterChips = buildShotFilterSummary(filters, clubsForFilter, sessionSummaries);
  const currentViewLabel = buildShotCurrentViewLabel(filters, activeFilterChips);
  const mapScopeFilters = { ...filters, club: "" };
  const mapScopeFilterChips = buildShotFilterSummary(
    mapScopeFilters,
    clubsForFilter,
    sessionSummaries,
  );
  const mapScopeLabel = buildShotCurrentViewLabel(mapScopeFilters, mapScopeFilterChips);
  const desktopShotRows = savedShots.map(serializeShotForMasterDetail);
  const desktopShotSorts = buildShotTableSorts(filters);

  if (stats.shotCount === 0) {
    return (
      <PageShell>
        <div className="grid gap-5" data-shots-desktop-workbench>
          <div className="flex items-center justify-between gap-4">
            <Button asChild variant="ghost" className="px-0">
              <Link href="/dashboard">
                <ArrowLeft className="size-4" />
                Dashboard
              </Link>
            </Button>
            <Button asChild>
              <Link href="/import">
                <Upload className="size-4" />
                Import CSV
              </Link>
            </Button>
          </div>
          <AppEmptyState
            className="min-h-[30rem]"
            icon={<Database className="size-6" aria-hidden />}
            title="Import your first measured shots"
            description="Shot maps, filters and evidence tables appear after a launch-monitor or CSV session is saved."
            primaryAction={
              <Button asChild>
                <Link href="/import">Import shot data</Link>
              </Button>
            }
            secondaryAction={
              <Button asChild variant="outline">
                <Link href="/providers">Connect Rapsodo</Link>
              </Button>
            }
          />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="contents" data-shots-desktop-workbench>
        <div className="flex items-center justify-between gap-4">
          <Button asChild variant="ghost" className="px-0">
            <Link href="/dashboard">
              <ArrowLeft className="size-4" />
              Dashboard
            </Link>
          </Button>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/rounds">
                <Flag className="size-4" />
                Rounds
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/import">
                <Upload className="size-4" />
                Import CSV
              </Link>
            </Button>
          </div>
        </div>

        <Card data-shots-archive-hero>
          <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-2">
              <Badge variant="secondary" className="w-fit">
                Explorer
              </Badge>
              <CardTitle className="text-4xl tracking-tight text-balance sm:text-5xl">
                Your shots
              </CardTitle>
              <CardDescription className="text-base leading-7">
                Filter the archive by club, session, date, shot category, or file name.
              </CardDescription>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:min-w-[520px] lg:grid-cols-4">
              <StatTile label="Shots" value={stats.shotCount} />
              <StatTile label="Raw rows" value={stats.rawRowCount} />
              <StatTile label="Sessions" value={stats.sessionCount} />
              <StatTile label="Clubs" value={stats.clubCount} />
            </div>
          </CardHeader>
        </Card>

        <DesktopShotDispersionMap
          shots={dispersionShots}
          currentViewLabel={mapScopeLabel}
          initialClub={filters.club}
        />

        <SavedShotViewsPanel data={featureData} />

        <div id="filters" className="scroll-mt-28">
          <ShotFilterToolbar
            initial={{
              q: filters.q,
              club: filters.club,
              sessionId: filters.sessionId,
              category: filters.category,
              from: filters.from,
              to: filters.to,
              sort: filters.sort,
              dir: filters.dir,
              group: filters.group,
            }}
            clubs={clubsForFilter.map((club) => ({ value: club, label: formatClubType(club) }))}
            sessions={sessionSummaries.map((session) => ({
              value: session.id,
              label: session.fileName ?? formatDate(session.date),
            }))}
            categories={categories.map((category) => ({
              value: category,
              label: formatSessionType(category),
            }))}
            sortOptions={shotSortMetrics.map((metric) => ({
              value: metric,
              label: shotSortLabels[metric],
            }))}
            resultLabel={`${integerFormatter.format(totalFilteredShots)} matching · ${PAGE_SIZE} per page`}
          />
        </div>

        <section id="sessions" className="scroll-mt-28">
          <div className="grid gap-4 lg:grid-cols-[1fr_0.65fr]">
            <Card>
              <CardHeader>
                <CardTitle>Session imports</CardTitle>
                <CardDescription>
                  Select a file to focus the map and shot explorer on that import.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div data-workbench-scope="shots-session-imports" className="mb-3">
                  <DesktopTableWorkbenchControls
                    viewKey="shots-session-imports"
                    scope="shots-session-imports"
                    currentViewLabel="Recent session imports"
                    resultLabel={`${integerFormatter.format(sessionSummaries.length)} imports`}
                    columns={shotSessionImportColumns}
                    suggestedViews={shotSessionSuggestedViews}
                    exportTableId="shots-session-imports"
                    exportFileName="forekinghell-shot-session-imports.csv"
                  />
                </div>
                <div
                  className="overflow-x-auto rounded-lg border"
                  aria-label="Session imports table"
                >
                  <Table
                    data-workbench-scope="shots-session-imports"
                    data-workbench-export-table="shots-session-imports"
                    aria-describedby="shots-session-imports-summary"
                  >
                    <TableCaption id="shots-session-imports-summary" className="sr-only">
                      Recent session import table showing file, date, session type and saved shot
                      count for each import.
                    </TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead
                          data-column="file"
                          className="sticky left-0 z-20 bg-card shadow-[1px_0_0_hsl(var(--border))]"
                        >
                          File
                        </TableHead>
                        <TableHead data-column="date">Date</TableHead>
                        <TableHead data-column="type">Type</TableHead>
                        <TableHead data-column="shots" className="text-right">
                          Shots
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessionSummaries.slice(0, 8).map((session) => {
                        const selected = filters.sessionId === session.id;
                        const href = sessionImportHref(filters, session.id);

                        return (
                          <TableRow
                            key={session.id}
                            tabIndex={0}
                            aria-selected={selected}
                            data-selected-session={selected ? "true" : undefined}
                            className={`focus-aaa outline-none ${selected ? "bg-primary/10" : ""}`}
                          >
                            <TableCell
                              data-column="file"
                              className={`sticky left-0 z-10 max-w-64 truncate font-medium shadow-[1px_0_0_hsl(var(--border))] ${
                                selected ? "bg-primary/10" : "bg-card"
                              }`}
                            >
                              <Link
                                href={href}
                                prefetch={false}
                                aria-current={selected ? "page" : undefined}
                                className="focus-aaa rounded-sm outline-none hover:underline"
                              >
                                {session.fileName ?? "Untitled import"}
                              </Link>
                            </TableCell>
                            <TableCell data-column="date">{formatDate(session.date)}</TableCell>
                            <TableCell data-column="type">
                              {formatSessionType(session.type)}
                            </TableCell>
                            <TableCell data-column="shots" className="text-right">
                              <Link
                                href={href}
                                prefetch={false}
                                className="focus-aaa rounded-sm font-semibold text-primary outline-none hover:underline"
                                aria-label={`Show ${integerFormatter.format(session.shotCount)} shots from ${session.fileName ?? formatDate(session.date)}`}
                              >
                                {integerFormatter.format(session.shotCount)}
                              </Link>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {sessionSummaries.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                            No imported sessions yet.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Raw CSV archive</CardTitle>
                <CardDescription>Non-shot rows retained for parser improvements.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row type</TableHead>
                      <TableHead className="text-right">Rows retained</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rowTypes.map((rowType) => (
                      <TableRow key={rowType.rowType}>
                        <TableCell className="font-medium">
                          {formatSessionType(rowType.rowType)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {integerFormatter.format(rowType.count)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {rowTypes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
                          No raw rows saved yet.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </section>

        <DesktopWorkbenchLayout
          scope="shots"
          rail={
            <DesktopInsightRail
              title="AI shot analyst"
              description="Use the current filter, table columns and visible rows as the evidence set."
              metrics={[
                {
                  label: "Matching rows",
                  value: integerFormatter.format(totalFilteredShots),
                  detail:
                    totalFilteredShots > 0
                      ? `${PAGE_SIZE} rows per page. Export uses the visible table columns.`
                      : "No rows match this filter; reset before asking for trend analysis.",
                  tone: totalFilteredShots > 0 ? "green" : "amber",
                },
                {
                  label: "Data scope",
                  value: integerFormatter.format(stats.shotCount),
                  detail: `${integerFormatter.format(stats.sessionCount)} sessions and ${integerFormatter.format(
                    stats.clubCount,
                  )} tracked clubs feed this page.`,
                  tone: stats.shotCount > 0 ? "sky" : "slate",
                },
                {
                  label: "Current view",
                  value: activeFilterChips.length > 0 ? "Filtered" : "All shots",
                  detail: currentViewLabel,
                  tone: activeFilterChips.length > 0 ? "amber" : "slate",
                },
              ]}
              evidence={[
                "The table is scoped to the signed-in player and current filters.",
                "Column control changes what is exported, not the underlying saved data.",
                "Low sample filters should be treated as low confidence in AI answers.",
              ]}
              prompts={commonAiPrompts("shots explorer")}
              actions={[
                {
                  label: "Compare sessions",
                  href: "/compare",
                  detail: "Build a before/after view from this evidence.",
                  icon: ArrowUpDown,
                },
                {
                  label: "Open bag impact",
                  href: "/bag",
                  detail: "See how shot rows affect club trust.",
                  icon: Flag,
                },
              ]}
            />
          }
        >
          <ShotPatternExplorer
            groups={buildShotPatternGroups(dispersionShots.map(serializePatternShot))}
          />

          <Card id="shots" className="scroll-mt-28">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Shot explorer</CardTitle>
                  <CardDescription>
                    {integerFormatter.format(totalFilteredShots)} matching rows. Showing page{" "}
                    {filters.page} of {totalPages}.
                  </CardDescription>
                </div>
                <Pagination className="mx-0 w-auto justify-end">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href={pageHref(filters, Math.max(1, filters.page - 1))}
                        aria-disabled={filters.page <= 1}
                        className={filters.page <= 1 ? "pointer-events-none opacity-50" : undefined}
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        href={pageHref(filters, Math.min(totalPages, filters.page + 1))}
                        aria-disabled={filters.page >= totalPages}
                        className={
                          filters.page >= totalPages ? "pointer-events-none opacity-50" : undefined
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
              <DesktopTableWorkbenchControls
                viewKey="shots"
                scope="shots"
                currentViewLabel={currentViewLabel}
                resultLabel={`${integerFormatter.format(totalFilteredShots)} rows`}
                columns={shotWorkbenchColumns}
                suggestedViews={shotSuggestedViews}
                exportTableId="shots"
                exportFileName="forekinghell-shots-view.csv"
                className="mt-2"
              />
            </CardHeader>
            <CardContent>
              <ShotsMasterDetailTable
                shots={desktopShotRows}
                sorts={desktopShotSorts}
                groupBy={filters.group}
              />
            </CardContent>
          </Card>
        </DesktopWorkbenchLayout>
      </div>
    </PageShell>
  );
}

type DispersionShot = {
  id: string;
  fileName: string | null;
  shotAt: Date;
  shotNumber: number | null;
  courseHoleNumber: number | null;
  courseHoleShotNumber: number | null;
  clubType: string;
  carryYd: number | null;
  totalYd: number | null;
  sideCarryYd: number | null;
  launchAngleDeg: number | null;
  launchDirectionDeg: number | null;
  spinAxis: number | null;
  ballSpeedMph: number | null;
  clubSpeedMph: number | null;
  apexFt: number | null;
  attackAngleDeg: number | null;
  clubPathDeg: number | null;
  faceAngleDeg: number | null;
  descentAngleDeg: number | null;
  smashFactor: number | null;
  sessionId: string;
  sessionLabel: string | null;
  sessionCourseName: string | null;
  playContext: string;
  shotShape: string | null;
  qualityTag: string | null;
  clubDataEstType: string | null;
  clubBrand: string | null;
  clubModel: string | null;
  sourceRawJson: Record<string, string>;
};

type RenderedShotShapeTrace = ShotShapeTrace & {
  sideCarryYd: number | null;
};

type ShotShapeMapModel = {
  plottedShots: DispersionShot[];
  shapeTraces: RenderedShotShapeTrace[];
  telemetryTraceCount: number;
  playableCount: number;
  averageCarry: number | null;
  maxCarry: number;
  maxSide: number;
};

function DesktopShotDispersionMap({
  shots,
  currentViewLabel,
  initialClub,
}: {
  shots: DispersionShot[];
  currentViewLabel: string;
  initialClub: string;
}) {
  const model = buildShotShapeMapModel(shots, 64);

  return (
    <Card id="dispersion-desktop" className="scroll-mt-28">
      <CardHeader>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <CardTitle>Top-down shot shape</CardTitle>
            <CardDescription>
              Fixed 0-250 yd and +/-75 yd reference frame. Estimated curves use launch direction;
              rows without start line fall back to landing lines. Select a landing point to inspect
              or remove that shot. {currentViewLabel}.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="w-fit">
            {model.telemetryTraceCount}/{model.shapeTraces.length} shaped
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <InteractiveDesktopShotMapContent
          key={currentViewLabel}
          shots={shots.map(serializeShotForInteractiveMap)}
          initialClub={initialClub}
        />
      </CardContent>
    </Card>
  );
}

function serializeShotForInteractiveMap(shot: DispersionShot): InteractiveShotShapeMapRow {
  return {
    ...serializeShotForMasterDetail(shot),
    shotAt: shot.shotAt.toISOString(),
    carryYd: shot.carryYd,
    sideCarryYd: shot.sideCarryYd,
    launchDirectionDeg: shot.launchDirectionDeg,
    spinAxis: shot.spinAxis,
  };
}

function buildShotShapeMapModel(shots: DispersionShot[], traceLimit: number): ShotShapeMapModel {
  const plottedShots = shots.filter(
    (shot) => isFiniteShotMetric(shot.carryYd) && isFiniteShotMetric(shot.sideCarryYd),
  );
  const maxCarry = SHOT_MAP_MAX_CARRY_YD;
  const maxSide = SHOT_MAP_MAX_SIDE_YD;
  const shapeTraces = plottedShots
    .slice(0, traceLimit)
    .map((shot) =>
      buildShotShapeTrace({
        id: shot.id,
        carryYd: shot.carryYd,
        sideCarryYd: shot.sideCarryYd,
        launchDirectionDeg: shot.launchDirectionDeg,
        spinAxis: shot.spinAxis,
        maxCarryYd: maxCarry,
        maxSideYd: maxSide,
      }),
    )
    .map((trace, index) =>
      trace
        ? {
            ...trace,
            sideCarryYd: plottedShots[index]?.sideCarryYd ?? null,
          }
        : null,
    )
    .filter((trace): trace is RenderedShotShapeTrace => trace !== null);

  return {
    plottedShots,
    shapeTraces,
    telemetryTraceCount: shapeTraces.filter((trace) => trace.source === "estimated").length,
    playableCount: plottedShots.filter((shot) => Math.abs(Number(shot.sideCarryYd)) <= 20).length,
    averageCarry: averageShotMetric(plottedShots.map((shot) => shot.carryYd)),
    maxCarry,
    maxSide,
  };
}

async function getShotDatabase(filters: ShotFilters) {
  try {
    return await getLiveShotDatabase(filters);
  } catch (error) {
    if (isPlaywrightE2eAuthBypassEnabled()) {
      reportServerFailure("shots_e2e_fallback", error, {
        "app.route": "/shots",
        "app.fallback": "empty_shot_database",
      });
      return emptyShotDatabase();
    }

    throw error;
  }
}

async function getLiveShotDatabase(filters: ShotFilters) {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const where = buildShotWhere(filters, userId);
  const mapWhere = buildShotWhere({ ...filters, club: "" }, userId);

  const [
    [shotCount],
    [rawRowCount],
    [sessionCount],
    clubRows,
    rowTypes,
    sessionRows,
    shotCountsBySession,
    rawCountsBySession,
    [filteredCount],
    savedShots,
    dispersionShots,
  ] = await Promise.all([
    db.select({ value: count() }).from(shots).where(eq(shots.userId, userId)),
    db.select({ value: count() }).from(importRows).where(eq(importRows.userId, userId)),
    db.select({ value: count() }).from(sessions).where(eq(sessions.userId, userId)),
    db
      .select({ type: clubs.type })
      .from(clubs)
      .where(eq(clubs.userId, userId))
      .orderBy(asc(clubs.type)),
    db
      .select({ rowType: importRows.rowType, count: count() })
      .from(importRows)
      .where(eq(importRows.userId, userId))
      .groupBy(importRows.rowType)
      .orderBy(asc(importRows.rowType)),
    db
      .select({
        id: sessions.id,
        fileName: sessions.fileName,
        type: sessions.type,
        courseName: sessions.courseName,
        date: sessions.date,
      })
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .orderBy(desc(sessions.date), asc(sessions.fileName)),
    db
      .select({ sessionId: shots.sessionId, count: count() })
      .from(shots)
      .where(eq(shots.userId, userId))
      .groupBy(shots.sessionId),
    db
      .select({ sessionId: importRows.sessionId, count: count() })
      .from(importRows)
      .where(eq(importRows.userId, userId))
      .groupBy(importRows.sessionId),
    db
      .select({ value: count() })
      .from(shots)
      .innerJoin(sessions, eq(shots.sessionId, sessions.id))
      .where(where),
    db
      .select({
        id: shots.id,
        fileName: sessions.fileName,
        shotAt: shots.shotAt,
        shotNumber: shots.shotNumber,
        courseHoleNumber: shots.courseHoleNumber,
        courseHoleShotNumber: shots.courseHoleShotNumber,
        clubType: shots.clubType,
        clubBrand: clubs.brand,
        clubModel: clubs.model,
        carryYd: shots.carryYd,
        totalYd: shots.totalYd,
        ballSpeedMph: shots.ballSpeedMph,
        clubSpeedMph: shots.clubSpeedMph,
        launchAngleDeg: shots.launchAngleDeg,
        launchDirectionDeg: shots.launchDirectionDeg,
        apexFt: shots.apexFt,
        sideCarryYd: shots.sideCarryYd,
        attackAngleDeg: shots.attackAngleDeg,
        clubPathDeg: shots.clubPathDeg,
        faceAngleDeg: shots.faceAngleDeg,
        descentAngleDeg: shots.descentAngleDeg,
        smashFactor: shots.smashFactor,
        clubDataEstType: shots.clubDataEstType,
      })
      .from(shots)
      .innerJoin(sessions, eq(shots.sessionId, sessions.id))
      .innerJoin(clubs, eq(shots.clubId, clubs.id))
      .where(where)
      .orderBy(...shotOrderBy(filters))
      .limit(PAGE_SIZE)
      .offset((filters.page - 1) * PAGE_SIZE),
    db
      .select({
        id: shots.id,
        fileName: sessions.fileName,
        shotAt: shots.shotAt,
        shotNumber: shots.shotNumber,
        courseHoleNumber: shots.courseHoleNumber,
        courseHoleShotNumber: shots.courseHoleShotNumber,
        clubType: shots.clubType,
        carryYd: shots.carryYd,
        totalYd: shots.totalYd,
        sideCarryYd: shots.sideCarryYd,
        launchAngleDeg: shots.launchAngleDeg,
        launchDirectionDeg: shots.launchDirectionDeg,
        spinAxis: shots.spinAxis,
        ballSpeedMph: shots.ballSpeedMph,
        clubSpeedMph: shots.clubSpeedMph,
        apexFt: shots.apexFt,
        attackAngleDeg: shots.attackAngleDeg,
        clubPathDeg: shots.clubPathDeg,
        faceAngleDeg: shots.faceAngleDeg,
        descentAngleDeg: shots.descentAngleDeg,
        smashFactor: shots.smashFactor,
        sessionId: shots.sessionId,
        sessionLabel: sessions.fileName,
        sessionCourseName: sessions.courseName,
        playContext: shots.playContext,
        shotShape: shots.shotShape,
        qualityTag: shots.qualityTag,
        clubDataEstType: shots.clubDataEstType,
        clubBrand: clubs.brand,
        clubModel: clubs.model,
        sourceRawJson: shots.sourceRawJson,
      })
      .from(shots)
      .innerJoin(sessions, eq(shots.sessionId, sessions.id))
      .innerJoin(clubs, eq(shots.clubId, clubs.id))
      .where(mapWhere)
      .orderBy(desc(shots.shotAt), desc(shots.shotNumber))
      .limit(90),
  ]);

  const shotCountBySessionId = new Map(
    shotCountsBySession.map((row) => [row.sessionId, row.count]),
  );
  const rawCountBySessionId = new Map(rawCountsBySession.map((row) => [row.sessionId, row.count]));
  const sessionSummaries = sessionRows.map((session) => ({
    ...session,
    shotCount: shotCountBySessionId.get(session.id) ?? 0,
    rawRowCount: rawCountBySessionId.get(session.id) ?? 0,
  }));

  return {
    stats: {
      shotCount: shotCount?.value ?? 0,
      rawRowCount: rawRowCount?.value ?? 0,
      sessionCount: sessionCount?.value ?? 0,
      clubCount: clubRows.filter((club) => isTrackedClubType(club.type)).length,
    },
    rowTypes,
    sessionSummaries,
    savedShots,
    dispersionShots,
    totalFilteredShots: filteredCount?.value ?? 0,
    clubsForFilter: [...new Set(clubRows.map((club) => club.type))].filter(isTrackedClubType),
    categories: ["tee", "approach", "pitch", "chip", "full", "recovery"],
  };
}

function serializePatternShot(shot: DispersionShot) {
  const source = shot.sourceRawJson ?? {};
  const ball =
    source.Ball ?? source.ball ?? source["Ball Model"] ?? source.ball_model ?? "Not recorded";
  return {
    id: shot.id,
    shotAt: shot.shotAt.toISOString(),
    sessionId: shot.sessionId,
    sessionLabel: shot.sessionCourseName ?? shot.sessionLabel ?? "Imported session",
    clubType: shot.clubType,
    carryYd: shot.carryYd,
    sideCarryYd: shot.sideCarryYd,
    launchDirectionDeg: shot.launchDirectionDeg,
    spinAxis: shot.spinAxis,
    ballSpeedMph: shot.ballSpeedMph,
    smashFactor: shot.smashFactor,
    shotShape: shot.shotShape,
    qualityTag: shot.qualityTag,
    playContext: shot.playContext,
    measuredStatus: shot.clubDataEstType ? "estimated" : "measured",
    equipment:
      [shot.clubBrand, shot.clubModel].filter(Boolean).join(" ") || formatClubType(shot.clubType),
    ball,
  };
}

function emptyShotDatabase() {
  return {
    stats: {
      shotCount: 0,
      rawRowCount: 0,
      sessionCount: 0,
      clubCount: 0,
    },
    rowTypes: [],
    sessionSummaries: [],
    savedShots: [],
    dispersionShots: [],
    totalFilteredShots: 0,
    clubsForFilter: [],
    categories: ["tee", "approach", "pitch", "chip", "full", "recovery"],
  };
}

function buildShotWhere(filters: ShotFilters, userId: string) {
  const clauses = [eq(shots.userId, userId), eq(sessions.userId, userId)];

  if (filters.club) clauses.push(eq(shots.clubType, filters.club));
  if (filters.sessionId) clauses.push(eq(shots.sessionId, filters.sessionId));
  if (filters.category) clauses.push(eq(shots.shotCategory, filters.category));
  if (filters.q)
    clauses.push(
      sql`(${sessions.fileName} ilike ${`%${filters.q}%`} or ${sessions.courseName} ilike ${`%${filters.q}%`})`,
    );
  if (filters.from) clauses.push(gte(shots.shotAt, new Date(`${filters.from}T00:00:00.000Z`)));
  if (filters.to) clauses.push(lte(shots.shotAt, new Date(`${filters.to}T23:59:59.999Z`)));

  return and(...clauses);
}

function shotOrderBy(filters: ShotFilters) {
  if (filters.sort === "recent") {
    return [desc(shots.shotAt), asc(sessions.fileName), asc(shots.shotNumber)];
  }

  const column = shotSortColumn(filters.sort);
  const primarySort =
    filters.dir === "desc" ? sql`${column} desc nulls last` : sql`${column} asc nulls last`;

  return [primarySort, desc(shots.shotAt), asc(sessions.fileName), asc(shots.shotNumber)];
}

function shotSortColumn(sort: Exclude<ShotSortMetric, "recent">) {
  switch (sort) {
    case "shot":
      return shots.shotNumber;
    case "carry":
      return shots.carryYd;
    case "total":
      return shots.totalYd;
    case "side":
      return shots.sideCarryYd;
    case "launch":
      return shots.launchAngleDeg;
    case "ballSpeed":
      return shots.ballSpeedMph;
    case "clubSpeed":
      return shots.clubSpeedMph;
    case "launchDirection":
      return shots.launchDirectionDeg;
    case "apex":
      return shots.apexFt;
    case "attack":
      return shots.attackAngleDeg;
    case "path":
      return shots.clubPathDeg;
    case "face":
      return shots.faceAngleDeg;
    case "descent":
      return shots.descentAngleDeg;
    case "smash":
      return shots.smashFactor;
  }
}

function parseFilters(params: Awaited<SearchParams>): ShotFilters {
  const page = Math.max(1, Number(first(params.page)) || 1);
  const sortParam = first(params.sort);
  const sort = isShotSortMetric(sortParam) ? sortParam : "recent";
  const dir = first(params.dir) === "asc" ? "asc" : "desc";
  const groupParam = first(params.group);
  const group = groupParam === "club" || groupParam === "session" ? groupParam : "none";

  return {
    page,
    club: allToEmpty(first(params.club)),
    sessionId: allToEmpty(first(params.sessionId)),
    category: allToEmpty(first(params.category)),
    q: first(params.q).trim().slice(0, 120),
    from: dateParam(first(params.from)),
    to: dateParam(first(params.to)),
    sort,
    dir,
    group,
  };
}

function allToEmpty(value: string) {
  return value === "__all" ? "" : value;
}

function pageHref(filters: ShotFilters, page: number) {
  return shotsHref({ ...filters, page });
}

function buildShotFilterSummary(
  filters: ShotFilters,
  clubsForFilter: string[],
  sessionSummaries: Array<{ id: string; fileName: string | null; date: Date }>,
) {
  const chips: Array<{ label: string; href: string }> = [];
  const session = sessionSummaries.find((item) => item.id === filters.sessionId);

  if (filters.q) chips.push({ label: `${filters.q} x`, href: filterHref(filters, "q") });
  if (filters.club && clubsForFilter.includes(filters.club)) {
    chips.push({ label: `${formatClubType(filters.club)} x`, href: filterHref(filters, "club") });
  }
  if (filters.sessionId) {
    chips.push({
      label: `${session?.fileName ?? (session ? formatDate(session.date) : "Session")} x`,
      href: filterHref(filters, "sessionId"),
    });
  }
  if (filters.category) {
    chips.push({
      label: `${formatSessionType(filters.category)} x`,
      href: filterHref(filters, "category"),
    });
  }
  if (filters.from)
    chips.push({ label: `From ${filters.from} x`, href: filterHref(filters, "from") });
  if (filters.to) chips.push({ label: `To ${filters.to} x`, href: filterHref(filters, "to") });
  if (filters.sort !== "recent") {
    chips.push({
      label: `${shotSortLabels[filters.sort]} ${sortDirectionLabel(filters.dir).toLowerCase()} x`,
      href: filterHref(filters, "sort"),
    });
  }

  return chips;
}

function buildShotCurrentViewLabel(
  filters: ShotFilters,
  chips: Array<{ label: string; href: string }>,
) {
  if (chips.length > 0) {
    return chips.map((chip) => chip.label.replace(/\s*x$/, "")).join(" + ");
  }

  if (filters.sort !== "recent") {
    return `${shotSortLabels[filters.sort]} · ${sortDirectionLabel(filters.dir)}`;
  }

  return "All shots · newest first";
}

function filterHref(filters: ShotFilters, omitKey: keyof ShotFilters) {
  const next = { ...filters, page: 1 };

  switch (omitKey) {
    case "club":
      next.club = "";
      break;
    case "sessionId":
      next.sessionId = "";
      break;
    case "category":
      next.category = "";
      break;
    case "q":
      next.q = "";
      break;
    case "from":
      next.from = "";
      break;
    case "to":
      next.to = "";
      break;
    case "sort":
    case "dir":
      next.sort = "recent";
      next.dir = "desc";
      break;
    case "page":
      next.page = 1;
      break;
    case "group":
      next.group = "none";
      break;
  }

  return shotsHref(next);
}

function shotsHref(filters: ShotFilters) {
  const params = new URLSearchParams();

  if (filters.page > 1) params.set("page", filters.page.toString());
  if (filters.club) params.set("club", filters.club);
  if (filters.sessionId) params.set("sessionId", filters.sessionId);
  if (filters.category) params.set("category", filters.category);
  if (filters.q) params.set("q", filters.q);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.group !== "none") params.set("group", filters.group);
  if (filters.sort !== "recent") {
    params.set("sort", filters.sort);
    if (filters.dir !== "desc") params.set("dir", filters.dir);
  }

  const query = params.toString();
  return query ? `/shots?${query}` : "/shots";
}

function sessionImportHref(
  filters: ShotFilters,
  sessionId: string,
  fragment = "dispersion-desktop",
) {
  return `${shotsHref({
    ...filters,
    page: 1,
    club: "",
    sessionId,
    category: "",
    q: "",
    from: "",
    to: "",
    sort: "recent",
    dir: "desc",
  })}#${fragment}`;
}

function sortHref(filters: ShotFilters, sort: ShotSortMetric) {
  const dir = filters.sort === sort && filters.dir === "desc" ? "asc" : "desc";
  return shotsHref({ ...filters, page: 1, sort, dir });
}

function buildShotTableSorts(filters: ShotFilters): ShotTableSort[] {
  const columns: Array<Pick<ShotTableSort, "metric" | "label">> = [
    { metric: "shot", label: "Shot" },
    { metric: "carry", label: "Carry" },
    { metric: "total", label: "Total" },
    { metric: "side", label: "Side" },
    { metric: "launch", label: "Launch" },
    { metric: "ballSpeed", label: "Ball mph" },
  ];

  return columns.map((item) => ({
    ...item,
    href: sortHref(filters, item.metric),
    active: filters.sort === item.metric,
    dir: filters.sort === item.metric ? filters.dir : "desc",
  }));
}

function serializeShotForMasterDetail(shot: {
  id: string;
  fileName: string | null;
  shotAt: Date;
  shotNumber: number | null;
  courseHoleNumber: number | null;
  courseHoleShotNumber: number | null;
  clubType: string;
  clubBrand: string | null;
  clubModel: string | null;
  carryYd: number | null;
  totalYd: number | null;
  ballSpeedMph: number | null;
  clubSpeedMph: number | null;
  launchAngleDeg: number | null;
  launchDirectionDeg: number | null;
  apexFt: number | null;
  sideCarryYd: number | null;
  attackAngleDeg: number | null;
  clubPathDeg: number | null;
  faceAngleDeg: number | null;
  descentAngleDeg: number | null;
  smashFactor: number | null;
  clubDataEstType: string | null;
}): ShotMasterDetailRow {
  return {
    id: shot.id,
    shotAtLabel: formatDate(shot.shotAt),
    fileNameLabel: shot.fileName ?? "--",
    shotNumberLabel: shot.shotNumber?.toString() ?? "--",
    holeLabel: formatHole(shot.courseHoleNumber, shot.courseHoleShotNumber),
    clubLabel: formatShotClub(shot),
    clubTypeLabel: formatClubType(shot.clubType),
    clubType: shot.clubType,
    carryLabel: formatMetric(shot.carryYd),
    totalLabel: formatMetric(shot.totalYd),
    sideLabel: formatMetric(shot.sideCarryYd),
    launchLabel: formatMetric(shot.launchAngleDeg),
    ballSpeedLabel: formatMetric(shot.ballSpeedMph),
    clubSpeedLabel: formatMetric(shot.clubSpeedMph),
    launchDirectionLabel: formatMetric(shot.launchDirectionDeg),
    apexLabel: formatMetric(shot.apexFt),
    attackLabel: formatMetric(shot.attackAngleDeg),
    pathLabel: formatMetric(shot.clubPathDeg),
    faceLabel: formatMetric(shot.faceAngleDeg),
    descentLabel: formatMetric(shot.descentAngleDeg),
    smashLabel: formatMetric(shot.smashFactor),
    estimateLabel: shot.clubDataEstType ?? "--",
    sideTone: sideCarryTone(shot.sideCarryYd),
  };
}

function sideCarryTone(value: number | null): ShotMasterDetailRow["sideTone"] {
  if (value === null) {
    return "slate";
  }

  const offline = Math.abs(value);

  if (offline <= 8) {
    return "green";
  }

  if (offline <= 20) {
    return "amber";
  }

  return "red";
}

function sortDirectionLabel(dir: ShotSortDirection) {
  return dir === "desc" ? "High-low" : "Low-high";
}

function isShotSortMetric(value: string): value is ShotSortMetric {
  return shotSortMetrics.includes(value as ShotSortMetric);
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function dateParam(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <Item variant="outline" size="sm" className="h-full items-start bg-muted/20" data-shot-stat>
      <ItemContent>
        <ItemDescription className="font-medium">{label}</ItemDescription>
        <ItemTitle className="mt-1 text-3xl font-semibold tracking-normal">
          {integerFormatter.format(value)}
        </ItemTitle>
      </ItemContent>
    </Item>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function formatMetric(value: number | null) {
  return value === null ? "--" : numberFormatter.format(value);
}

function isFiniteShotMetric(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function averageShotMetric(values: Array<number | null>) {
  const finite = values.filter(isFiniteShotMetric);

  if (finite.length === 0) {
    return null;
  }

  return finite.reduce((total, value) => total + value, 0) / finite.length;
}

function formatSessionType(value: string) {
  if (value === "real_round") return "Real round";
  if (value === "simulated_course") return "Sim course";
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatHole(holeNumber: number | null, holeShotNumber: number | null) {
  if (!holeNumber) return "--";
  return holeShotNumber ? `${holeNumber}.${holeShotNumber}` : holeNumber.toString();
}

function formatShotClub(shot: {
  clubType: string;
  clubBrand: string | null;
  clubModel: string | null;
}) {
  return formatClubModelName({ type: shot.clubType, brand: shot.clubBrand, model: shot.clubModel });
}
