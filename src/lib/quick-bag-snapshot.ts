import type { QuickBagClub } from "@/app/quick-bag/quick-bag-client";

export type QuickBagSnapshot = {
  version: 4;
  accountId: string;
  storedAt: string;
  clubs: QuickBagClub[];
  legacy?: boolean;
};

export function createQuickBagSnapshot(
  accountId: string,
  clubs: QuickBagClub[],
  storedAt = new Date().toISOString(),
): QuickBagSnapshot {
  return { version: 4, accountId, storedAt, clubs };
}

/** Accept only this account's known snapshot formats; old yardages never gain new provenance. */
export function readQuickBagSnapshot(
  raw: string | null,
  accountId: string,
): QuickBagSnapshot | null {
  try {
    const value = JSON.parse(raw ?? "null");
    if (
      !value ||
      ![3, 4].includes(value.version) ||
      !Array.isArray(value.clubs) ||
      !Number.isFinite(Date.parse(value.storedAt)) ||
      (value.version === 4 && value.accountId !== accountId)
    )
      return null;
    const ids = new Set<string>();
    for (const club of value.clubs) {
      if (
        !club ||
        typeof club.id !== "string" ||
        !club.id ||
        ids.has(club.id) ||
        typeof club.label !== "string" ||
        typeof club.model !== "string"
      )
        return null;
      ids.add(club.id);
      for (const key of [
        "trustedCarryYd",
        "totalYd",
        "lowYd",
        "highYd",
        "confidence",
        "sampleSize",
      ]) {
        if (
          club[key] != null &&
          (typeof club[key] !== "number" || !Number.isFinite(club[key]) || club[key] < 0)
        )
          return null;
      }
      if (!Number.isInteger(club.sampleSize) || typeof club.confidence !== "number") return null;
    }
    return {
      version: 4,
      accountId,
      storedAt: value.storedAt,
      legacy: value.version === 3,
      clubs: value.clubs.map((club: QuickBagClub) => ({
        ...club,
        latestEvidenceDate:
          value.version === 4 &&
          club.latestEvidenceDate &&
          Number.isFinite(Date.parse(club.latestEvidenceDate))
            ? club.latestEvidenceDate
            : null,
      })),
    };
  } catch {
    return null;
  }
}
