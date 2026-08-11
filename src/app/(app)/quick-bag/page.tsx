import { and, asc, desc, eq } from "drizzle-orm";

import { QuickBagClient, type QuickBagClub } from "@/app/quick-bag/quick-bag-client";
import { MobileAppShell, MobileTopBar } from "@/components/mobile-sports";
import { PageShell } from "@/components/premium";
import { getDb } from "@/db/client";
import { clubs, stockYardages } from "@/db/schema";
import { formatClubType } from "@/lib/club-format";
import { requireCurrentUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function QuickBagPage() {
  const userId = await requireCurrentUserId();
  const clubs = await getQuickBag(userId);

  return (
    <PageShell>
      <MobileAppShell className="gap-5" data-quick-bag>
        <MobileTopBar title="Quick Bag" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Which number can you trust?</h1>
          <p className="mt-1 text-[15px] leading-6 text-muted-foreground">
            Search a club or target distance. Numbers come from your latest measured stock-yardage
            evidence.
          </p>
        </div>
        <QuickBagClient clubs={clubs} accountId={userId} />
      </MobileAppShell>
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
  return rows.flatMap((row) => {
    if (seen.has(row.id)) return [];
    seen.add(row.id);
    const left = Math.abs(row.dispersionLeftYd ?? 0);
    const right = Math.abs(row.dispersionRightYd ?? 0);
    const commonMiss = left === 0 && right === 0 ? "Not measured" : left > right ? "Left" : "Right";

    return [
      {
        id: row.id,
        label: formatClubType(row.type),
        model: [row.brand, row.model].filter(Boolean).join(" ") || "Current club",
        trustedCarryYd: row.carryMedianYd,
        playsLikeYd: row.recommendedPlayNumberYd,
        lowYd: row.carryP25Yd,
        highYd: row.carryP75Yd,
        commonMiss,
        confidence: Math.round(row.confidenceScore ?? 0),
        sampleSize: row.sampleSize ?? 0,
      },
    ];
  });
}
