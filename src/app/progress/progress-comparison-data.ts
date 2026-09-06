import { median, mean } from "@/lib/analysis-statistics";
import { selectStockYardageShots } from "@/lib/stock-yardage";
import type { ClubAnalyticsShot } from "@/lib/club-analytics";

export type ComparisonMeasure = "carry" | "total" | "side";
export type ComparisonObservation = {
  sessionId: string;
  date: string;
  count: number;
  carry: number | null;
  total: number | null;
  side: number | null;
  counts: Record<ComparisonMeasure, number>;
};
export type ComparisonClub = {
  clubId: string;
  name: string;
  observations: ComparisonObservation[];
};

/** Same eligibility/stock role/outlier selection used by the existing analytics trend.
 * Total is measured total, never carry relabelled or an estimated rollout. */
export function comparisonObservations(
  shots: ClubAnalyticsShot[],
  clubType: string,
): ComparisonObservation[] {
  const selected = selectStockYardageShots(shots, shots.length, {
    clubType,
    averageSampleSize: shots.length,
  }).filteredShots;
  const groups = new Map<string, ClubAnalyticsShot[]>();
  for (const shot of selected) {
    if (!shot.sessionId || !Number.isFinite(new Date(shot.shotAt).getTime())) continue;
    const group = groups.get(shot.sessionId) ?? [];
    group.push(shot);
    groups.set(shot.sessionId, group);
  }
  return [...groups]
    .map(([sessionId, rows]) => {
      const values = (key: "carryYd" | "totalYd" | "sideCarryYd") =>
        rows.map((row) => row[key]).filter((v): v is number => v !== null && Number.isFinite(v));
      const carry = values("carryYd");
      const total = values("totalYd");
      const side = values("sideCarryYd").map(Math.abs);
      return {
        sessionId,
        date: new Date(
          Math.max(...rows.map((row) => new Date(row.shotAt).getTime())),
        ).toISOString(),
        count: rows.length,
        carry: carry.length ? median(carry) : null,
        total: total.length ? median(total) : null,
        side: side.length ? mean(side) : null,
        counts: { carry: carry.length, total: total.length, side: side.length },
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.sessionId.localeCompare(b.sessionId));
}

export function comparisonScope(clubs: ComparisonClub[], query: URLSearchParams) {
  const clubId = query.get("compareClub");
  const club = clubId === null ? clubs[0] : clubs.find((item) => item.clubId === clubId);
  const raw = query.get("compareMeasure") ?? "carry";
  const measure = (["carry", "total", "side"] as string[]).includes(raw)
    ? (raw as ComparisonMeasure)
    : null;
  const from = query.get("compareFrom") ?? "";
  const to = query.get("compareTo") ?? "";
  const validDate = (value: string) =>
    !value ||
    (/^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value).toISOString().slice(0, 10) === value);
  // Invalid dates are a visible filter error rather than an unfiltered fallback.
  const datesValid =
    [from, to].every((value) => {
      try {
        return validDate(value);
      } catch {
        return false;
      }
    }) &&
    (!from || !to || from <= to);
  const observations = datesValid
    ? (club?.observations ?? []).filter(
        (point) =>
          (!from || point.date.slice(0, 10) >= from) && (!to || point.date.slice(0, 10) <= to),
      )
    : [];
  return {
    club,
    measure,
    from,
    to,
    datesValid,
    observations,
    unavailableClub: clubId !== null && !club,
  };
}

export function comparisonDirection(previous: number, latest: number, measure: ComparisonMeasure) {
  const delta = Math.round((latest - previous) * 10) / 10;
  if (delta === 0) return "Holding steady between these sessions";
  const amount = Math.abs(delta).toLocaleString("en-GB", { maximumFractionDigits: 1 });
  return measure === "side"
    ? `${amount} yd ${delta < 0 ? "less" : "more"} average lateral miss`
    : `${amount} yd ${delta > 0 ? "longer" : "shorter"} ${measure}; distance alone does not prove improvement`;
}

/** Compare the last measured control session in each adjacent seven-day window.
 * Practice priority and trust are deliberately not used to rank measured change. */
export function weeklyControlChanges(clubs: ComparisonClub[], start: string, end: string) {
  const priorStart = new Date(new Date(start).getTime() - 7 * 86_400_000).toISOString();
  const changes = clubs
    .flatMap((club) => {
      const measured = club.observations.filter(
        (point) => point.side !== null && point.counts.side >= 3,
      );
      const previous = measured
        .filter((point) => point.date >= priorStart && point.date < start)
        .at(-1);
      const latest = measured.filter((point) => point.date >= start && point.date <= end).at(-1);
      if (!previous || !latest) return [];
      return [
        { club, previous, latest, delta: Math.round((latest.side! - previous.side!) * 10) / 10 },
      ];
    })
    .sort((a, b) => a.delta - b.delta || a.club.clubId.localeCompare(b.club.clubId));
  return {
    improvement: changes.find((change) => change.delta < 0) ?? null,
    decline: [...changes].reverse().find((change) => change.delta > 0) ?? null,
    comparedClubs: changes.length,
    priorStart,
  };
}
