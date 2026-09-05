import type { QuickBagClub } from "@/app/quick-bag/quick-bag-client";

/** Keep equipment records separate, including clubs of the same type. */
export function mobileBagRows(clubs: QuickBagClub[]) {
  const byLabel = new Map<string, QuickBagClub[]>();
  for (const club of clubs) {
    const group = byLabel.get(club.label) ?? [];
    group.push(club);
    byLabel.set(club.label, group);
  }
  return clubs
    .map((club) => {
      const family = byLabel.get(club.label)!;
      const matching = family.filter((other) => other.model === club.model);
      const ordinal = [...matching].sort((a, b) => a.id.localeCompare(b.id));
      return {
        ...club,
        equipmentLabel:
          family.length < 2
            ? null
            : matching.length < 2
              ? club.model
              : `${club.model} · ${ordinal.findIndex((other) => other.id === club.id) + 1}`,
      };
    })
    .sort(
      (a, b) =>
        (b.trustedCarryYd ?? -1) - (a.trustedCarryYd ?? -1) ||
        a.label.localeCompare(b.label) ||
        a.id.localeCompare(b.id),
    );
}
