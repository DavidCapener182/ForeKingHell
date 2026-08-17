import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { QuickBagClient, type QuickBagClub } from "@/app/quick-bag/quick-bag-client";
import { MobileAppShell, MobileTopBar } from "@/components/mobile-sports";
import { PageHeader, PageShell } from "@/components/premium";
import { getDb } from "@/db/client";
import { clubs, shots, stockYardages } from "@/db/schema";
import { formatClubType } from "@/lib/club-format";
import { requireCurrentUserId } from "@/lib/current-user";
import { buildShotPatternPoints, summarizeShotPattern } from "@/lib/shot-pattern-chart-data";

export const dynamic = "force-dynamic";

export default async function QuickBagPage() {
  const userId = await requireCurrentUserId();
  const clubs = await getQuickBag(userId);

  return (
    <PageShell>
      <MobileAppShell className="gap-5" data-quick-bag>
        <MobileTopBar title="Quick Bag" />
        <QuickBagClient clubs={clubs} accountId={userId} />
      </MobileAppShell>

      <section className="hidden gap-5 lg:grid" data-quick-bag-desktop>
        <PageHeader
          eyebrow={
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              On-course reference
            </p>
          }
          title="Quick Bag"
          description="Enter a target distance or search your bag to check the latest measured play number, carry range and miss pattern."
        />
        <QuickBagClient clubs={clubs} accountId={userId} />
      </section>
    </PageShell>
  );
}

async function getQuickBag(userId: string): Promise<QuickBagClub[]> {
  const rows = await getDb()
    .select({
      id: clubs.id,
      type: clubs.type,
      brand: clubs.brand,
      model: clubs.model,
      carryMedianYd: stockYardages.carryMedianYd,
      carryP25Yd: stockYardages.carryP25Yd,
      carryP75Yd: stockYardages.carryP75Yd,
      recommendedPlayNumberYd: stockYardages.recommendedPlayNumberYd,
      dispersionLeftYd: stockYardages.dispersionLeftYd,
      dispersionRightYd: stockYardages.dispersionRightYd,
      confidenceScore: stockYardages.confidenceScore,
      sampleSize: stockYardages.sampleSize,
      calculatedAt: stockYardages.calculatedAt,
    })
    .from(clubs)
    .leftJoin(
      stockYardages,
      and(eq(stockYardages.clubId, clubs.id), eq(stockYardages.userId, userId)),
    )
    .where(and(eq(clubs.userId, userId), eq(clubs.active, true)))
    .orderBy(asc(clubs.bagSection), asc(clubs.bagPosition), desc(stockYardages.calculatedAt));

  const seen = new Set<string>();
  const latestRows = rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
  const shotRows =
    latestRows.length > 0
      ? await getDb()
          .select({
            id: shots.id,
            clubId: shots.clubId,
            clubType: shots.clubType,
            carryYd: shots.carryYd,
            sideCarryYd: shots.sideCarryYd,
            apexFt: shots.apexFt,
            shotAt: shots.shotAt,
            qualityTag: shots.qualityTag,
          })
          .from(shots)
          .where(
            and(
              eq(shots.userId, userId),
              inArray(
                shots.clubId,
                latestRows.map((row) => row.id),
              ),
            ),
          )
          .orderBy(desc(shots.shotAt))
          .limit(800)
      : [];

  return latestRows.flatMap((row) => {
    const recentShots = shotRows.filter((shot) => shot.clubId === row.id).slice(0, 60);
    const trustedPattern = buildShotPatternPoints(recentShots).filter((shot) => shot.trusted);
    const summary = summarizeShotPattern(trustedPattern);
    const latestEvidenceDate =
      trustedPattern.find((shot) => shot.shotAt)?.shotAt ?? row.calculatedAt?.toISOString() ?? null;

    return [
      {
        id: row.id,
        label: formatClubType(row.type),
        model: [row.brand, row.model].filter(Boolean).join(" ") || "Current club",
        trustedCarryYd: row.carryMedianYd,
        playNumberYd: row.recommendedPlayNumberYd,
        lowYd: row.carryP25Yd,
        highYd: row.carryP75Yd,
        typicalMiss: summary.typicalMiss,
        widerSide: summary.widerSide,
        medianLateralYd: summary.medianSideYd,
        lateralLowYd: summary.sideLowYd,
        lateralHighYd: summary.sideHighYd,
        patternSampleSize: summary.sampleSize,
        confidence: Math.round(row.confidenceScore ?? 0),
        sampleSize: row.sampleSize ?? 0,
        latestEvidenceDate,
      },
    ];
  });
}
