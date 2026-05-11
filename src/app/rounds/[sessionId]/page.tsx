import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Database, MapPinned, Save, Upload } from "lucide-react";
import { asc, eq } from "drizzle-orm";

import {
  moveRoundShotHoleAction,
  moveRoundShotToHoleAction,
  resplitRoundAction,
  updateClubAction,
  updateRoundCourseLinkAction,
  updateRoundHoleAction,
  updateShotClubAction,
} from "@/app/rounds/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { clubs, courses, holes as courseHoles, sessions, shots, teeSets } from "@/db/schema";
import { getDb } from "@/db/client";
import { calculateRoundDifferential, formatHandicapValue } from "@/lib/round-handicap";
import { formatClubType } from "@/lib/rapsodo/parser";
import { RoundShotMap, type RoundMapHole, type RoundMapShot } from "./round-shot-map";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});
const integerFormatter = new Intl.NumberFormat("en-GB");

const CLUB_TYPE_OPTIONS = [
  "driver",
  "3w",
  "5w",
  "7w",
  "3h",
  "4h",
  "5h",
  "4i",
  "5i",
  "6i",
  "7i",
  "8i",
  "9i",
  "pw",
  "gw",
  "sw",
  "lw",
];

export default async function RoundDetailPage({ params }: PageProps) {
  const { sessionId } = await params;
  const round = await getRoundDetail(sessionId);

  if (!round) {
    notFound();
  }

  const isRealRound = round.session.type === "real_round";
  const hasClubData = round.shots.length > 0;
  const hasMap = round.mapHoles.length > 0;

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <Button asChild variant="ghost" className="px-0">
            <Link href="/rounds">
              <ArrowLeft className="size-4" />
              Rounds
            </Link>
          </Button>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/shots">
                <Database className="size-4" />
                Shots
              </Link>
            </Button>
            <Button asChild>
              <Link href="/import">
                <Upload className="size-4" />
                Import CSV
              </Link>
            </Button>
          </div>
        </div>

        <header className="premium-hero p-5 sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-2">
              <Badge className="w-fit bg-sky-100 text-sky-700 hover:bg-sky-100">
                {formatSessionType(round.session.type)}
              </Badge>
              <h1 className="text-4xl font-semibold tracking-normal text-balance sm:text-5xl">
                {round.session.courseName ?? round.session.fileName ?? "Round review"}
              </h1>
              <p className="text-base leading-7 text-muted-foreground">
                {formatDate(round.session.date)} -{" "}
                {isRealRound
                  ? "Scorecard-only real round with no club data."
                  : `${round.session.fileName ?? "CSV import"} - ${integerFormatter.format(
                      round.shots.length,
                    )} launch monitor shots.`}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[560px]">
              <StatTile label="Score" value={round.totalScore} />
              <StatTile label="Par" value={round.totalPar} />
              <StatTile label="Putts" value={round.totalPutts} />
              <StatTile
                label="Diff"
                value={formatHandicapValue(round.handicapDifferential)}
              />
            </div>
          </div>
        </header>

        <Card className="premium-card">
          <CardHeader>
            <CardTitle>Course link</CardTitle>
            <CardDescription>
              Change the course or tee set used by the scorecard, handicap calculation, and hole map.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateRoundCourseLinkAction} className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-end">
              <input type="hidden" name="sessionId" value={round.session.id} />
              <label className="grid gap-2 text-sm font-medium">
                <span>Course / tee set</span>
                <select
                  name="teeSetId"
                  defaultValue={round.session.teeSetId ?? ""}
                  className="h-11 rounded-xl border border-input bg-white px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="" disabled>
                    Select course
                  </option>
                  {round.courseOptions.map((option) => (
                    <option key={option.teeSetId} value={option.teeSetId}>
                      {option.courseName} - {option.teeSetName}
                      {option.courseRating && option.slopeRating ? ` (${numberFormatter.format(option.courseRating)}/${option.slopeRating})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" className="h-11 rounded-xl bg-[#111827] text-white">
                <Save className="size-4" />
                Update link
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-xl">
                <Link
                  href={round.session.courseId ? `/courses/${round.session.courseId}/holes` : "/courses"}
                  prefetch={false}
                >
                  <MapPinned className="size-4" />
                  Edit course
                </Link>
              </Button>
            </form>
          </CardContent>
        </Card>

        {hasMap ? (
          <Card className="premium-card">
            <CardHeader>
              <CardTitle>{hasClubData ? "Actual hole map" : "Estimated hole map"}</CardTitle>
              <CardDescription>
                {hasClubData
                  ? "Select a hole to see the saved simulator shots projected over the real course."
                  : "Select a hole to see estimated non-putt shots placed along the mapped Mountain Park hole geometry."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RoundShotMap
                sessionId={round.session.id}
                holes={round.mapHoles}
                shots={round.mapShots}
                courseName={round.session.courseName ?? "Course map"}
                moveShotToHoleAction={hasClubData ? moveRoundShotToHoleAction : undefined}
                shotMode={hasClubData ? "actual" : "estimated"}
              />
            </CardContent>
          </Card>
        ) : null}

        {hasClubData ? (
          <Card className="premium-card">
            <CardHeader>
              <CardTitle>Shot-to-hole split</CardTitle>
              <CardDescription>
                Change the CSV shot count for each hole, then re-split the round in original shot order.
                Use this when the simulator CSV boundary is off by a shot.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={resplitRoundAction} className="space-y-4">
                <input type="hidden" name="sessionId" value={round.session.id} />
                <div className="grid gap-2 sm:grid-cols-6 lg:grid-cols-9">
                  {round.holes.map((hole) => (
                    <label key={hole.holeNumber} className="rounded-[8px] border bg-[#f9fafb] p-2">
                      <span className="text-xs text-muted-foreground">Hole {hole.holeNumber}</span>
                      <Input
                        name={`holeCount-${hole.holeNumber}`}
                        type="number"
                        min={0}
                        max={12}
                        defaultValue={hole.shots.length}
                        className="mt-1 h-9 border-0 bg-white px-2 text-base font-semibold shadow-none"
                      />
                    </label>
                  ))}
                </div>
                <div className="flex flex-col justify-between gap-3 rounded-[8px] border bg-[#f9fafb] p-3 sm:flex-row sm:items-center">
                  <p className="text-sm text-muted-foreground">
                    Current split assigns {integerFormatter.format(round.shots.length - round.unmappedShots.length)}
                    /{integerFormatter.format(round.shots.length)} CSV shots.
                  </p>
                  <Button type="submit" className="bg-[#111827] text-white">
                    <Save className="size-4" />
                    Re-split round
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card className="premium-card">
            <CardHeader>
              <CardTitle>Real round data</CardTitle>
              <CardDescription>
                This scorecard is saved without launch-monitor shots, so it contributes to real and combined handicap but not bag or simulator stats.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <MiniMetric label="Net" value={formatNullableInteger(round.totalNetScore)} />
              <MiniMetric label="FIR / GIR" value={`${round.fairwaysHit} / ${round.gir}`} />
              <MiniMetric label="Chips" value={formatNullableInteger(round.totalChipShots)} />
              <MiniMetric label="Sand" value={formatNullableInteger(round.totalSandShots)} />
              <MiniMetric label="Penalties" value={formatNullableInteger(round.totalPenalties)} />
              <MiniMetric label="Map estimates" value={integerFormatter.format(round.mapShots.length)} />
            </CardContent>
          </Card>
        )}

        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="premium-card">
            <CardHeader>
              <CardTitle>Hole-by-hole scorecard</CardTitle>
              <CardDescription>
                {isRealRound
                  ? "Edit score, putts, short-game stats, fairway hit and GIR for this real round."
                  : "Edit score, putts, missing strokes, fairway hit and GIR after the import. Missing strokes cover penalties or shots the simulator CSV did not include."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {round.holes.map((hole) => (
                  <form
                    key={hole.holeNumber}
                    action={updateRoundHoleAction}
                    className="rounded-[8px] border bg-[#f9fafb] p-3"
                  >
                    <input type="hidden" name="sessionId" value={round.session.id} />
                    <input type="hidden" name="holeNumber" value={hole.holeNumber} />
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">Hole {hole.holeNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatHoleSummary(hole)}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {hasClubData ? `${hole.shots.length} CSV shots` : "Real scorecard"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <RoundNumberInput label="Score" name="score" value={hole.score} />
                      <RoundNumberInput label="Putts" name="putts" value={hole.putts} />
                      <RoundNumberInput label="Missing" name="penalties" value={hole.penalties} />
                    </div>
                    {isRealRound ? (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <RoundNumberInput label="Chips" name="chipShots" value={hole.chipShots} />
                        <RoundNumberInput label="Sand" name="greensideSandShots" value={hole.greensideSandShots} />
                      </div>
                    ) : null}
                    <div className="mt-2 grid grid-cols-3 gap-2 rounded-[8px] border bg-white p-2">
                      {isRealRound ? (
                        <>
                          <MiniMetric label="Net" value={formatNullableInteger(hole.netScore)} />
                          <MiniMetric label="Chips" value={formatNullableInteger(hole.chipShots)} />
                          <MiniMetric label="Sand" value={formatNullableInteger(hole.greensideSandShots)} />
                        </>
                      ) : (
                        <>
                          <MiniMetric label="Launch" value={hole.shots.length.toString()} />
                          <MiniMetric label="Putts" value={formatNullableInteger(hole.putts)} />
                          <MiniMetric label="Missing" value={formatNullableInteger(hole.penalties)} />
                        </>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {strokeAccountingLabel(hole)}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <RoundSelect label="Fairway" name="fairwayHit" value={hole.fairwayHit} />
                      <RoundSelect label="GIR" name="gir" value={hole.gir} />
                    </div>
                    <Button type="submit" variant="outline" size="sm" className="mt-3 w-full">
                      <Save className="size-4" />
                      Save hole
                    </Button>
                  </form>
                ))}
              </div>
            </CardContent>
          </Card>

          {hasClubData ? (
            <Card className="premium-card">
              <CardHeader>
                <CardTitle>Clubs in this round</CardTitle>
                <CardDescription>
                  Fix a club name, brand, or model once and all shots linked to that club update.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {round.roundClubs.map((club) => (
                  <form key={club.id} action={updateClubAction} className="rounded-[8px] border bg-[#f9fafb] p-3">
                    <input type="hidden" name="sessionId" value={round.session.id} />
                    <input type="hidden" name="clubId" value={club.id} />
                    <div className="grid gap-2 sm:grid-cols-[0.8fr_1fr_1fr_auto]">
                      <label className="space-y-1">
                        <span className="text-xs text-muted-foreground">Type</span>
                        <ClubTypeSelect name="clubType" value={club.type} />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs text-muted-foreground">Brand</span>
                        <Input name="brand" defaultValue={club.brand ?? ""} className="h-9" />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs text-muted-foreground">Model</span>
                        <Input name="model" defaultValue={club.model ?? ""} className="h-9" />
                      </label>
                      <div className="flex items-end">
                        <Button type="submit" size="sm" className="w-full">
                          Save
                        </Button>
                      </div>
                    </div>
                  </form>
                ))}
                {round.roundClubs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No clubs are linked to this round.</p>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            <Card className="premium-card">
              <CardHeader>
                <CardTitle>Handicap input</CardTitle>
                <CardDescription>
                  Real rounds use the saved tee rating and slope for the rounds handicap estimate.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <MiniMetric label="Tee" value={round.session.teeName ?? "--"} />
                <MiniMetric label="Rating / slope" value={formatRatingSlope(round.session.courseRating, round.session.slopeRating)} />
                <MiniMetric label="Gross / net" value={`${formatNullableInteger(round.totalScore)} / ${formatNullableInteger(round.totalNetScore)}`} />
                <MiniMetric label="Differential" value={formatHandicapValue(round.handicapDifferential)} />
              </CardContent>
            </Card>
          )}
        </section>

        {hasClubData ? (
        <Card className="premium-card">
          <CardHeader>
            <CardTitle>Shot club corrections</CardTitle>
            <CardDescription>
              Use this when the CSV club is wrong for a single shot. The selected club controls where the
              shot appears in the bag map.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-[8px] border">
              <Table className="min-w-[1120px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Hole</TableHead>
                    <TableHead className="text-right">Shot</TableHead>
                    <TableHead>Current club</TableHead>
                    <TableHead className="text-right">Carry</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Side</TableHead>
                    <TableHead>Move</TableHead>
                    <TableHead>Move to</TableHead>
                    <TableHead>Change club</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {round.shots.map((shot) => (
                    <TableRow key={shot.id}>
                      <TableCell>{formatHole(shot.courseHoleNumber, shot.courseHoleShotNumber)}</TableCell>
                      <TableCell className="text-right">{shot.shotNumber ?? "--"}</TableCell>
                      <TableCell className="font-medium">{clubLabel(shot)}</TableCell>
                      <TableCell className="text-right">{formatMetric(shot.carryYd)} yd</TableCell>
                      <TableCell className="text-right">{formatMetric(shot.totalYd)} yd</TableCell>
                      <TableCell className="text-right">{formatMetric(shot.sideCarryYd)} yd</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <MoveShotButton
                            sessionId={round.session.id}
                            shotId={shot.id}
                            direction="previous"
                            disabled={!shot.courseHoleNumber || shot.courseHoleNumber <= 1}
                          />
                          <MoveShotButton
                            sessionId={round.session.id}
                            shotId={shot.id}
                            direction="next"
                            disabled={!shot.courseHoleNumber || shot.courseHoleNumber >= round.holes.length}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <MoveShotToHoleForm
                          sessionId={round.session.id}
                          shotId={shot.id}
                          currentHoleNumber={shot.courseHoleNumber}
                          holeNumbers={round.holes.map((hole) => hole.holeNumber)}
                        />
                      </TableCell>
                      <TableCell>
                        <form action={updateShotClubAction} className="flex gap-2">
                          <input type="hidden" name="sessionId" value={round.session.id} />
                          <input type="hidden" name="shotId" value={shot.id} />
                          <select
                            name="clubId"
                            defaultValue={shot.clubId}
                            className="h-9 min-w-48 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                          >
                            {round.allClubs.map((club) => (
                              <option key={club.id} value={club.id}>
                                {clubLabel(club)}
                              </option>
                            ))}
                          </select>
                          <Button type="submit" size="sm" variant="outline">
                            Save
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))}
                  {round.shots.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                        No shots are linked to this round.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        ) : null}

        {round.unmappedShots.length > 0 ? (
          <Card className="premium-card border-amber-300 bg-amber-50">
            <CardHeader>
              <CardTitle>Unmapped shots</CardTitle>
              <CardDescription>
                These shots have no hole assignment. Re-import with adjusted hole shot counts if the split
                needs to change.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{integerFormatter.format(round.unmappedShots.length)} shots are unmapped.</p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}

async function getRoundDetail(sessionId: string) {
  const db = getDb();
  const [session] = await db
    .select({
      id: sessions.id,
      fileName: sessions.fileName,
      type: sessions.type,
      courseName: sessions.courseName,
      date: sessions.date,
      courseId: sessions.courseId,
      teeSetId: sessions.teeSetId,
      scorecardJson: sessions.scorecardJson,
      teeName: teeSets.name,
      courseRating: teeSets.courseRating,
      slopeRating: teeSets.slopeRating,
    })
    .from(sessions)
    .leftJoin(teeSets, eq(sessions.teeSetId, teeSets.id))
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!session) {
    return null;
  }

  const [shotRows, clubRows, courseHoleRows, teeSetOptionRows] = await Promise.all([
    db
      .select({
        id: shots.id,
        clubId: shots.clubId,
        shotNumber: shots.shotNumber,
        courseHoleNumber: shots.courseHoleNumber,
        courseHoleShotNumber: shots.courseHoleShotNumber,
        clubType: shots.clubType,
        brand: clubs.brand,
        model: clubs.model,
        carryYd: shots.carryYd,
        totalYd: shots.totalYd,
        sideCarryYd: shots.sideCarryYd,
        distanceRemainingYd: shots.distanceRemainingYd,
        courseHoleYards: shots.courseHoleYards,
      })
      .from(shots)
      .innerJoin(clubs, eq(shots.clubId, clubs.id))
      .where(eq(shots.sessionId, sessionId))
      .orderBy(asc(shots.courseHoleNumber), asc(shots.courseHoleShotNumber), asc(shots.shotNumber)),
    db
      .select({
        id: clubs.id,
        type: clubs.type,
        brand: clubs.brand,
        model: clubs.model,
        active: clubs.active,
      })
      .from(clubs)
      .orderBy(asc(clubs.type), asc(clubs.brand), asc(clubs.model)),
    session.teeSetId
      ? db
          .select({
            holeNumber: courseHoles.holeNumber,
            par: courseHoles.par,
            yards: courseHoles.yards,
            strokeIndex: courseHoles.strokeIndex,
            centerlineGeojson: courseHoles.centerlineGeojson,
          })
          .from(courseHoles)
          .where(eq(courseHoles.teeSetId, session.teeSetId))
          .orderBy(asc(courseHoles.holeNumber))
      : Promise.resolve([]),
    db
      .select({
        teeSetId: teeSets.id,
        teeSetName: teeSets.name,
        courseId: teeSets.courseId,
        courseName: courses.name,
        courseRating: teeSets.courseRating,
        slopeRating: teeSets.slopeRating,
      })
      .from(teeSets)
      .innerJoin(courses, eq(teeSets.courseId, courses.id))
      .orderBy(asc(courses.name), asc(teeSets.name)),
  ]);

  const scorecard = session.scorecardJson ?? [];
  const shotByHole = new Map<number, typeof shotRows>();

  for (const shot of shotRows) {
    if (!shot.courseHoleNumber) {
      continue;
    }

    const existing = shotByHole.get(shot.courseHoleNumber) ?? [];
    existing.push(shot);
    shotByHole.set(shot.courseHoleNumber, existing);
  }

  const holes = scorecard.map((hole) => ({
    ...hole,
    shots: shotByHole.get(hole.holeNumber) ?? [],
  }));
  const roundClubIds = new Set(shotRows.map((shot) => shot.clubId));
  const roundClubs = clubRows.filter((club) => roundClubIds.has(club.id));
  const totalScore = sumNullable(holes.map((hole) => hole.score ?? null));
  const totalNetScore = sumNullable(holes.map((hole) => hole.netScore ?? null));
  const totalPutts = sumNullable(holes.map((hole) => hole.putts ?? null));
  const totalChipShots = sumNullable(holes.map((hole) => hole.chipShots ?? null));
  const totalSandShots = sumNullable(holes.map((hole) => hole.greensideSandShots ?? null));
  const totalPenalties = sumNullable(holes.map((hole) => hole.penalties ?? null));
  const totalPar = holes.length > 0 ? holes.reduce((total, hole) => total + hole.par, 0) : null;
  const handicapDifferential =
    calculateRoundDifferential({
      totalScore,
      totalPar,
      courseRating: session.courseRating,
      slopeRating: session.slopeRating,
    });
  const mapHoles = buildMapHoles(courseHoleRows, holes);
  const actualMapShots: RoundMapShot[] = shotRows.map((shot) => ({
    id: shot.id,
    holeNumber: shot.courseHoleNumber,
    holeShotNumber: shot.courseHoleShotNumber,
    shotNumber: shot.shotNumber,
    clubType: shot.clubType,
    carryYd: shot.carryYd,
    totalYd: shot.totalYd,
    sideCarryYd: shot.sideCarryYd,
    distanceRemainingYd: shot.distanceRemainingYd,
    courseHoleYards: shot.courseHoleYards,
  }));
  const mapShots =
    session.type === "real_round" && shotRows.length === 0
      ? buildEstimatedMapShots(mapHoles, holes)
      : actualMapShots;

  return {
    session,
    holes,
    shots: shotRows,
    allClubs: clubRows.filter((club) => club.active || roundClubIds.has(club.id)),
    roundClubs,
    unmappedShots: shotRows.filter((shot) => !shot.courseHoleNumber),
    totalScore,
    totalNetScore,
    totalPutts,
    totalChipShots,
    totalSandShots,
    totalPenalties,
    totalPar,
    handicapDifferential,
    mapHoles,
    mapShots,
    courseOptions: teeSetOptionRows,
    fairwaysHit: holes.filter((hole) => hole.fairwayHit === true).length,
    gir: holes.filter((hole) => hole.gir === true).length,
  };
}

function buildMapHoles(
  courseHoleRows: Array<{
    holeNumber: number;
    par: number;
    yards: number;
    strokeIndex: number | null;
    centerlineGeojson: { type: "LineString"; coordinates: Array<[number, number]> };
  }>,
  holes: Array<{
    holeNumber: number;
    par: number;
    yards: number;
    score?: number | null;
    putts?: number | null;
  }>,
): RoundMapHole[] {
  const courseHoleByNumber = new Map(courseHoleRows.map((hole) => [hole.holeNumber, hole]));

  return holes
    .map((hole) => {
      const courseHole = courseHoleByNumber.get(hole.holeNumber);

      return {
        holeNumber: hole.holeNumber,
        par: courseHole?.par ?? hole.par,
        yards: hole.yards > 0 ? hole.yards : courseHole?.yards ?? 0,
        score: hole.score ?? null,
        putts: hole.putts ?? null,
        geometry:
          courseHole?.centerlineGeojson.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]) ?? [],
      };
    })
    .filter((hole) => hole.geometry.length > 0);
}

function buildEstimatedMapShots(
  mapHoles: RoundMapHole[],
  holes: Array<{
    holeNumber: number;
    score?: number | null;
    putts?: number | null;
  }>,
): RoundMapShot[] {
  const scorecardHoleByNumber = new Map(holes.map((hole) => [hole.holeNumber, hole]));

  return mapHoles.flatMap((hole) => {
    const scorecardHole = scorecardHoleByNumber.get(hole.holeNumber);

    if (!scorecardHole || typeof scorecardHole.score !== "number") {
      return [];
    }

    const putts = scorecardHole.putts ?? 0;
    const estimatedShotCount = Math.max(1, scorecardHole.score - putts);
    const segmentYards = hole.yards > 0 ? hole.yards / estimatedShotCount : null;

    return Array.from({ length: estimatedShotCount }, (_, index) => {
      const progress = (index + 1) / estimatedShotCount;
      const distanceRemainingYd = hole.yards > 0 ? roundOne(Math.max(0, hole.yards * (1 - progress))) : null;

      return {
        id: `estimated-${hole.holeNumber}-${index + 1}`,
        holeNumber: hole.holeNumber,
        holeShotNumber: index + 1,
        shotNumber: index + 1,
        clubType: "estimated-shot",
        carryYd: segmentYards === null ? null : roundOne(segmentYards),
        totalYd: segmentYards === null ? null : roundOne(segmentYards),
        sideCarryYd: 0,
        distanceRemainingYd,
        courseHoleYards: hole.yards > 0 ? hole.yards : null,
      };
    });
  });
}

function formatHoleSummary(hole: {
  par: number;
  yards: number;
  strokeIndex?: number | null;
}) {
  const parts = [`Par ${hole.par}`];

  if (hole.yards > 0) {
    parts.push(`${hole.yards.toLocaleString("en-GB")} yd`);
  }

  if (hole.strokeIndex) {
    parts.push(`SI ${hole.strokeIndex}`);
  }

  return parts.join(" - ");
}

function RoundNumberInput({
  label,
  name,
  value,
}: {
  label: string;
  name: string;
  value: number | null | undefined;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Input name={name} type="number" min={0} defaultValue={value ?? ""} className="h-9" />
    </label>
  );
}

function MoveShotButton({
  sessionId,
  shotId,
  direction,
  disabled,
}: {
  sessionId: string;
  shotId: string;
  direction: "previous" | "next";
  disabled: boolean;
}) {
  return (
    <form action={moveRoundShotHoleAction}>
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="shotId" value={shotId} />
      <input type="hidden" name="direction" value={direction} />
      <Button type="submit" variant="outline" size="sm" disabled={disabled}>
        {direction === "previous" ? "Prev" : "Next"}
      </Button>
    </form>
  );
}

function MoveShotToHoleForm({
  sessionId,
  shotId,
  currentHoleNumber,
  holeNumbers,
}: {
  sessionId: string;
  shotId: string;
  currentHoleNumber: number | null;
  holeNumbers: number[];
}) {
  return (
    <form action={moveRoundShotToHoleAction} className="flex gap-2">
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="shotId" value={shotId} />
      <select
        name="targetHoleNumber"
        defaultValue={currentHoleNumber ?? ""}
        className="h-9 min-w-24 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <option value="" disabled>
          Hole
        </option>
        {holeNumbers.map((holeNumber) => (
          <option key={holeNumber} value={holeNumber}>
            Hole {holeNumber}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="outline">
        Move
      </Button>
    </form>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function RoundSelect({
  label,
  name,
  value,
}: {
  label: string;
  name: string;
  value: boolean | null | undefined;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <select
        name={name}
        defaultValue={value === null || value === undefined ? "null" : String(value)}
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <option value="null">-</option>
        <option value="true">Hit</option>
        <option value="false">Miss</option>
      </select>
    </label>
  );
}

function ClubTypeSelect({ name, value }: { name: string; value: string }) {
  const options = CLUB_TYPE_OPTIONS.includes(value) ? CLUB_TYPE_OPTIONS : [value, ...CLUB_TYPE_OPTIONS];

  return (
    <select
      name={name}
      defaultValue={value}
      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {formatClubType(option)}
        </option>
      ))}
    </select>
  );
}

function StatTile({ label, value }: { label: string; value: number | string | null }) {
  return (
    <div className="rounded-[8px] border bg-[#f9fafb] p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-normal">
        {typeof value === "number" ? integerFormatter.format(value) : value ?? "--"}
      </p>
    </div>
  );
}

function sumNullable(values: Array<number | null>) {
  const present = values.filter((value): value is number => typeof value === "number");
  return present.length > 0 ? present.reduce((total, value) => total + value, 0) : null;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
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

function formatHole(holeNumber: number | null, holeShotNumber: number | null) {
  if (!holeNumber) {
    return "--";
  }

  return holeShotNumber ? `${holeNumber}.${holeShotNumber}` : holeNumber.toString();
}

function formatMetric(value: number | null) {
  return value === null ? "--" : numberFormatter.format(value);
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function formatNullableInteger(value: number | null | undefined) {
  return typeof value === "number" ? integerFormatter.format(value) : "--";
}

function formatRatingSlope(rating: number | null, slope: number | null) {
  if (typeof rating !== "number" || typeof slope !== "number") {
    return "--";
  }

  return `${numberFormatter.format(rating)} / ${integerFormatter.format(slope)}`;
}

function strokeAccountingLabel(hole: {
  shots: unknown[];
  putts?: number | null;
  penalties?: number | null;
  score?: number | null;
  chipShots?: number | null;
  greensideSandShots?: number | null;
}) {
  const launchShots = hole.shots.length;
  const putts = hole.putts ?? 0;
  const missing = hole.penalties ?? 0;
  const chips = hole.chipShots ?? 0;
  const sand = hole.greensideSandShots ?? 0;
  const accounted = launchShots + putts + missing;

  if (launchShots === 0) {
    return `${putts} putts, ${chips} chips, ${sand} sand shots, ${missing} penalties.`;
  }

  if (typeof hole.score !== "number") {
    return `${launchShots} launch shots + ${putts} putts + ${missing} missing strokes.`;
  }

  return `${launchShots} launch shots + ${putts} putts + ${missing} missing strokes = ${accounted}/${hole.score}.`;
}

function clubLabel(club: { type?: string; clubType?: string; brand: string | null; model: string | null }) {
  const type = club.type ?? club.clubType ?? "unknown";
  const details = [club.brand, club.model].filter(Boolean).join(" ");
  return details ? `${formatClubType(type)} - ${details}` : formatClubType(type);
}
