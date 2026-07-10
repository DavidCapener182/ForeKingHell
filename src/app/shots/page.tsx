import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Flag,
  Search,
  Upload,
} from "lucide-react";
import { and, asc, count, desc, eq, gte, lte, sql } from "drizzle-orm";

import { DateFilterPopover } from "@/components/app/date-filter-popover";
import {
  DesktopInsightRail,
  DesktopTableWorkbenchControls,
  DesktopWorkbenchLayout,
  commonAiPrompts,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { SavedShotViewsPanel } from "@/components/features/feature-panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  ActiveFilterChips,
  CompactReadoutGrid,
  DataPair,
  DataTableFrame,
  MobileAccordionSection,
  MobileCompactPageHeader,
  MobileFilterSheet,
  MobileDataCard,
  MobileDataList,
  MobileSectionChips,
  PageShell,
  StickyMobileAction,
} from "@/components/premium";
import { MobileRouteHeader } from "@/components/mobile-sports";
import { MobileMetricStrip } from "@/components/visuals/mobile-metric-strip";
import { ShotTraceMotif } from "@/components/visuals/page-artwork";
import {
  ShotsMasterDetailTable,
  type ShotMasterDetailRow,
  type ShotTableSort,
} from "@/app/shots/shots-master-detail-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export const dynamic = "force-dynamic";

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
  const filters = parseFilters(await searchParams);
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
  const activeFilterChips = buildActiveFilterChips(filters, clubsForFilter, sessionSummaries);
  const currentViewLabel = buildShotCurrentViewLabel(filters, activeFilterChips);
  const desktopShotRows = savedShots.map(serializeShotForMasterDetail);
  const desktopShotSorts = buildShotTableSorts(filters);
  const filterForm = (
    <ShotFilterFields
      filters={filters}
      clubsForFilter={clubsForFilter}
      sessionSummaries={sessionSummaries}
      categories={categories}
    />
  );

  return (
    <PageShell>
      <MobileRouteHeader title="Analyse" group="analyse" activeKey="shots" />

      <div className="hidden items-center justify-between gap-4 sm:flex">
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
              <span className="hidden sm:inline">Import CSV</span>
              <span className="sm:hidden">Import</span>
            </Link>
          </Button>
        </div>
      </div>

      <MobileCompactPageHeader
        eyebrow={
          <Badge className="w-fit bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
            Explorer
          </Badge>
        }
        title="Your shots"
        description="Filter the archive by club, session, date, shot category, or file name."
        metricLabel="Shots"
        metricValue={integerFormatter.format(stats.shotCount)}
        metricDetail={`${integerFormatter.format(totalFilteredShots)} matching`}
        action={
          <Button
            asChild
            size="sm"
            className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]"
          >
            <Link href="#filters">Filter</Link>
          </Button>
        }
      />

      <MobileMetricStrip
        items={[
          {
            label: "Shots",
            value: integerFormatter.format(stats.shotCount),
            detail: "Saved",
            tone: "green",
          },
          {
            label: "Sessions",
            value: integerFormatter.format(stats.sessionCount),
            detail: "Imports",
            tone: "sky",
          },
          {
            label: "Clubs",
            value: integerFormatter.format(stats.clubCount),
            detail: "Tracked",
            tone: "amber",
          },
          {
            label: "Audit",
            value: integerFormatter.format(stats.rawRowCount),
            detail: "File rows",
            tone: "slate",
          },
        ]}
      />

      <header className="premium-hero hidden p-5 sm:block sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-2">
            <Badge className="w-fit bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              Explorer
            </Badge>
            <h1 className="text-4xl font-semibold tracking-normal text-balance sm:text-5xl">
              Your shots
            </h1>
            <p className="text-base leading-7 text-muted-foreground">
              Filter the archive by club, session, date, shot category, or file name.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[520px]">
            <StatTile label="Shots" value={stats.shotCount} />
            <StatTile label="Raw rows" value={stats.rawRowCount} />
            <StatTile label="Sessions" value={stats.sessionCount} />
            <StatTile label="Clubs" value={stats.clubCount} />
          </div>
        </div>
      </header>

      <MobileSectionChips
        items={[
          { label: "Import", href: "/import" },
          { label: "Dispersion", href: "#dispersion" },
          { label: "Filters", href: "#filters" },
          { label: "Sessions", href: "#sessions" },
          { label: "Shots", href: "#shots" },
        ]}
      />

      <MobileShotDispersionMap
        shots={dispersionShots}
        filters={filters}
        clubsForFilter={clubsForFilter}
      />

      <div id="filters" className="grid gap-3 scroll-mt-28">
        <MobileFilterSheet activeCount={activeFilterChips.length}>
          <form className="grid gap-3">
            {filterForm}
            <div className="grid grid-cols-2 gap-2">
              <Button type="submit">Apply</Button>
              <Button asChild variant="outline">
                <Link href="/shots">Reset</Link>
              </Button>
            </div>
          </form>
        </MobileFilterSheet>
        <ActiveFilterChips items={activeFilterChips} className="sm:hidden" />
      </div>

      <SavedShotViewsPanel data={featureData} />

      <Card className="premium-card hidden sm:block">
        <CardHeader>
          <CardTitle>Find shots</CardTitle>
          <CardDescription>
            {PAGE_SIZE} rows per page, scoped to the current player.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="apple-panel grid gap-3 p-3 md:grid-cols-3 xl:grid-cols-6">
            {filterForm}
            <div className="flex gap-2 md:col-span-3 xl:col-span-6">
              <Button type="submit">Apply filters</Button>
              <Button asChild variant="outline">
                <Link href="/shots">Reset</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section id="sessions" className="order-3 scroll-mt-28 sm:order-none">
        <MobileAccordionSection
          title="Session file audit"
          description="Import details stay available without blocking the shot feed."
          count={`${integerFormatter.format(sessionSummaries.length)} sessions`}
        >
          <MobileDataList>
            {sessionSummaries.slice(0, 5).length > 0 ? (
              sessionSummaries.slice(0, 5).map((session) => (
                <MobileDataCard
                  key={session.id}
                  href={isRoundSession(session.type) ? `/rounds/${session.id}` : undefined}
                  title={session.fileName ?? "Untitled import"}
                  subtitle={formatDate(session.date)}
                  action={<Badge variant="secondary">{formatSessionType(session.type)}</Badge>}
                >
                  <DataPair label="Shots" value={integerFormatter.format(session.shotCount)} />
                  <DataPair
                    label="File rows"
                    value={integerFormatter.format(session.rawRowCount)}
                  />
                </MobileDataCard>
              ))
            ) : (
              <div className="apple-panel p-6 text-center text-sm text-muted-foreground">
                No imported sessions yet.
              </div>
            )}
          </MobileDataList>
          {rowTypes.length > 0 ? (
            <details className="mt-3 rounded-lg border bg-[#F5F6F4] px-3 py-2 text-sm">
              <summary className="cursor-pointer list-none font-semibold text-emerald-700 [&::-webkit-details-marker]:hidden">
                File audit
              </summary>
              <div className="mt-2 grid gap-2">
                {rowTypes.map((rowType) => (
                  <DataPair
                    key={rowType.rowType}
                    label={rowType.rowType}
                    value={integerFormatter.format(rowType.count)}
                  />
                ))}
              </div>
            </details>
          ) : null}
        </MobileAccordionSection>

        <div className="hidden gap-4 sm:grid lg:grid-cols-[1fr_0.65fr]">
          <Card className="premium-card">
            <CardHeader>
              <CardTitle>Session imports</CardTitle>
              <CardDescription>
                Saved files, CSV dates, shot rows, and retained raw rows.
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
              <DataTableFrame
                label="Session imports table"
                stickyFirstColumn
                mobile={
                  <MobileDataList>
                    {sessionSummaries.slice(0, 8).length > 0 ? (
                      sessionSummaries.slice(0, 8).map((session) => (
                        <MobileDataCard
                          key={session.id}
                          href={isRoundSession(session.type) ? `/rounds/${session.id}` : undefined}
                          title={session.fileName ?? "Untitled import"}
                          subtitle={formatDate(session.date)}
                          action={
                            <Badge variant="secondary">{formatSessionType(session.type)}</Badge>
                          }
                        >
                          <DataPair
                            label="Shots"
                            value={integerFormatter.format(session.shotCount)}
                          />
                          <DataPair
                            label="File rows"
                            value={integerFormatter.format(session.rawRowCount)}
                          />
                        </MobileDataCard>
                      ))
                    ) : (
                      <div className="apple-panel p-6 text-center text-sm text-muted-foreground">
                        No imported sessions yet.
                      </div>
                    )}
                  </MobileDataList>
                }
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
                        className="sticky left-0 z-20 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
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
                    {sessionSummaries.slice(0, 8).map((session) => (
                      <TableRow key={session.id} tabIndex={0} className="focus-aaa outline-none">
                        <TableCell
                          data-column="file"
                          className="sticky left-0 z-10 max-w-64 truncate bg-white font-medium shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                        >
                          {isRoundSession(session.type) ? (
                            <Link href={`/rounds/${session.id}`} className="hover:underline">
                              {session.fileName ?? "Untitled import"}
                            </Link>
                          ) : (
                            (session.fileName ?? "Untitled import")
                          )}
                        </TableCell>
                        <TableCell data-column="date">{formatDate(session.date)}</TableCell>
                        <TableCell data-column="type">{formatSessionType(session.type)}</TableCell>
                        <TableCell data-column="shots" className="text-right">
                          {integerFormatter.format(session.shotCount)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {sessionSummaries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                          No imported sessions yet.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </DataTableFrame>
            </CardContent>
          </Card>

          <Card className="premium-card">
            <CardHeader>
              <CardTitle>Raw CSV archive</CardTitle>
              <CardDescription>Non-shot rows retained for parser improvements.</CardDescription>
            </CardHeader>
            <CardContent>
              {rowTypes.length > 0 ? (
                <CompactReadoutGrid
                  columnsClassName="sm:grid-cols-2"
                  items={rowTypes.map((rowType) => ({
                    label: rowType.rowType,
                    value: integerFormatter.format(rowType.count),
                    detail: "Raw rows retained",
                    tone: "slate",
                  }))}
                />
              ) : (
                <p className="text-sm text-muted-foreground">No raw rows saved yet.</p>
              )}
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
        <DesktopShotDispersionMap shots={dispersionShots} currentViewLabel={currentViewLabel} />

        <Card id="shots" className="premium-card order-2 scroll-mt-28 sm:order-none">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Shot explorer</CardTitle>
                <CardDescription>
                  {integerFormatter.format(totalFilteredShots)} matching rows. Showing page{" "}
                  {filters.page} of {totalPages}.
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm" aria-disabled={filters.page <= 1}>
                  <Link href={pageHref(filters, Math.max(1, filters.page - 1))}>
                    <ChevronLeft className="size-4" /> Previous
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  aria-disabled={filters.page >= totalPages}
                >
                  <Link href={pageHref(filters, Math.min(totalPages, filters.page + 1))}>
                    Next <ChevronRight className="size-4" />
                  </Link>
                </Button>
              </div>
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
            <ShotsMasterDetailTable shots={desktopShotRows} sorts={desktopShotSorts} />
            <div className="min-w-0 overflow-hidden sm:hidden">
              <MobileDataList>
                {savedShots.length > 0 ? (
                  savedShots.map((shot) => (
                    <MobileDataCard
                      key={shot.id}
                      title={`${formatShotClub(shot)} ${formatMetric(shot.carryYd)} carry`}
                      subtitle={`${formatDate(shot.shotAt)} - ${shot.fileName ?? "No file"}`}
                      action={
                        <Badge variant="outline">
                          {formatHole(shot.courseHoleNumber, shot.courseHoleShotNumber)}
                        </Badge>
                      }
                    >
                      <DataPair label="Offline" value={formatSignedYards(shot.sideCarryYd)} />
                      <DataPair label="Ball speed" value={formatSpeed(shot.ballSpeedMph)} />
                      <DataPair label="Outcome" value={shotOutcomeLabel(shot.sideCarryYd)} />
                      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-lg bg-white/85 px-3 py-2 ring-1 ring-slate-200/80">
                        <span
                          className={`size-2.5 rounded-full ring-4 ${shotQualityDot(shot.sideCarryYd)}`}
                          aria-hidden="true"
                        />
                        <ShotTraceMotif className="h-10 w-full text-emerald-700/70" />
                        <Button asChild variant="outline" size="sm">
                          <Link href="/compare" prefetch={false}>
                            Compare
                          </Link>
                        </Button>
                      </div>
                      <DataPair label="Shot" value={shot.shotNumber ?? "--"} />
                      <DataPair label="Total" value={formatMetric(shot.totalYd)} />
                      <details className="rounded-lg bg-[#F5F6F4] px-3 py-2 text-sm">
                        <summary className="cursor-pointer list-none font-semibold text-emerald-700 [&::-webkit-details-marker]:hidden">
                          Advanced
                        </summary>
                        <div className="mt-2 grid gap-2">
                          <DataPair label="Launch" value={formatMetric(shot.launchAngleDeg)} />
                          <DataPair label="Smash" value={formatMetric(shot.smashFactor)} />
                          <DataPair label="Apex" value={formatMetric(shot.apexFt)} />
                          <DataPair label="Attack" value={formatMetric(shot.attackAngleDeg)} />
                          <DataPair label="Path" value={formatMetric(shot.clubPathDeg)} />
                          <DataPair label="Face" value={formatMetric(shot.faceAngleDeg)} />
                        </div>
                      </details>
                    </MobileDataCard>
                  ))
                ) : (
                  <div className="apple-panel p-6 text-center text-sm text-muted-foreground">
                    No shots match these filters.
                  </div>
                )}
              </MobileDataList>
            </div>
          </CardContent>
        </Card>
      </DesktopWorkbenchLayout>
      <StickyMobileAction>
        <Button asChild className="w-full rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
          <Link href="#filters">Filter / sort shots</Link>
        </Button>
      </StickyMobileAction>
    </PageShell>
  );
}

type DispersionShot = {
  id: string;
  shotAt: Date;
  clubType: string;
  carryYd: number | null;
  sideCarryYd: number | null;
  launchDirectionDeg: number | null;
  spinAxis: number | null;
  ballSpeedMph: number | null;
  smashFactor: number | null;
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

function MobileShotDispersionMap({
  shots,
  filters,
  clubsForFilter,
}: {
  shots: DispersionShot[];
  filters: ShotFilters;
  clubsForFilter: string[];
}) {
  const model = buildShotShapeMapModel(shots, 36);
  const clubCounts = clubsForFilter.map((clubType) => ({
    clubType,
    count: shots.filter((shot) => shot.clubType === clubType).length,
  }));

  return (
    <section id="dispersion" className="grid gap-3 scroll-mt-28 sm:hidden">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-normal text-foreground">Dispersion map</h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Recent matching shots with inferred top-down shape where telemetry allows.
          </p>
        </div>
        <Badge variant="secondary">
          {model.telemetryTraceCount}/{model.shapeTraces.length} shaped
        </Badge>
      </div>
      <div
        aria-label="Club dispersion filters"
        tabIndex={0}
        className="focus-aaa -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 outline-none"
      >
        <Link
          href={shotsHref({ ...filters, page: 1, club: "" })}
          prefetch={false}
          className={`focus-aaa min-h-11 shrink-0 rounded-full border px-4 py-2 text-sm font-semibold outline-none ${
            filters.club
              ? "border-border bg-white/80 text-muted-foreground"
              : "border-emerald-950 bg-emerald-950 text-white"
          }`}
        >
          All
        </Link>
        {clubCounts
          .filter((club) => club.count > 0)
          .map((club) => {
            const active = filters.club === club.clubType;

            return (
              <Link
                key={club.clubType}
                href={shotsHref({ ...filters, page: 1, club: club.clubType })}
                prefetch={false}
                className={`focus-aaa min-h-11 shrink-0 rounded-full border px-4 py-2 text-sm font-semibold outline-none ${
                  active
                    ? "border-emerald-950 bg-emerald-950 text-white"
                    : "border-border bg-white/80 text-muted-foreground"
                }`}
              >
                {formatClubType(club.clubType)}
              </Link>
            );
          })}
      </div>
      <ShotShapeMapField
        model={model}
        className="apple-panel-strong overflow-hidden rounded-lg"
        mediaClassName="aspect-[4/3] min-h-[14rem] max-h-[15rem]"
        metricClassName="bottom-[4.5rem]"
        imageSizes="calc(100vw - 2rem)"
      />
      <MobileDataList>
        {model.plottedShots.slice(0, 3).map((shot) => (
          <MobileDataCard
            key={`fallback-${shot.id}`}
            title={`${formatClubType(shot.clubType)} ${formatYards(shot.carryYd)}`}
            subtitle={formatDate(shot.shotAt)}
            action={<Badge variant="outline">{formatSignedYards(Number(shot.sideCarryYd))}</Badge>}
          >
            <DataPair label="Ball speed" value={formatMetric(shot.ballSpeedMph)} />
            <DataPair label="Smash" value={formatMetric(shot.smashFactor)} />
            <DataPair
              label="Shape"
              value={formatShapeTelemetry(shot.launchDirectionDeg, shot.spinAxis)}
            />
          </MobileDataCard>
        ))}
      </MobileDataList>
    </section>
  );
}

function DesktopShotDispersionMap({
  shots,
  currentViewLabel,
}: {
  shots: DispersionShot[];
  currentViewLabel: string;
}) {
  const model = buildShotShapeMapModel(shots, 64);
  const latestRows = model.plottedShots.slice(0, 6);

  return (
    <Card id="dispersion-desktop" className="premium-card hidden scroll-mt-28 sm:block">
      <CardHeader>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <CardTitle>Top-down shot shape</CardTitle>
            <CardDescription>
              Estimated curves use launch direction. Rows without start line fall back to landing
              lines. {currentViewLabel}.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="w-fit">
            {model.telemetryTraceCount}/{model.shapeTraces.length} shaped
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <ShotShapeMapField
          model={model}
          className="overflow-hidden rounded-lg border border-emerald-950/10 bg-[#eef6ef]"
          mediaClassName="aspect-[16/9] min-h-[28rem]"
          imageSizes="(min-width: 1280px) 58vw, 100vw"
          showMetrics={false}
        />
        <div className="grid content-start gap-4">
          <CompactReadoutGrid
            columnsClassName="sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3"
            items={[
              {
                label: "Carry",
                value: formatYards(model.averageCarry),
                detail: "Average plotted carry",
                tone: "green",
              },
              {
                label: "Playable",
                value: `${model.playableCount}/${model.plottedShots.length || 0}`,
                detail: "Inside 20 yd offline",
                tone: "sky",
              },
              {
                label: "Shape",
                value: `${model.telemetryTraceCount}/${model.shapeTraces.length}`,
                detail: "Launch-derived curves",
                tone: "amber",
              },
            ]}
          />
          <DataTableFrame label="Latest inferred shot shape rows" stickyFirstColumn>
            <Table
              data-workbench-scope="shots-shape-evidence"
              aria-describedby="shots-shape-evidence-summary"
            >
              <TableCaption id="shots-shape-evidence-summary" className="sr-only">
                Latest inferred shot-shape evidence table showing shot, side distance and launch
                telemetry used for the desktop shot-shape map.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead data-column="shot">Shot</TableHead>
                  <TableHead data-column="side">Side</TableHead>
                  <TableHead data-column="shape">Shape evidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {latestRows.map((shot) => (
                  <TableRow
                    key={`desktop-shape-${shot.id}`}
                    tabIndex={0}
                    className="focus-aaa outline-none"
                  >
                    <TableCell data-column="shot" className="font-medium">
                      <span className="block">{formatClubType(shot.clubType)}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatYards(shot.carryYd)} · {formatDate(shot.shotAt)}
                      </span>
                    </TableCell>
                    <TableCell data-column="side">{formatSignedYards(shot.sideCarryYd)}</TableCell>
                    <TableCell data-column="shape">
                      {formatShapeTelemetry(shot.launchDirectionDeg, shot.spinAxis)}
                    </TableCell>
                  </TableRow>
                ))}
                {latestRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                      No carry and side data match this filter yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </DataTableFrame>
          <p className="text-sm leading-6 text-muted-foreground">
            This is an inferred top-down path, not measured ball-flight tracking. Landing position
            uses carry and side; curved shape requires launch direction.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ShotShapeMapField({
  model,
  className,
  mediaClassName,
  metricClassName,
  imageSizes,
  showMetrics = true,
}: {
  model: ShotShapeMapModel;
  className: string;
  mediaClassName: string;
  metricClassName?: string;
  imageSizes: string;
  showMetrics?: boolean;
}) {
  return (
    <div className={className}>
      <div
        data-media-container
        className={`relative overflow-hidden rounded-lg bg-[#eef6ef] ${mediaClassName}`}
      >
        <Image
          src="/assets/fairway-dispersion-bg.svg"
          alt=""
          fill
          loading="eager"
          sizes={imageSizes}
          className="object-cover opacity-95"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(5,44,23,0.08))]" />
        {model.shapeTraces.length > 0 ? (
          <svg
            aria-hidden="true"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 z-[1] h-full w-full"
          >
            <path
              d="M 50 88 L 50 12"
              fill="none"
              stroke="rgba(15,23,42,0.18)"
              strokeDasharray="2 3"
              strokeLinecap="round"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
            {model.shapeTraces.map((trace) => (
              <path
                key={trace.id}
                d={trace.path}
                fill="none"
                stroke={traceStroke(trace.sideCarryYd, trace.source)}
                strokeLinecap="round"
                strokeWidth={trace.source === "straight" ? "1.7" : "2.35"}
                vectorEffect="non-scaling-stroke"
                opacity={trace.source === "straight" ? 0.42 : 0.72}
              />
            ))}
            <circle
              cx="50"
              cy="88"
              r="1.3"
              fill="#ffffff"
              stroke="#0f172a"
              strokeWidth="1.4"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : null}
        {model.plottedShots.length > 0 ? (
          model.plottedShots.slice(0, 80).map((shot) => {
            const x = clampPercent(50 + (Number(shot.sideCarryYd) / model.maxSide) * 38, 8, 92);
            const y = clampPercent(88 - (Number(shot.carryYd) / model.maxCarry) * 72, 8, 90);

            return (
              <span
                key={shot.id}
                className={`absolute z-[2] size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white shadow-[0_0_0_4px_rgba(255,255,255,0.5)] ${dispersionPointClass(
                  shot.sideCarryYd,
                )}`}
                style={{ left: `${x}%`, top: `${y}%` }}
                aria-hidden="true"
              />
            );
          })
        ) : (
          <div className="absolute inset-x-5 top-1/2 -translate-y-1/2 rounded-lg bg-white/90 p-4 text-center text-sm font-medium text-muted-foreground shadow-sm">
            No carry and side data match this filter yet.
          </div>
        )}
        {showMetrics ? (
          <div className={`absolute inset-x-3 grid grid-cols-3 gap-2 ${metricClassName ?? ""}`}>
            <DispersionMetric label="Carry" value={formatYards(model.averageCarry)} />
            <DispersionMetric
              label="Playable"
              value={`${model.playableCount}/${model.plottedShots.length || 0}`}
            />
            <DispersionMetric
              label="Shape"
              value={`${model.telemetryTraceCount}/${model.shapeTraces.length}`}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function buildShotShapeMapModel(shots: DispersionShot[], traceLimit: number): ShotShapeMapModel {
  const plottedShots = shots.filter(
    (shot) => isFiniteShotMetric(shot.carryYd) && isFiniteShotMetric(shot.sideCarryYd),
  );
  const maxCarry = Math.max(1, ...plottedShots.map((shot) => Number(shot.carryYd)));
  const maxSide = Math.max(12, ...plottedShots.map((shot) => Math.abs(Number(shot.sideCarryYd))));
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

function DispersionMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/90 px-2 py-2 text-center shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ShotFilterFields({
  filters,
  clubsForFilter,
  sessionSummaries,
  categories,
}: {
  filters: ShotFilters;
  clubsForFilter: string[];
  sessionSummaries: Array<{ id: string; fileName: string | null; date: Date }>;
  categories: string[];
}) {
  return (
    <>
      <Field>
        <FieldLabel>Search file/course</FieldLabel>
        <InputGroup className="h-10 bg-white/90">
          <InputGroupAddon>
            <Search className="size-4" />
          </InputGroupAddon>
          <InputGroupInput
            name="q"
            defaultValue={filters.q}
            placeholder="Session name"
            data-page-search
            data-filter-search
          />
        </InputGroup>
      </Field>
      <Field>
        <FieldLabel>Club</FieldLabel>
        <Select name="club" defaultValue={filters.club || "__all"}>
          <SelectTrigger aria-label="Club filter" className="h-10 w-full bg-white/90">
            <SelectValue placeholder="All clubs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All clubs</SelectItem>
            {clubsForFilter.map((club) => (
              <SelectItem key={club} value={club}>
                {formatClubType(club)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel>Session</FieldLabel>
        <Select name="sessionId" defaultValue={filters.sessionId || "__all"}>
          <SelectTrigger aria-label="Session filter" className="h-10 w-full bg-white/90">
            <SelectValue placeholder="All sessions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All sessions</SelectItem>
            {sessionSummaries.map((session) => (
              <SelectItem key={session.id} value={session.id}>
                {session.fileName ?? formatDate(session.date)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel>Category</FieldLabel>
        <Select name="category" defaultValue={filters.category || "__all"}>
          <SelectTrigger aria-label="Category filter" className="h-10 w-full bg-white/90">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {formatSessionType(category)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <DateFilterPopover name="from" label="From" defaultValue={filters.from} />
      <DateFilterPopover name="to" label="To" defaultValue={filters.to} />
      <Field>
        <FieldLabel>Sort by</FieldLabel>
        <Select name="sort" defaultValue={filters.sort}>
          <SelectTrigger aria-label="Sort shots by metric" className="h-10 w-full bg-white/90">
            <SelectValue placeholder="Newest first" />
          </SelectTrigger>
          <SelectContent>
            {shotSortMetrics.map((metric) => (
              <SelectItem key={metric} value={metric}>
                {shotSortLabels[metric]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel>Order</FieldLabel>
        <Select name="dir" defaultValue={filters.dir}>
          <SelectTrigger aria-label="Sort direction" className="h-10 w-full bg-white/90">
            <SelectValue placeholder="High to low" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">High to low</SelectItem>
            <SelectItem value="asc">Low to high</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </>
  );
}

async function getShotDatabase(filters: ShotFilters) {
  try {
    return await getLiveShotDatabase(filters);
  } catch (error) {
    if (isPlaywrightE2eAuthBypassEnabled()) {
      console.warn("[shots] Falling back to empty Playwright shot database", error);
      return emptyShotDatabase();
    }

    throw error;
  }
}

async function getLiveShotDatabase(filters: ShotFilters) {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const where = buildShotWhere(filters, userId);

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
        shotAt: shots.shotAt,
        clubType: shots.clubType,
        carryYd: shots.carryYd,
        sideCarryYd: shots.sideCarryYd,
        launchDirectionDeg: shots.launchDirectionDeg,
        spinAxis: shots.spinAxis,
        ballSpeedMph: shots.ballSpeedMph,
        smashFactor: shots.smashFactor,
      })
      .from(shots)
      .innerJoin(sessions, eq(shots.sessionId, sessions.id))
      .where(where)
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
  };
}

function allToEmpty(value: string) {
  return value === "__all" ? "" : value;
}

function pageHref(filters: ShotFilters, page: number) {
  return shotsHref({ ...filters, page });
}

function buildActiveFilterChips(
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
  if (filters.sort !== "recent") {
    params.set("sort", filters.sort);
    if (filters.dir !== "desc") params.set("dir", filters.dir);
  }

  const query = params.toString();
  return query ? `/shots?${query}` : "/shots";
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
    <div className="apple-panel-strong p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-normal">
        {integerFormatter.format(value)}
      </p>
    </div>
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

function formatYards(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)} yd`;
}

function formatSignedYards(value: number | null) {
  if (value === null) {
    return "--";
  }

  return `${value > 0 ? "+" : ""}${numberFormatter.format(value)} yd`;
}

function formatSpeed(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)} mph`;
}

function shotOutcomeLabel(sideCarryYd: number | null) {
  if (sideCarryYd === null) {
    return "Not measured";
  }

  const offline = Math.abs(sideCarryYd);
  if (offline <= 8) {
    return "Target window";
  }
  if (offline <= 20) {
    return "Playable";
  }

  return sideCarryYd < 0 ? "Miss left" : "Miss right";
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

function clampPercent(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function dispersionPointClass(sideCarryYd: number | null) {
  if (sideCarryYd === null) {
    return "bg-slate-500";
  }

  const side = Math.abs(sideCarryYd);

  if (side <= 8) {
    return "bg-emerald-500";
  }

  if (side <= 20) {
    return "bg-amber-500";
  }

  return "bg-pink-500";
}

function traceStroke(sideCarryYd: number | null, source: ShotShapeTrace["source"]) {
  if (source === "straight" || sideCarryYd === null) {
    return "rgba(15,23,42,0.46)";
  }

  const side = Math.abs(sideCarryYd);

  if (side <= 8) {
    return "rgba(5,150,105,0.9)";
  }

  if (side <= 20) {
    return "rgba(217,119,6,0.84)";
  }

  return "rgba(219,39,119,0.82)";
}

function formatShapeTelemetry(launchDirectionDeg: number | null, spinAxis: number | null) {
  const hasLaunchDirection = isFiniteShotMetric(launchDirectionDeg);
  const hasSpinAxis = isFiniteShotMetric(spinAxis);

  if (!hasLaunchDirection) {
    return hasSpinAxis ? `${formatMetric(spinAxis)} axis only` : "Landing line";
  }

  const parts = [`${formatMetric(launchDirectionDeg)} deg start`];

  if (hasSpinAxis) {
    parts.push(`${formatMetric(spinAxis)} axis`);
  }

  return parts.join(" / ");
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

function isRoundSession(value: string) {
  return (
    value === "round" ||
    value === "simulator" ||
    value === "simulated_course" ||
    value === "real_round"
  );
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

function shotQualityDot(sideCarryYd: number | null) {
  if (sideCarryYd === null) {
    return "bg-slate-400 ring-slate-200";
  }

  const offline = Math.abs(sideCarryYd);

  if (offline <= 8) {
    return "bg-emerald-500 ring-emerald-100";
  }

  if (offline <= 20) {
    return "bg-amber-500 ring-amber-100";
  }

  return "bg-pink-500 ring-pink-100";
}
