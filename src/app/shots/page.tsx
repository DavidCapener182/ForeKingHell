import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Flag, Upload } from "lucide-react";
import { and, asc, count, desc, eq, gte, lte, sql } from "drizzle-orm";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CompactReadoutGrid,
  DataPair,
  DataTableFrame,
  MobileDataCard,
  MobileDataList,
  PageShell,
} from "@/components/premium";
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
};

const PAGE_SIZE = 50;

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

const integerFormatter = new Intl.NumberFormat("en-GB");

export default async function ShotsPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = parseFilters(await searchParams);
  const { stats, rowTypes, sessionSummaries, savedShots, totalFilteredShots, clubsForFilter, categories } =
    await getShotDatabase(filters);
  const totalPages = Math.max(1, Math.ceil(totalFilteredShots / PAGE_SIZE));

  return (
    <PageShell>
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

        <header className="premium-hero p-5 sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-2">
              <Badge className="w-fit bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                Explorer
              </Badge>
              <h1 className="text-4xl font-semibold tracking-normal text-balance sm:text-5xl">
                Shot database
              </h1>
              <p className="text-base leading-7 text-muted-foreground">
                Filter the archive by club, session, date, shot category, or file name. Advanced launch metrics stay available without forcing every row into a giant debugging table.
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

        <Card className="premium-card">
          <CardHeader>
            <CardTitle>Find shots</CardTitle>
            <CardDescription>50 rows per page, scoped to the current player.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="apple-panel grid gap-3 p-3 md:grid-cols-3 xl:grid-cols-6">
              <label className="grid gap-1 text-sm font-medium">
                Search file/course
                <input name="q" defaultValue={filters.q} className="rounded-lg border bg-white/90 px-3 py-2 text-sm" placeholder="Session name" />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Club
                <select name="club" defaultValue={filters.club} className="rounded-lg border bg-white/90 px-3 py-2 text-sm">
                  <option value="">All clubs</option>
                  {clubsForFilter.map((club) => (
                    <option key={club} value={club}>{formatClubType(club)}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Session
                <select name="sessionId" defaultValue={filters.sessionId} className="rounded-lg border bg-white/90 px-3 py-2 text-sm">
                  <option value="">All sessions</option>
                  {sessionSummaries.map((session) => (
                    <option key={session.id} value={session.id}>{session.fileName ?? formatDate(session.date)}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Category
                <select name="category" defaultValue={filters.category} className="rounded-lg border bg-white/90 px-3 py-2 text-sm">
                  <option value="">All categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>{formatSessionType(category)}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium">
                From
                <input type="date" name="from" defaultValue={filters.from} className="rounded-lg border bg-white/90 px-3 py-2 text-sm" />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                To
                <input type="date" name="to" defaultValue={filters.to} className="rounded-lg border bg-white/90 px-3 py-2 text-sm" />
              </label>
              <div className="flex gap-2 md:col-span-3 xl:col-span-6">
                <Button type="submit">Apply filters</Button>
                <Button asChild variant="outline"><Link href="/shots">Reset</Link></Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <section className="grid gap-4 lg:grid-cols-[1fr_0.65fr]">
          <Card className="premium-card">
            <CardHeader>
              <CardTitle>Session imports</CardTitle>
              <CardDescription>Saved files, CSV dates, shot rows, and retained raw rows.</CardDescription>
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
                          action={<Badge variant="secondary">{formatSessionType(session.type)}</Badge>}
                        >
                          <DataPair label="Shots" value={integerFormatter.format(session.shotCount)} />
                          <DataPair label="Raw rows" value={integerFormatter.format(session.rawRowCount)} />
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
                            <Link href={`/rounds/${session.id}`} className="hover:underline">{session.fileName ?? "Untitled import"}</Link>
                          ) : (session.fileName ?? "Untitled import")}
                        </TableCell>
                        <TableCell>{formatDate(session.date)}</TableCell>
                        <TableCell>{formatSessionType(session.type)}</TableCell>
                        <TableCell className="text-right">{integerFormatter.format(session.shotCount)}</TableCell>
                      </TableRow>
                    ))}
                    {sessionSummaries.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No imported sessions yet.</TableCell></TableRow>
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
        </section>

        <Card className="premium-card">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Shot explorer</CardTitle>
                <CardDescription>{integerFormatter.format(totalFilteredShots)} matching rows. Showing page {filters.page} of {totalPages}.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm" aria-disabled={filters.page <= 1}>
                  <Link href={pageHref(filters, Math.max(1, filters.page - 1))}><ChevronLeft className="size-4" /> Previous</Link>
                </Button>
                <Button asChild variant="outline" size="sm" aria-disabled={filters.page >= totalPages}>
                  <Link href={pageHref(filters, Math.min(totalPages, filters.page + 1))}>Next <ChevronRight className="size-4" /></Link>
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
                        action={<Badge variant="outline">{formatHole(shot.courseHoleNumber, shot.courseHoleShotNumber)}</Badge>}
                      >
                        <DataPair label="Shot" value={shot.shotNumber ?? "--"} />
                        <DataPair label="Total" value={formatMetric(shot.totalYd)} />
                        <DataPair label="Side" value={formatMetric(shot.sideCarryYd)} />
                        <DataPair label="Launch" value={formatMetric(shot.launchAngleDeg)} />
                        <DataPair label="Ball mph" value={formatMetric(shot.ballSpeedMph)} />
                        <DataPair label="Smash" value={formatMetric(shot.smashFactor)} />
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
                    <TableHead className="text-right">Shot</TableHead>
                    <TableHead>Hole</TableHead>
                    <TableHead>Club</TableHead>
                    <TableHead className="text-right">Carry</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Side</TableHead>
                    <TableHead className="text-right">Launch</TableHead>
                    <TableHead className="text-right">Ball mph</TableHead>
                    <TableHead>Advanced</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {savedShots.map((shot) => (
                    <TableRow key={shot.id}>
                      <TableCell>{formatDate(shot.shotAt)}</TableCell>
                      <TableCell className="max-w-48 truncate">{shot.fileName ?? "--"}</TableCell>
                      <TableCell className="text-right">{shot.shotNumber ?? "--"}</TableCell>
                      <TableCell>{formatHole(shot.courseHoleNumber, shot.courseHoleShotNumber)}</TableCell>
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
                      <TableCell className="text-right">{formatMetric(shot.launchAngleDeg)}</TableCell>
                      <TableCell className="text-right">{formatMetric(shot.ballSpeedMph)}</TableCell>
                      <TableCell>
                        <details className="text-xs">
                          <summary className="cursor-pointer text-emerald-700">More</summary>
                          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-muted-foreground">
                            <dt>Club speed</dt><dd>{formatMetric(shot.clubSpeedMph)}</dd>
                            <dt>Direction</dt><dd>{formatMetric(shot.launchDirectionDeg)}</dd>
                            <dt>Apex</dt><dd>{formatMetric(shot.apexFt)}</dd>
                            <dt>Attack</dt><dd>{formatMetric(shot.attackAngleDeg)}</dd>
                            <dt>Path</dt><dd>{formatMetric(shot.clubPathDeg)}</dd>
                            <dt>Descent</dt><dd>{formatMetric(shot.descentAngleDeg)}</dd>
                            <dt>Smash</dt><dd>{formatMetric(shot.smashFactor)}</dd>
                            <dt>Est</dt><dd>{shot.clubDataEstType ?? "--"}</dd>
                          </dl>
                        </details>
                      </TableCell>
                    </TableRow>
                  ))}
                  {savedShots.length === 0 ? (
                    <TableRow><TableCell colSpan={11} className="h-24 text-center text-muted-foreground">No shots match these filters.</TableCell></TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </DataTableFrame>
          </CardContent>
        </Card>
    </PageShell>
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
    db.select({ type: clubs.type }).from(clubs).where(eq(clubs.userId, userId)).orderBy(asc(clubs.type)),
    db.select({ rowType: importRows.rowType, count: count() }).from(importRows).where(eq(importRows.userId, userId)).groupBy(importRows.rowType).orderBy(asc(importRows.rowType)),
    db.select({ id: sessions.id, fileName: sessions.fileName, type: sessions.type, courseName: sessions.courseName, date: sessions.date }).from(sessions).where(eq(sessions.userId, userId)).orderBy(desc(sessions.date), asc(sessions.fileName)),
    db.select({ sessionId: shots.sessionId, count: count() }).from(shots).where(eq(shots.userId, userId)).groupBy(shots.sessionId),
    db.select({ sessionId: importRows.sessionId, count: count() }).from(importRows).where(eq(importRows.userId, userId)).groupBy(importRows.sessionId),
    db.select({ value: count() }).from(shots).innerJoin(sessions, eq(shots.sessionId, sessions.id)).where(where),
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
      .orderBy(desc(shots.shotAt), asc(sessions.fileName), asc(shots.shotNumber))
      .limit(PAGE_SIZE)
      .offset((filters.page - 1) * PAGE_SIZE),
  ]);

  const shotCountBySessionId = new Map(shotCountsBySession.map((row) => [row.sessionId, row.count]));
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
  if (filters.q) clauses.push(sql`(${sessions.fileName} ilike ${`%${filters.q}%`} or ${sessions.courseName} ilike ${`%${filters.q}%`})`);
  if (filters.from) clauses.push(gte(shots.shotAt, new Date(`${filters.from}T00:00:00.000Z`)));
  if (filters.to) clauses.push(lte(shots.shotAt, new Date(`${filters.to}T23:59:59.999Z`)));

  return and(...clauses);
}

function parseFilters(params: Awaited<SearchParams>): ShotFilters {
  const page = Math.max(1, Number(first(params.page)) || 1);

  return {
    page,
    club: first(params.club),
    sessionId: first(params.sessionId),
    category: first(params.category),
    q: first(params.q).trim().slice(0, 120),
    from: dateParam(first(params.from)),
    to: dateParam(first(params.to)),
  };
}

function pageHref(filters: ShotFilters, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, page: page.toString() })) {
    if (value) params.set(key, value.toString());
  }
  return `/shots?${params.toString()}`;
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function dateParam(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="apple-panel-strong p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-normal">{integerFormatter.format(value)}</p>
    </div>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(value);
}

function formatMetric(value: number | null) {
  return value === null ? "--" : numberFormatter.format(value);
}

function formatSessionType(value: string) {
  if (value === "real_round") return "Real round";
  if (value === "simulated_course") return "Sim course";
  return value.split("_").filter(Boolean).map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
}

function isRoundSession(value: string) {
  return value === "round" || value === "simulator" || value === "simulated_course" || value === "real_round";
}

function formatHole(holeNumber: number | null, holeShotNumber: number | null) {
  if (!holeNumber) return "--";
  return holeShotNumber ? `${holeNumber}.${holeShotNumber}` : holeNumber.toString();
}

function formatShotClub(shot: { clubType: string; clubBrand: string | null; clubModel: string | null }) {
  return formatClubModelName({ type: shot.clubType, brand: shot.clubBrand, model: shot.clubModel });
}
