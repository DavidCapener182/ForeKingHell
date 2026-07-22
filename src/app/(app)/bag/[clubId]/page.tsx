import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Upload } from "lucide-react";
import { and, desc, eq } from "drizzle-orm";

import { Button } from "@/components/ui/button";
import { DesktopWorkbenchLayout } from "@/components/app/desktop-workbench";
import { BagFeaturePanel } from "@/components/features/feature-panels";
import { PageShell } from "@/components/premium";
import { clubs, sessions, shots } from "@/db/schema";
import { getDb } from "@/db/client";
import { isTrackedClubType } from "@/lib/club-format";
import { requireCurrentUserId } from "@/lib/current-user";
import { getFeatureIdeasData } from "@/lib/feature-ideas";
import { type AnalysisShot } from "@/app/bag/[clubId]/club-analysis-tabs";
import { ClubDetailClient } from "@/app/bag/[clubId]/club-detail-client";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    clubId: string;
  }>;
};

export default async function ClubDetailPage({ params }: PageProps) {
  const { clubId } = await params;
  const [club, featureData] = await Promise.all([getClubDetail(clubId), getFeatureIdeasData()]);

  if (!club) {
    notFound();
  }

  return (
    <PageShell>
      <DesktopWorkbenchLayout scope="club-profile">
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

        <ClubDetailClient club={club}>
          <BagFeaturePanel data={featureData} />
        </ClubDetailClient>
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

async function getClubDetail(clubId: string) {
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
      .where(and(eq(clubs.id, clubId), eq(clubs.userId, userId)))
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
        faceAngleDeg: shots.faceAngleDeg,
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
      .where(and(eq(shots.clubId, clubId), eq(shots.userId, userId), eq(sessions.userId, userId)))
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
    faceAngleDeg: shot.faceAngleDeg,
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
