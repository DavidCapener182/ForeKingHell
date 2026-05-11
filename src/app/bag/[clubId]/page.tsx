import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Upload } from "lucide-react";
import { desc, eq } from "drizzle-orm";

import { Button } from "@/components/ui/button";
import { clubs, sessions, shots } from "@/db/schema";
import { getDb } from "@/db/client";
import { isTrackedClubType } from "@/lib/club-format";
import { type AnalysisShot } from "./club-analysis-tabs";
import { ClubDetailClient } from "./club-detail-client";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    clubId: string;
  }>;
};

export default async function ClubDetailPage({ params }: PageProps) {
  const { clubId } = await params;
  const club = await getClubDetail(clubId);

  if (!club) {
    notFound();
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
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

        <ClubDetailClient club={club} />
      </div>
    </main>
  );
}

async function getClubDetail(clubId: string) {
  const db = getDb();
  const [clubRows, shotRows] = await Promise.all([
    db
      .select({
        id: clubs.id,
        type: clubs.type,
        brand: clubs.brand,
        model: clubs.model,
      })
      .from(clubs)
      .where(eq(clubs.id, clubId))
      .limit(1),
    db
      .select({
        id: shots.id,
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
        attackAngleDeg: shots.attackAngleDeg,
        clubPathDeg: shots.clubPathDeg,
        descentAngleDeg: shots.descentAngleDeg,
        smashFactor: shots.smashFactor,
        spinRate: shots.spinRate,
        spinAxis: shots.spinAxis,
        clubDataEstType: shots.clubDataEstType,
        shotCategory: shots.shotCategory,
        qualityTag: shots.qualityTag,
        courseHoleNumber: shots.courseHoleNumber,
        sessionType: sessions.type,
      })
      .from(shots)
      .innerJoin(sessions, eq(shots.sessionId, sessions.id))
      .where(eq(shots.clubId, clubId))
      .orderBy(desc(shots.shotAt), desc(shots.shotNumber)),
  ]);

  const club = clubRows[0];

  if (!club || !isTrackedClubType(club.type)) {
    return null;
  }

  const analysisShots: AnalysisShot[] = shotRows.map((shot) => ({
    id: shot.id,
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
    attackAngleDeg: shot.attackAngleDeg,
    clubPathDeg: shot.clubPathDeg,
    descentAngleDeg: shot.descentAngleDeg,
    smashFactor: shot.smashFactor,
    spinRate: shot.spinRate,
    spinAxis: shot.spinAxis,
    shotCategory: shot.shotCategory,
    qualityTag: shot.qualityTag,
    courseHoleNumber: shot.courseHoleNumber,
    sessionType: shot.sessionType,
    clubDataEstType: shot.clubDataEstType,
  }));

  return {
    ...club,
    shots: analysisShots,
  };
}
