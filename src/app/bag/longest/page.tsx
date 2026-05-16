import Link from "next/link";
import { ArrowLeft, Upload } from "lucide-react";
import { and, asc, desc, eq } from "drizzle-orm";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { clubs, shots } from "@/db/schema";
import { getDb } from "@/db/client";
import { clubAccent, clubSortValue, isShortGameTouchClubType, isTrackedClubType } from "@/lib/club-format";
import { requireCurrentUserId } from "@/lib/current-user";
import { LongestShotsSection, type LongestShot } from "../longest-shots-section";

export const dynamic = "force-dynamic";

export default async function LongestShotsPage() {
  const longestShots = await getLongestShots();

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <Button asChild variant="ghost" className="px-0">
            <Link href="/bag">
              <ArrowLeft className="size-4" />
              Bag map
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/import">
              <Upload className="size-4" />
              Import CSV
            </Link>
          </Button>
        </div>

        <header className="premium-hero p-5 sm:p-7">
          <div className="max-w-3xl space-y-2">
            <Badge className="w-fit bg-amber-100 text-amber-700 hover:bg-amber-100">
              Shot simulator
            </Badge>
            <h1 className="text-4xl font-semibold tracking-normal text-balance sm:text-5xl">
              Longest shot simulator
            </h1>
            <p className="text-base leading-7 text-muted-foreground">
              Select a club to replay its best total-distance shot with tracer, curve, carry, launch, apex, and spin.
            </p>
          </div>
        </header>

        {longestShots.length > 0 ? (
          <LongestShotsSection shots={longestShots} />
        ) : (
          <Card className="premium-card">
            <CardContent className="py-12 text-center">
              <p className="text-lg font-medium">No longest shots yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Import Rapsodo CSVs to build the shot simulator.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

async function getLongestShots() {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const [clubRows, shotRows] = await Promise.all([
    db
      .select({
        id: clubs.id,
        type: clubs.type,
        brand: clubs.brand,
        model: clubs.model,
      })
      .from(clubs)
      .where(and(eq(clubs.userId, userId), eq(clubs.active, true)))
      .orderBy(asc(clubs.type)),
    db
      .select({
        id: shots.id,
        clubId: shots.clubId,
        shotNumber: shots.shotNumber,
        shotAt: shots.shotAt,
        carryYd: shots.carryYd,
        totalYd: shots.totalYd,
        sideCarryYd: shots.sideCarryYd,
        ballSpeedMph: shots.ballSpeedMph,
        clubSpeedMph: shots.clubSpeedMph,
        launchAngleDeg: shots.launchAngleDeg,
        launchDirectionDeg: shots.launchDirectionDeg,
        apexFt: shots.apexFt,
        descentAngleDeg: shots.descentAngleDeg,
        spinRate: shots.spinRate,
        spinAxis: shots.spinAxis,
      })
      .from(shots)
      .where(eq(shots.userId, userId))
      .orderBy(desc(shots.shotAt)),
  ]);

  const shotsByClub = new Map<string, LongestShotRow[]>();
  for (const shot of shotRows) {
    const clubShots = shotsByClub.get(shot.clubId) ?? [];
    clubShots.push(shot);
    shotsByClub.set(shot.clubId, clubShots);
  }

  return clubRows
    .filter((club) => isTrackedClubType(club.type) && !isShortGameTouchClubType(club.type))
    .map((club) => {
      const longestShot = findLongestShot(shotsByClub.get(club.id) ?? []);

      if (!longestShot) {
        return null;
      }

      const brandModel = [club.brand, club.model].filter(Boolean).join(" ") || "Unspecified model";

      return toLongestShot({
        shot: longestShot,
        clubId: club.id,
        clubType: club.type,
        brandModel,
        accent: clubAccent(club.type),
      });
    })
    .filter((shot): shot is LongestShot => shot !== null)
    .sort((left, right) => clubSortValue(left.clubType) - clubSortValue(right.clubType));
}

type LongestShotRow = {
  id: string;
  clubId: string;
  shotNumber: number | null;
  shotAt: Date;
  carryYd: number | null;
  totalYd: number | null;
  sideCarryYd: number | null;
  ballSpeedMph: number | null;
  clubSpeedMph: number | null;
  launchAngleDeg: number | null;
  launchDirectionDeg: number | null;
  apexFt: number | null;
  descentAngleDeg: number | null;
  spinRate: number | null;
  spinAxis: number | null;
};

function findLongestShot(shots: LongestShotRow[]) {
  return shots.reduce<LongestShotRow | null>((longest, shot) => {
    const shotDistance = shot.totalYd ?? shot.carryYd;

    if (shotDistance === null) {
      return longest;
    }

    const longestDistance = longest ? longest.totalYd ?? longest.carryYd : null;
    return longestDistance === null || shotDistance > longestDistance ? shot : longest;
  }, null);
}

function toLongestShot({
  shot,
  clubId,
  clubType,
  brandModel,
  accent,
}: {
  shot: LongestShotRow;
  clubId: string;
  clubType: string;
  brandModel: string;
  accent: string;
}): LongestShot {
  return {
    id: shot.id,
    clubId,
    clubType,
    brandModel,
    accent,
    shotNumber: shot.shotNumber,
    shotAt: shot.shotAt.toISOString(),
    carryYd: shot.carryYd,
    totalYd: shot.totalYd,
    sideCarryYd: shot.sideCarryYd,
    ballSpeedMph: shot.ballSpeedMph,
    clubSpeedMph: shot.clubSpeedMph,
    launchAngleDeg: shot.launchAngleDeg,
    launchDirectionDeg: shot.launchDirectionDeg,
    apexFt: shot.apexFt,
    descentAngleDeg: shot.descentAngleDeg,
    spinRate: shot.spinRate,
    spinAxis: shot.spinAxis,
  };
}
