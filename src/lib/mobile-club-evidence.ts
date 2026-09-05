import { companionReviewRoute } from "@/lib/session-review-route";
import { calculateShortGameTouchSummary, selectShortGameTouchShots } from "@/lib/short-game";
import {
  calculateStockYardage,
  selectLatestReliableStockShots,
  type StockShot,
} from "@/lib/stock-yardage";

export type ClubEvidenceShot = StockShot & { sessionId?: string; sessionTitle?: string | null };
export type ClubNeighbour = { id: string; type: string; carry: number | null };

/** All supporting metrics refer to the same evidence window as the carry hero. */
export function mobileClubEvidence<T extends ClubEvidenceShot>(
  shots: T[],
  clubType: string,
  touch: boolean,
) {
  const ordered = [...shots].sort(
    (a, b) => new Date(b.shotAt ?? 0).getTime() - new Date(a.shotAt ?? 0).getTime(),
  );
  const selected = touch
    ? selectShortGameTouchShots(ordered, ordered.length, { clubType })
    : selectLatestReliableStockShots(ordered, ordered.length, { clubType }).filteredShots;
  const stock = calculateStockYardage(ordered, ordered.length, { clubType });
  const touchSummary = calculateShortGameTouchSummary(ordered, ordered.length, { clubType });
  const sides = numbers(selected.map((s) => s.sideCarryYd));
  const latest = selected.find((s) => s.shotAt && Number.isFinite(new Date(s.shotAt).getTime()));
  const sessions = new Map<
    string,
    {
      id: string;
      type: string | null;
      href: string;
      title: string | null;
      date: string;
      shots: number;
    }
  >();
  for (const shot of selected) {
    if (!shot.sessionId || !shot.shotAt) continue;
    const existing = sessions.get(shot.sessionId);
    if (existing) existing.shots++;
    else
      sessions.set(shot.sessionId, {
        id: shot.sessionId,
        type: shot.sessionType ?? null,
        href: companionReviewRoute({ id: shot.sessionId, type: shot.sessionType }),
        title: shot.sessionTitle ?? null,
        date: new Date(shot.shotAt).toISOString(),
        shots: 1,
      });
  }
  return {
    carry: touch ? touchSummary.carryMedianYd : stock.latestReliableCarryYd,
    low: touch ? touchSummary.carryP25Yd : stock.latestReliableCarryP25Yd,
    high: touch ? touchSummary.carryP75Yd : stock.latestReliableCarryP75Yd,
    sampleSize: selected.length,
    total: percentile(numbers(selected.map((s) => s.totalYd)), 0.5),
    totalSampleSize: numbers(selected.map((s) => s.totalYd)).length,
    ballSpeed: average(numbers(selected.map((s) => s.ballSpeedMph))),
    launch: average(numbers(selected.map((s) => s.launchAngleDeg))),
    side: percentile(sides, 0.5),
    sideLow: percentile(sides, 0.25),
    sideHigh: percentile(sides, 0.75),
    sideLeft: sides.length ? Math.abs(Math.min(0, ...sides)) : null,
    sideRight: sides.length ? Math.max(0, ...sides) : null,
    sideSampleSize: sides.length,
    verifiedAt: latest?.shotAt ? new Date(latest.shotAt).toISOString() : null,
    sessions: [...sessions.values()].slice(0, 3),
  };
}

export function mobileClubNeighbours(
  clubs: ClubNeighbour[],
  current: { id: string; type: string; carry: number | null },
) {
  if (current.carry === null) return [];
  const others = clubs.filter(
    (c): c is ClubNeighbour & { carry: number } =>
      c.id !== current.id &&
      c.type !== current.type &&
      c.carry !== null &&
      Number.isFinite(c.carry),
  );
  const shorter = others
    .filter((c) => c.carry <= current.carry!)
    .sort((a, b) => b.carry - a.carry)[0];
  const longer = others
    .filter((c) => c.carry > current.carry!)
    .sort((a, b) => a.carry - b.carry)[0];
  return [longer, shorter].filter((c) => !!c).map((c) => ({ ...c, gap: c.carry - current.carry! }));
}
function numbers(values: Array<number | null | undefined>) {
  return values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
}
function average(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}
function percentile(values: number[], fraction: number) {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const i = (ordered.length - 1) * fraction;
  const l = Math.floor(i);
  return ordered[l] + (ordered[Math.ceil(i)] - ordered[l]) * (i - l);
}
