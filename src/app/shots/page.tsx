import Link from "next/link";
import { ArrowLeft, Database, FileText, Flag, Upload } from "lucide-react";
import { asc, count, desc, eq } from "drizzle-orm";

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { clubs, importRows, sessions, shots } from "@/db/schema";
import { getDb } from "@/db/client";
import { isTrackedClubType } from "@/lib/club-format";

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

const integerFormatter = new Intl.NumberFormat("en-GB");

export default async function ShotsPage() {
  const { stats, rowTypes, sessionSummaries, savedShots } = await getShotDatabase();

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
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
                Saved data
              </Badge>
              <h1 className="text-4xl font-semibold tracking-normal text-balance sm:text-5xl">
                Shot database
              </h1>
              <p className="text-base leading-7 text-muted-foreground">
                Every saved shot metric, with the source CSV rows retained for parser improvements.
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

        <section className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
          <Card className="premium-card">
            <CardHeader>
              <CardTitle>Session imports</CardTitle>
              <CardDescription>Saved files, CSV dates, shot rows, and retained raw rows.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-[8px] border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead className="text-right">Shots</TableHead>
                      <TableHead className="text-right">Raw rows</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessionSummaries.map((session) => (
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
                        <TableCell className="max-w-48 truncate">{session.courseName ?? "--"}</TableCell>
                        <TableCell className="text-right">{integerFormatter.format(session.shotCount)}</TableCell>
                        <TableCell className="text-right">
                          {integerFormatter.format(session.rawRowCount)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {sessionSummaries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                          No imported sessions yet.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="premium-card">
            <CardHeader>
              <CardTitle>Raw CSV archive</CardTitle>
              <CardDescription>Non-shot rows are stored separately from normalized shots.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {rowTypes.map((rowType) => (
                <div key={rowType.rowType} className="rounded-[8px] border bg-[#f9fafb] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-medium capitalize">{rowType.rowType}</span>
                    {rowType.rowType === "shot" ? (
                      <Database className="size-4 text-emerald-500" />
                    ) : (
                      <FileText className="size-4 text-sky-500" />
                    )}
                  </div>
                  <p className="text-3xl font-semibold tracking-normal">
                    {integerFormatter.format(rowType.count)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <Card className="premium-card">
          <CardHeader>
            <CardTitle>All saved shot metrics</CardTitle>
            <CardDescription>{integerFormatter.format(savedShots.length)} rows in yards, feet, mph, and degrees.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-[8px] border">
              <Table className="min-w-[1700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead className="text-right">Shot</TableHead>
                    <TableHead>Hole</TableHead>
                    <TableHead>Club</TableHead>
                    <TableHead>Brand / model</TableHead>
                    <TableHead className="text-right">Carry yd</TableHead>
                    <TableHead className="text-right">Total yd</TableHead>
                    <TableHead className="text-right">Ball mph</TableHead>
                    <TableHead className="text-right">Club mph</TableHead>
                    <TableHead className="text-right">Launch deg</TableHead>
                    <TableHead className="text-right">Direction deg</TableHead>
                    <TableHead className="text-right">Apex ft</TableHead>
                    <TableHead className="text-right">Side yd</TableHead>
                    <TableHead className="text-right">Attack deg</TableHead>
                    <TableHead className="text-right">Path deg</TableHead>
                    <TableHead className="text-right">Descent deg</TableHead>
                    <TableHead className="text-right">Smash</TableHead>
                    <TableHead>Est type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {savedShots.map((shot) => (
                    <TableRow key={shot.id}>
                      <TableCell>{formatDate(shot.shotAt)}</TableCell>
                      <TableCell className="max-w-48 truncate">{shot.fileName ?? "--"}</TableCell>
                      <TableCell className="text-right">{shot.shotNumber ?? "--"}</TableCell>
                      <TableCell>{formatHole(shot.courseHoleNumber, shot.courseHoleShotNumber)}</TableCell>
                      <TableCell className="font-medium">{formatClub(shot.clubType)}</TableCell>
                      <TableCell className="max-w-64 truncate">
                        {formatBrandModel(shot.brand, shot.model)}
                      </TableCell>
                      <TableCell className="text-right">{formatMetric(shot.carryYd)}</TableCell>
                      <TableCell className="text-right">{formatMetric(shot.totalYd)}</TableCell>
                      <TableCell className="text-right">{formatMetric(shot.ballSpeedMph)}</TableCell>
                      <TableCell className="text-right">{formatMetric(shot.clubSpeedMph)}</TableCell>
                      <TableCell className="text-right">{formatMetric(shot.launchAngleDeg)}</TableCell>
                      <TableCell className="text-right">{formatMetric(shot.launchDirectionDeg)}</TableCell>
                      <TableCell className="text-right">{formatMetric(shot.apexFt)}</TableCell>
                      <TableCell className="text-right">{formatMetric(shot.sideCarryYd)}</TableCell>
                      <TableCell className="text-right">{formatMetric(shot.attackAngleDeg)}</TableCell>
                      <TableCell className="text-right">{formatMetric(shot.clubPathDeg)}</TableCell>
                      <TableCell className="text-right">{formatMetric(shot.descentAngleDeg)}</TableCell>
                      <TableCell className="text-right">{formatMetric(shot.smashFactor)}</TableCell>
                      <TableCell>{shot.clubDataEstType ?? "--"}</TableCell>
                    </TableRow>
                  ))}
                  {savedShots.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={19} className="h-24 text-center text-muted-foreground">
                        No saved shots yet.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

async function getShotDatabase() {
  const db = getDb();

  const [
    [shotCount],
    [rawRowCount],
    [sessionCount],
    clubRows,
    rowTypes,
    sessionRows,
    shotCountsBySession,
    rawCountsBySession,
    savedShots,
  ] = await Promise.all([
    db.select({ value: count() }).from(shots),
    db.select({ value: count() }).from(importRows),
    db.select({ value: count() }).from(sessions),
    db.select({ type: clubs.type }).from(clubs),
    db
      .select({
        rowType: importRows.rowType,
        count: count(),
      })
      .from(importRows)
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
      .orderBy(desc(sessions.date), asc(sessions.fileName)),
    db
      .select({
        sessionId: shots.sessionId,
        count: count(),
      })
      .from(shots)
      .groupBy(shots.sessionId),
    db
      .select({
        sessionId: importRows.sessionId,
        count: count(),
      })
      .from(importRows)
      .groupBy(importRows.sessionId),
    db
      .select({
        id: shots.id,
        fileName: sessions.fileName,
        shotAt: shots.shotAt,
        shotNumber: shots.shotNumber,
        courseHoleNumber: shots.courseHoleNumber,
        courseHoleShotNumber: shots.courseHoleShotNumber,
        clubType: shots.clubType,
        brand: clubs.brand,
        model: clubs.model,
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
      .orderBy(desc(shots.shotAt), asc(sessions.fileName), asc(shots.shotNumber)),
  ]);

  const shotCountBySessionId = new Map(
    shotCountsBySession.map((row) => [row.sessionId, row.count]),
  );
  const rawCountBySessionId = new Map(
    rawCountsBySession.map((row) => [row.sessionId, row.count]),
  );
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
  };
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[8px] border bg-[#f9fafb] p-3">
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

function formatBrandModel(brand: string | null, model: string | null) {
  return [brand, model].filter(Boolean).join(" ") || "--";
}

function formatSessionType(value: string) {
  if (value === "real_round") {
    return "Real round";
  }

  if (value === "simulated_course") {
    return "Sim course";
  }

  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function isRoundSession(value: string) {
  return value === "round" || value === "simulator" || value === "simulated_course" || value === "real_round";
}

function formatHole(holeNumber: number | null, holeShotNumber: number | null) {
  if (!holeNumber) {
    return "--";
  }

  return holeShotNumber ? `${holeNumber}.${holeShotNumber}` : holeNumber.toString();
}

function formatClub(value: string) {
  if (value === "driver") {
    return "Driver";
  }

  if (/^[1-9][wh]$/.test(value)) {
    return value.toUpperCase();
  }

  if (/^[1-9]i$/.test(value)) {
    return `${value[0]}i`;
  }

  return value.toUpperCase();
}
