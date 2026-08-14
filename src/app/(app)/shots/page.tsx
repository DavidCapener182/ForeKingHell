import Link from "next/link";
import { redirect } from "next/navigation";
import { Database, Gauge, Rows3, ShieldCheck, TableProperties, Upload } from "lucide-react";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  isNull,
  lte,
  not,
  notInArray,
  or,
  sql,
} from "drizzle-orm";

import { AppEmptyState } from "@/components/app/app-empty-state";
import {
  DesktopTableWorkbenchControls,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { PageShell } from "@/components/premium";
import { ShotFilterToolbar } from "@/app/shots/shot-filter-toolbar";
import {
  ShotsMasterDetailTable,
  type ShotMasterDetailRow,
  type ShotMiniDispersionPoint,
  type ShotTableSort,
} from "@/app/shots/shots-master-detail-table";
import { clubs, importRows, sessions, shots } from "@/db/schema";
import { getDb } from "@/db/client";
import { formatClubModelName, formatClubType, isTrackedClubType } from "@/lib/club-format";
import { isPlaywrightE2eAuthBypassEnabled, requireCurrentUserId } from "@/lib/current-user";
import {
  excludedRecordQualityTags,
  excludedRecordShotCategories,
  recordEligibility,
  type RecordEligibilityReason,
} from "@/lib/shot-records";
import { reportServerFailure } from "@/lib/server-observability";

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
  trust: "all" | "trusted" | "untrusted";
  sort: ShotSortMetric;
  dir: ShotSortDirection;
  group: "none" | "club" | "session";
};

const PAGE_SIZE = 50;

const shotWorkbenchColumns: DesktopWorkbenchColumn[] = [
  { id: "club", label: "Club", locked: true },
  { id: "carry", label: "Carry" },
  { id: "total", label: "Total" },
  { id: "side", label: "Side" },
  { id: "ballSpeed", label: "Ball speed" },
  { id: "launch", label: "Launch" },
  { id: "trust", label: "Evidence" },
  { id: "type", label: "Shot type" },
  { id: "shot", label: "Shot #" },
  { id: "file", label: "Session" },
  { id: "date", label: "Date" },
  { id: "advanced", label: "Actions", locked: true },
];

const shotSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Trusted driver evidence",
    href: "/shots?club=driver&trust=trusted",
    detail: "Decision-grade driver rows only.",
  },
  {
    title: "7 iron stock shots",
    href: "/shots?club=7i&category=full&trust=trusted",
    detail: "Clean approach evidence for stock carry checks.",
  },
  {
    title: "Rows needing review",
    href: "/shots?trust=untrusted",
    detail: "Source rows excluded from trusted calculations.",
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
  recent: "Date",
  shot: "Shot",
  carry: "Carry",
  total: "Total",
  side: "Side",
  launch: "Launch",
  ballSpeed: "Ball speed",
  clubSpeed: "Club speed",
  launchDirection: "Direction",
  apex: "Apex",
  attack: "Attack",
  path: "Path",
  face: "Face angle",
  descent: "Descent",
  smash: "Smash",
};

const numberFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
const integerFormatter = new Intl.NumberFormat("en-GB");

export default async function ShotsPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = parseFilters(await searchParams);
  const {
    stats,
    sessionSummaries,
    savedShots,
    dispersionShots,
    totalFilteredShots,
    clubsForFilter,
    categories,
  } = await getShotDatabase(filters);
  const totalPages = Math.max(1, Math.ceil(totalFilteredShots / PAGE_SIZE));

  if (filters.page > totalPages) redirect(pageHref(filters, totalPages));

  const activeFilterChips = buildShotFilterSummary(filters, clubsForFilter, sessionSummaries);
  const currentViewLabel =
    activeFilterChips.length > 0 ? activeFilterChips.join(" + ") : "All shots · newest first";
  const desktopShotRows = savedShots.map(serializeShotForMasterDetail);
  const desktopShotSorts = buildShotTableSorts(filters);
  const dispersionPoints = dispersionShots
    .filter(
      (shot): shot is typeof shot & { carryYd: number; sideCarryYd: number } =>
        isFiniteShotMetric(shot.carryYd) && isFiniteShotMetric(shot.sideCarryYd),
    )
    .map(serializeMiniDispersionPoint);
  const latestSessionId = sessionSummaries[0]?.id;

  return (
    <PageShell contentClassName="gap-4 lg:gap-4">
      <MobileShotExplorerHandoff latestSessionId={latestSessionId} />

      <div className="hidden min-w-0 gap-4 lg:grid" data-shots-desktop-workbench>
        <header className="grid gap-4 border-b pb-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Analytics workbench</Badge>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance xl:text-4xl">
              Shot Explorer
            </h1>
            <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted-foreground">
              Audit every measured shot, isolate trusted evidence, and inspect the source behind the
              number without leaving the table.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <WorkbenchMetric icon={Rows3} label="Shots" value={stats.shotCount} />
            <WorkbenchMetric icon={TableProperties} label="Sessions" value={stats.sessionCount} />
            <WorkbenchMetric icon={ShieldCheck} label="Clubs" value={stats.clubCount} />
            <Button asChild size="sm" variant="outline" className="h-10">
              <Link href="/import">
                <Upload className="size-4" />
                Import
              </Link>
            </Button>
          </div>
        </header>

        {stats.shotCount === 0 ? (
          <AppEmptyState
            className="min-h-[34rem]"
            icon={<Database className="size-6" aria-hidden />}
            title="Import your first measured shots"
            description="The evidence table, saved views, filters and source inspection panel appear after a launch-monitor session is saved."
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
        ) : (
          <>
            <ShotFilterToolbar
              initial={{
                q: filters.q,
                club: filters.club,
                sessionId: filters.sessionId,
                category: filters.category,
                from: filters.from,
                to: filters.to,
                trust: filters.trust,
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
              resultLabel={`${integerFormatter.format(totalFilteredShots)} matching`}
            />

            <Card id="shots" className="min-w-0 overflow-hidden py-0 scroll-mt-40">
              <CardHeader className="gap-3 border-b px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Evidence table</CardTitle>
                    <CardDescription className="mt-0.5 text-xs">
                      Page {filters.page} of {totalPages} ·{" "}
                      {integerFormatter.format(totalFilteredShots)} rows
                    </CardDescription>
                  </div>
                  <ShotPagination filters={filters} totalPages={totalPages} />
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
                />
              </CardHeader>
              <CardContent className="grid min-w-0 gap-3 p-3">
                <ShotsMasterDetailTable
                  shots={desktopShotRows}
                  sorts={desktopShotSorts}
                  groupBy={filters.group}
                  dispersionClubLabel={filters.club ? formatClubType(filters.club) : undefined}
                  dispersionShots={filters.club ? dispersionPoints : []}
                />
                <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                  <p className="text-xs text-muted-foreground">
                    Showing up to {PAGE_SIZE} rows · use Up/Down to move and Enter to inspect
                  </p>
                  <ShotPagination filters={filters} totalPages={totalPages} />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </PageShell>
  );
}

function MobileShotExplorerHandoff({ latestSessionId }: { latestSessionId?: string }) {
  return (
    <section className="grid gap-4 lg:hidden" data-shots-mobile-handoff>
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <Badge variant="secondary">Desktop workbench</Badge>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-balance">Shot Explorer</h1>
        <p className="mt-2 text-[15px] leading-6 text-muted-foreground">
          The full evidence table is built for a wide screen. On your phone, review the latest
          session or carry trusted bag numbers to the course.
        </p>
      </div>
      <div className="grid gap-3">
        <Button asChild size="lg" className="h-14 justify-between rounded-xl px-4">
          <Link href={latestSessionId ? `/sessions/${latestSessionId}` : "/sessions"}>
            Session Review
            <Gauge className="size-5" />
          </Link>
        </Button>
        <Button
          asChild
          size="lg"
          variant="outline"
          className="h-14 justify-between rounded-xl px-4"
        >
          <Link href="/quick-bag">
            Quick Bag
            <ShieldCheck className="size-5" />
          </Link>
        </Button>
        <Button asChild variant="ghost" className="justify-start">
          <Link href="/import">
            <Upload className="size-4" />
            Import a measured session
          </Link>
        </Button>
      </div>
    </section>
  );
}

function WorkbenchMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Rows3;
  label: string;
  value: number;
}) {
  return (
    <div className="flex h-10 items-center gap-2 rounded-lg border bg-card px-3 shadow-sm">
      <Icon className="size-4 text-primary" aria-hidden />
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{integerFormatter.format(value)}</span>
    </div>
  );
}

function ShotPagination({ filters, totalPages }: { filters: ShotFilters; totalPages: number }) {
  return (
    <Pagination className="mx-0 w-auto justify-end">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href={pageHref(filters, Math.max(1, filters.page - 1))}
            aria-disabled={filters.page <= 1}
            className={filters.page <= 1 ? "pointer-events-none opacity-45" : undefined}
          />
        </PaginationItem>
        <PaginationItem>
          <span className="px-2 text-xs font-medium tabular-nums">
            {filters.page} / {totalPages}
          </span>
        </PaginationItem>
        <PaginationItem>
          <PaginationNext
            href={pageHref(filters, Math.min(totalPages, filters.page + 1))}
            aria-disabled={filters.page >= totalPages}
            className={filters.page >= totalPages ? "pointer-events-none opacity-45" : undefined}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

type SavedShotRow = {
  id: string;
  sessionId: string;
  sessionSource: string;
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
  spinRate: number | null;
  spinAxis: number | null;
  shotShape: string | null;
  shotCategory: string;
  qualityTag: string | null;
  clubDataEstType: string | null;
  sourceRawJson: Record<string, string>;
};

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

  const [
    [shotCount],
    [rawRowCount],
    [sessionCount],
    clubRows,
    sessionRows,
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
      .select({
        id: sessions.id,
        fileName: sessions.fileName,
        type: sessions.type,
        date: sessions.date,
      })
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .orderBy(desc(sessions.date), asc(sessions.fileName)),
    db
      .select({ value: count() })
      .from(shots)
      .innerJoin(sessions, eq(shots.sessionId, sessions.id))
      .where(where),
    db
      .select({
        id: shots.id,
        sessionId: shots.sessionId,
        sessionSource: sessions.source,
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
        spinRate: shots.spinRate,
        spinAxis: shots.spinAxis,
        shotShape: shots.shotShape,
        shotCategory: shots.shotCategory,
        qualityTag: shots.qualityTag,
        clubDataEstType: shots.clubDataEstType,
        sourceRawJson: shots.sourceRawJson,
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
        carryYd: shots.carryYd,
        sideCarryYd: shots.sideCarryYd,
        totalYd: shots.totalYd,
        qualityTag: shots.qualityTag,
        shotCategory: shots.shotCategory,
        sessionSource: sessions.source,
      })
      .from(shots)
      .innerJoin(sessions, eq(shots.sessionId, sessions.id))
      .where(where)
      .orderBy(desc(shots.shotAt))
      .limit(90),
  ]);

  return {
    stats: {
      shotCount: shotCount?.value ?? 0,
      rawRowCount: rawRowCount?.value ?? 0,
      sessionCount: sessionCount?.value ?? 0,
      clubCount: clubRows.filter((club) => isTrackedClubType(club.type)).length,
    },
    sessionSummaries: sessionRows,
    savedShots,
    dispersionShots,
    totalFilteredShots: filteredCount?.value ?? 0,
    clubsForFilter: [...new Set(clubRows.map((club) => club.type))].filter(isTrackedClubType),
    categories: ["tee", "approach", "pitch", "chip", "full", "recovery"],
  };
}

function emptyShotDatabase() {
  return {
    stats: { shotCount: 0, rawRowCount: 0, sessionCount: 0, clubCount: 0 },
    sessionSummaries: [],
    savedShots: [] as SavedShotRow[],
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
  if (filters.q) {
    clauses.push(
      sql`(${sessions.fileName} ilike ${`%${filters.q}%`} or ${sessions.courseName} ilike ${`%${filters.q}%`})`,
    );
  }
  if (filters.from) clauses.push(gte(shots.shotAt, new Date(`${filters.from}T00:00:00.000Z`)));
  if (filters.to) clauses.push(lte(shots.shotAt, new Date(`${filters.to}T23:59:59.999Z`)));

  const trusted = trustedShotWhere();
  if (filters.trust === "trusted") clauses.push(trusted);
  if (filters.trust === "untrusted") clauses.push(not(trusted));

  return and(...clauses);
}

function trustedShotWhere() {
  return and(
    gt(sql<number>`coalesce(${shots.totalYd}, ${shots.carryYd}, 0)`, 0),
    or(isNull(shots.qualityTag), notInArray(shots.qualityTag, [...excludedRecordQualityTags])),
    notInArray(shots.shotCategory, [...excludedRecordShotCategories]),
    notInArray(sessions.source, ["manual", "manual_edit"]),
  )!;
}

function shotOrderBy(filters: ShotFilters) {
  if (filters.sort === "recent") {
    return [filters.dir === "asc" ? asc(shots.shotAt) : desc(shots.shotAt), asc(shots.shotNumber)];
  }
  const column = shotSortColumn(filters.sort);
  const primarySort =
    filters.dir === "desc" ? sql`${column} desc nulls last` : sql`${column} asc nulls last`;
  return [primarySort, desc(shots.shotAt), asc(shots.shotNumber)];
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
  const sortParam = first(params.sort);
  const trustParam = first(params.trust);
  const groupParam = first(params.group);

  return {
    page: Math.max(1, Number(first(params.page)) || 1),
    club: allToEmpty(first(params.club)),
    sessionId: allToEmpty(first(params.sessionId)),
    category: allToEmpty(first(params.category)),
    q: first(params.q).trim().slice(0, 120),
    from: dateParam(first(params.from)),
    to: dateParam(first(params.to)),
    trust: trustParam === "trusted" || trustParam === "untrusted" ? trustParam : "all",
    sort: isShotSortMetric(sortParam) ? sortParam : "recent",
    dir: first(params.dir) === "asc" ? "asc" : "desc",
    group: groupParam === "club" || groupParam === "session" ? groupParam : "none",
  };
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
  if (filters.trust !== "all") params.set("trust", filters.trust);
  if (filters.group !== "none") params.set("group", filters.group);
  if (filters.sort !== "recent" || filters.dir !== "desc") {
    params.set("sort", filters.sort);
    if (filters.dir !== "desc") params.set("dir", filters.dir);
  }
  const query = params.toString();
  return query ? `/shots?${query}` : "/shots";
}

function pageHref(filters: ShotFilters, page: number) {
  return shotsHref({ ...filters, page });
}

function sortHref(filters: ShotFilters, sort: ShotSortMetric) {
  const dir = filters.sort === sort && filters.dir === "desc" ? "asc" : "desc";
  return shotsHref({ ...filters, page: 1, sort, dir });
}

function buildShotTableSorts(filters: ShotFilters): ShotTableSort[] {
  const columns: Array<Pick<ShotTableSort, "metric" | "label">> = [
    { metric: "recent", label: "Date" },
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

function serializeShotForMasterDetail(shot: SavedShotRow): ShotMasterDetailRow {
  const eligibility = recordEligibility({
    carryYd: shot.carryYd,
    totalYd: shot.totalYd,
    qualityTag: shot.qualityTag,
    shotCategory: shot.shotCategory,
    sessionSource: shot.sessionSource,
  });
  return {
    id: shot.id,
    sessionId: shot.sessionId,
    shotAtLabel: formatDate(shot.shotAt),
    fileNameLabel: shot.fileName ?? "Untitled session",
    shotNumberLabel: shot.shotNumber?.toString() ?? "--",
    holeLabel: formatHole(shot.courseHoleNumber, shot.courseHoleShotNumber),
    clubLabel: formatClubModelName({
      type: shot.clubType,
      brand: shot.clubBrand,
      model: shot.clubModel,
    }),
    clubTypeLabel: formatClubType(shot.clubType),
    clubType: shot.clubType,
    shotCategoryLabel: formatSessionType(shot.shotCategory),
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
    spinRateLabel: formatMetric(shot.spinRate),
    spinAxisLabel: formatMetric(shot.spinAxis),
    estimateLabel: shot.clubDataEstType ? formatSessionType(shot.clubDataEstType) : "Measured",
    shotShapeLabel: shot.shotShape
      ? formatSessionType(shot.shotShape)
      : inferShotShape(shot.sideCarryYd),
    qualityTagLabel: shot.qualityTag ? formatSessionType(shot.qualityTag) : "--",
    evidenceStatus: eligibility.trustedEligible ? "trusted" : "untrusted",
    evidenceReasons: eligibility.reasons.map(formatEligibilityReason),
    sideTone: sideCarryTone(shot.sideCarryYd),
    carryYd: shot.carryYd,
    sideCarryYd: shot.sideCarryYd,
    apexFt: shot.apexFt,
    sourceEntries: Object.entries(shot.sourceRawJson ?? {})
      .map(([key, value]) => ({ key, value: String(value) }))
      .sort((left, right) => left.key.localeCompare(right.key)),
  };
}

function serializeMiniDispersionPoint(shot: {
  id: string;
  carryYd: number;
  sideCarryYd: number;
  totalYd: number | null;
  qualityTag: string | null;
  shotCategory: string;
  sessionSource: string;
}): ShotMiniDispersionPoint {
  return {
    id: shot.id,
    carryYd: shot.carryYd,
    sideCarryYd: shot.sideCarryYd,
    trusted: recordEligibility(shot).trustedEligible,
  };
}

function buildShotFilterSummary(
  filters: ShotFilters,
  clubsForFilter: string[],
  sessionSummaries: Array<{ id: string; fileName: string | null; date: Date }>,
) {
  const summary: string[] = [];
  const session = sessionSummaries.find((item) => item.id === filters.sessionId);
  if (filters.q) summary.push(`Search ${filters.q}`);
  if (filters.club && clubsForFilter.includes(filters.club))
    summary.push(formatClubType(filters.club));
  if (filters.sessionId) summary.push(session?.fileName ?? "Session");
  if (filters.category) summary.push(formatSessionType(filters.category));
  if (filters.from || filters.to) summary.push(`${filters.from || "Any"}–${filters.to || "Today"}`);
  if (filters.trust !== "all") summary.push(filters.trust === "trusted" ? "Trusted" : "Untrusted");
  if (filters.group !== "none") summary.push(`Grouped by ${filters.group}`);
  if (filters.sort !== "recent") summary.push(`${shotSortLabels[filters.sort]} ${filters.dir}`);
  return summary;
}

function formatEligibilityReason(reason: RecordEligibilityReason) {
  switch (reason) {
    case "missing-distance":
      return "No usable carry or total distance";
    case "non-positive-distance":
      return "Distance is zero or negative";
    case "quality-tag":
      return "Quality flag excludes this row";
    case "shot-category":
      return "Shot type is outside trusted stock evidence";
    case "manual-source":
      return "Manual source requires review";
  }
}

function sideCarryTone(value: number | null): ShotMasterDetailRow["sideTone"] {
  if (value === null) return "slate";
  const offline = Math.abs(value);
  if (offline <= 8) return "green";
  if (offline <= 20) return "amber";
  return "red";
}

function inferShotShape(sideCarryYd: number | null) {
  if (sideCarryYd === null || Math.abs(sideCarryYd) < 4) return "Straight";
  return sideCarryYd < 0 ? "Finishes left" : "Finishes right";
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
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatHole(holeNumber: number | null, holeShotNumber: number | null) {
  if (!holeNumber) return "--";
  return holeShotNumber ? `${holeNumber}.${holeShotNumber}` : holeNumber.toString();
}

function isFiniteShotMetric(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isShotSortMetric(value: string): value is ShotSortMetric {
  return shotSortMetrics.includes(value as ShotSortMetric);
}

function allToEmpty(value: string) {
  return value === "__all" ? "" : value;
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function dateParam(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}
