import { distanceUnitLabel, yardsToDisplay, type DistanceUnitPreference } from "@/lib/units";
import type { QuickBagClub } from "./quick-bag-client";

export function quickBagMissLabel(
  club: Pick<QuickBagClub, "medianLateralYd" | "typicalMiss" | "widerSide">,
  units: DistanceUnitPreference,
) {
  const side = club.medianLateralYd;
  if (side !== null && Number.isFinite(side)) {
    // Preserve the existing canonical four-yard near-target rule; convert display only.
    if (Math.abs(side) < 4) return "Near target";
    return `${Math.round(yardsToDisplay(Math.abs(side), units))} ${distanceUnitLabel(units)} ${side > 0 ? "right" : "left"}`;
  }
  if (club.typicalMiss) return club.typicalMiss;
  return club.widerSide ? `Wider ${club.widerSide}` : "Not established";
}
