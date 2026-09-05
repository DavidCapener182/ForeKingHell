import type { SavedRound, MobileRoundHole } from "@/app/rounds/mobile-live-round";

type StorageReader = Pick<Storage, "length" | "key" | "getItem">;
export type OfflineSavedRound = SavedRound & { context: NonNullable<SavedRound["context"]> };

/** Read each account-owned snapshot independently; a damaged copy cannot hide other rounds. */
export function readOfflineSavedRounds(
  storage: StorageReader,
  accountId: string,
): OfflineSavedRound[] {
  const prefix = `fkh:live-round:${accountId}:`;
  const result: OfflineSavedRound[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(prefix)) continue;
    try {
      const item = JSON.parse(storage.getItem(key) ?? "null") as SavedRound | null;
      if (
        !item?.context ||
        item.context.sessionId !== key.slice(prefix.length) ||
        !item.context.sessionId ||
        typeof item.context.course !== "string" ||
        typeof item.version !== "string" ||
        !Array.isArray(item.holes) ||
        !item.holes.length ||
        item.holes.length > 18 ||
        !item.holes.every(validHole) ||
        new Set(item.holes.map((h) => h.holeNumber)).size !== item.holes.length ||
        !Number.isInteger(item.index) ||
        item.index < 0 ||
        item.index >= item.holes.length ||
        !Array.isArray(item.dirty) ||
        !item.dirty.every((n) => item.holes.some((h) => h.holeNumber === n))
      )
        continue;
      if (
        item.inFlight &&
        (typeof item.inFlight.id !== "string" ||
          typeof item.inFlight.version !== "string" ||
          !validHole(item.inFlight.hole) ||
          !item.holes.some((h) => h.holeNumber === item.inFlight?.hole.holeNumber))
      )
        continue;
      result.push(item as OfflineSavedRound);
    } catch {
      /* Keep the raw copy for recovery; continue to the next snapshot. */
    }
  }
  // No timestamp is recorded in legacy snapshots: group unfinished first without inventing recency.
  return result.sort(
    (a, b) =>
      Number(Boolean(a.finished)) - Number(Boolean(b.finished)) ||
      a.context.course.localeCompare(b.context.course),
  );
}

function validHole(hole: MobileRoundHole) {
  return (
    hole &&
    Number.isInteger(hole.holeNumber) &&
    hole.holeNumber >= 1 &&
    hole.holeNumber <= 18 &&
    Number.isInteger(hole.par) &&
    hole.par >= 1 &&
    Number.isFinite(hole.yards) &&
    hole.yards >= 0 &&
    [hole.score, hole.putts, hole.penalties].every(
      (value) => value === null || (Number.isInteger(value) && value >= 0),
    ) &&
    [hole.fairwayHit, hole.gir].every((value) => value === null || typeof value === "boolean")
  );
}

export function requestedOfflineRound(url: URL) {
  const match = /^\/rounds\/([^/]+)\/?$/.exec(url.pathname);
  if (match && match[1] !== "new") {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return null;
    }
  }
  return url.searchParams.get("view") === "round" ? url.searchParams.get("sessionId") : null;
}
