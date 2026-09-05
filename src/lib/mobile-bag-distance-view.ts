import type { QuickBagClub } from "@/app/quick-bag/quick-bag-client";
import { mobileBagRows } from "./mobile-bag-rows";

/** Coordinates compare carry only; lane positions do not represent lateral dispersion. */
export function mobileBagDistanceView(clubs: QuickBagClub[]) {
  const measured = mobileBagRows(clubs).filter(
    (club) =>
      club.evidenceKind !== "touch" &&
      club.sampleSize > 0 &&
      club.trustedCarryYd != null &&
      Number.isFinite(club.trustedCarryYd) &&
      club.trustedCarryYd > 0,
  );
  const limit = Math.max(
    50,
    Math.ceil(Math.max(0, ...measured.map((club) => club.trustedCarryYd!)) / 50) * 50,
  );
  return {
    limit,
    clubs: measured.map((club, index) => ({
      ...club,
      carry: club.trustedCarryYd!,
      lane: (index - (measured.length - 1) / 2) * Math.min(8, 64 / Math.max(1, measured.length)),
      distance: (club.trustedCarryYd! / limit) * 100,
    })),
  };
}
export type MobileBagDistanceView = ReturnType<typeof mobileBagDistanceView>;
