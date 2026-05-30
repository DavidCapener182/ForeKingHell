import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Flag,
  Search,
  Upload,
} from "lucide-react";
import { and, asc, count, desc, eq, gte, lte, sql } from "drizzle-orm";

import { DateFilterPopover } from "@/components/app/date-filter-popover";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { clubs, importRows, sessions, shots } from "@/db/schema";
import { getDb } from "@/db/client";
import { formatClubModelName, formatClubType, isTrackedClubType } from "@/lib/club-format";
import { requireCurrentUserId } from "@/lib/current-user";
import { getFeatureIdeasData } from "@/lib/feature-ideas";

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
      totalFilteredShots,
      clubsForFilter,
      categories,
    },
    featureData,
  ] = await Promise.all([getShotDatabase(filters), getFeatureIdeasData()]);
  const totalPages = Math.max(1, Math.ceil(totalFilteredShots / PAGE_SIZE));
  const activeFilterChips = buildActiveFilterChips(filters, clubsForFilter, sessionSummaries);
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
          { label: "Filters", href: "#filters" },
          { label: "Sessions", href: "#sessions" },
          { label: "Shots", href: "#shots" },
        ]}
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
              <DataTableFrame
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Shots</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessionSummaries.slice(0, 8).map((session) => (
                      <TableRow key={session.id}>
                        <TableCell className="max-w-64 truncate font-medium">
                          {isRoundSession(session.type) ? (
                            <Link href={`/rounds/${session.id}`} className="hover:underline">
                              {session.fileName ?? "Untitled import"}
                            </Link>
                          ) : (
                            (session.fileName ?? "Untitled import")
                          )}
                        </TableCell>
                        <TableCell>{formatDate(session.date)}</TableCell>
                        <TableCell>{formatSessionType(session.type)}</TableCell>
                        <TableCell className="text-right">
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
        </CardHeader>
        <CardContent>
          <DataTableFrame
            mobile={
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
                      <DataPair label="Side" value={formatMetric(shot.sideCarryYd)} />
                      <details className="rounded-lg bg-[#F5F6F4] px-3 py-2 text-sm">
                        <summary className="cursor-pointer list-none font-semibold text-emerald-700 [&::-webkit-details-marker]:hidden">
                          Advanced
                        </summary>
                        <div className="mt-2 grid gap-2">
                          <DataPair label="Launch" value={formatMetric(shot.launchAngleDeg)} />
                          <DataPair label="Ball mph" value={formatMetric(shot.ballSpeedMph)} />
                          <DataPair label="Smash" value={formatMetric(shot.smashFactor)} />
                          <DataPair label="Apex" value={formatMetric(shot.apexFt)} />
                          <DataPair label="Attack" value={formatMetric(shot.attackAngleDeg)} />
                          <DataPair label="Path" value={formatMetric(shot.clubPathDeg)} />
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
            }
          >
            <Table className="min-w-[980px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>File</TableHead>
                  <SortableShotHead filters={filters} metric="shot" label="Shot" />
                  <TableHead>Hole</TableHead>
                  <TableHead>Club</TableHead>
                  <SortableShotHead filters={filters} metric="carry" label="Carry" />
                  <SortableShotHead filters={filters} metric="total" label="Total" />
                  <SortableShotHead filters={filters} metric="side" label="Side" />
                  <SortableShotHead filters={filters} metric="launch" label="Launch" />
                  <SortableShotHead filters={filters} metric="ballSpeed" label="Ball mph" />
                  <TableHead>Advanced</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {savedShots.map((shot) => (
                  <TableRow key={shot.id}>
                    <TableCell>{formatDate(shot.shotAt)}</TableCell>
                    <TableCell className="max-w-48 truncate">{shot.fileName ?? "--"}</TableCell>
                    <TableCell className="text-right">{shot.shotNumber ?? "--"}</TableCell>
                    <TableCell>
                      {formatHole(shot.courseHoleNumber, shot.courseHoleShotNumber)}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="max-w-48">
                        <p className="truncate">{formatShotClub(shot)}</p>
                        {formatShotClub(shot) !== formatClubType(shot.clubType) ? (
                          <p className="truncate text-xs font-normal text-muted-foreground">
                            {formatClubType(shot.clubType)}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatMetric(shot.carryYd)}</TableCell>
                    <TableCell className="text-right">{formatMetric(shot.totalYd)}</TableCell>
                    <TableCell className="text-right">{formatMetric(shot.sideCarryYd)}</TableCell>
                    <TableCell className="text-right">
                      {formatMetric(shot.launchAngleDeg)}
                    </TableCell>
                    <TableCell className="text-right">{formatMetric(shot.ballSpeedMph)}</TableCell>
                    <TableCell>
                      <details className="text-xs">
                        <summary className="cursor-pointer text-emerald-700">More</summary>
                        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-muted-foreground">
                          <dt>Club speed</dt>
                          <dd>{formatMetric(shot.clubSpeedMph)}</dd>
                          <dt>Direction</dt>
                          <dd>{formatMetric(shot.launchDirectionDeg)}</dd>
                          <dt>Apex</dt>
                          <dd>{formatMetric(shot.apexFt)}</dd>
                          <dt>Attack</dt>
                          <dd>{formatMetric(shot.attackAngleDeg)}</dd>
                          <dt>Path</dt>
                          <dd>{formatMetric(shot.clubPathDeg)}</dd>
                          <dt>Descent</dt>
                          <dd>{formatMetric(shot.descentAngleDeg)}</dd>
                          <dt>Smash</dt>
                          <dd>{formatMetric(shot.smashFactor)}</dd>
                          <dt>Est</dt>
                          <dd>{shot.clubDataEstType ?? "--"}</dd>
                        </dl>
                      </details>
                    </TableCell>
                  </TableRow>
                ))}
                {savedShots.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                      No shots match these filters.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </DataTableFrame>
        </CardContent>
      </Card>
      <StickyMobileAction>
        <Button asChild className="w-full rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
          <Link href="#filters">Filter / sort shots</Link>
        </Button>
      </StickyMobileAction>
    </PageShell>
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
          <InputGroupInput name="q" defaultValue={filters.q} placeholder="Session name" />
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
    totalFilteredShots: filteredCount?.value ?? 0,
    clubsForFilter: [...new Set(clubRows.map((club) => club.type))].filter(isTrackedClubType),
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

function SortableShotHead({
  filters,
  metric,
  label,
}: {
  filters: ShotFilters;
  metric: ShotSortMetric;
  label: string;
}) {
  const active = filters.sort === metric;
  const dir = active ? filters.dir : "desc";
  const nextDir = active && filters.dir === "desc" ? "low to high" : "high to low";
  const Icon = active ? (dir === "desc" ? ArrowDown : ArrowUp) : ArrowUpDown;

  return (
    <TableHead className="text-right" aria-sort={active ? sortAriaValue(dir) : "none"}>
      <Link
        href={sortHref(filters, metric)}
        className="inline-flex w-full items-center justify-end gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        aria-label={`Sort by ${label}, ${nextDir}`}
        prefetch={false}
      >
        {label}
        <Icon className={`size-3.5 ${active ? "text-emerald-700" : "opacity-45"}`} />
      </Link>
    </TableHead>
  );
}

function sortAriaValue(dir: ShotSortDirection) {
  return dir === "desc" ? "descending" : "ascending";
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
