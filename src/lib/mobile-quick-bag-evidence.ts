import type { QuickBagClub } from "@/app/quick-bag/quick-bag-client";
import { formatClubType, isShortGameTouchClubType } from "@/lib/club-format";
import { mobileClubEvidence } from "@/lib/mobile-club-evidence";
import { calculateStockYardage, type StockShot } from "@/lib/stock-yardage";

export function mobileQuickBagClub(
  club: { id: string; type: string; brand: string | null; model: string | null },
  shots: StockShot[],
): QuickBagClub {
  const touch = isShortGameTouchClubType(club.type) && club.type !== "sw";
  const evidence = mobileClubEvidence(shots, club.type, touch);
  const stock = calculateStockYardage(shots, shots.length, { clubType: club.type });
  return {
    id: club.id,
    clubType: club.type,
    label: formatClubType(club.type),
    model: [club.brand, club.model].filter(Boolean).join(" ") || "Current club",
    trustedCarryYd: evidence.carry,
    totalYd: evidence.total,
    totalSampleSize: evidence.totalSampleSize,
    playNumberYd: stock.recommendedPlayNumberYd,
    lowYd: evidence.low,
    highYd: evidence.high,
    typicalMiss:
      evidence.side == null
        ? null
        : Math.abs(evidence.side) < 4
          ? "Near target"
          : `${Math.round(Math.abs(evidence.side))} yd ${evidence.side > 0 ? "right" : "left"}`,
    widerSide: null,
    medianLateralYd: evidence.side,
    lateralLowYd: evidence.sideLow,
    lateralHighYd: evidence.sideHigh,
    patternSampleSize: evidence.sideSampleSize,
    observedLeftYd: evidence.sideLeft,
    observedRightYd: evidence.sideRight,
    confidence: touch ? 0 : stock.confidenceScore,
    sampleSize: evidence.sampleSize,
    latestEvidenceDate: evidence.verifiedAt,
    evidenceKind: touch ? "touch" : "full",
  };
}
