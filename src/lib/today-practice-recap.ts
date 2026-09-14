import { mean, sampleStandardDeviation } from "@/lib/analysis-statistics";
import { clubSortValue, formatClubType } from "@/lib/club-format";
import type { TodayPracticeShot } from "@/lib/today-session-data";

type Reading = { value: number | null; count: number };
const finite = (value: number | null): value is number => value !== null && Number.isFinite(value);
const sourceName = (source: string) =>
  ({ trackman: "TrackMan", rapsodo: "Rapsodo", square: "Square" })[source] ??
  source.replaceAll("_", " ");

/** Call with the same reviewed full-shot evidence used by the dated comparison. */
export function buildTodayPracticeRecap(raw: TodayPracticeShot[], eligible: TodayPracticeShot[]) {
  const eligibleIds = new Set(eligible.map((shot) => shot.id));
  const groups = new Map<string, TodayPracticeShot[]>();
  for (const shot of raw) {
    // Keep equipment and monitor measurements separate; these are not calibrated yards.
    const key = JSON.stringify([shot.clubId ?? null, shot.clubType, shot.source]);
    groups.set(key, [...(groups.get(key) ?? []), shot]);
  }
  const clubs = [...groups]
    .map(([key, recorded]) => {
      const shots = eligible.filter((shot) => recorded.some((row) => row.id === shot.id));
      const first = recorded[0];
      const measure = (
        field: "carryYd" | "ballSpeedMph" | "sideCarryYd",
        absolute = false,
      ): Reading => {
        const values = shots
          .map((shot) => shot[field])
          .filter(finite)
          .map((value) => (absolute ? Math.abs(value) : value));
        return { value: mean(values), count: values.length };
      };
      const carry = measure("carryYd");
      const speed = measure("ballSpeedMph");
      const offline = measure("sideCarryYd", true);
      const carries = shots.map((shot) => shot.carryYd).filter(finite);
      const sides = shots.map((shot) => shot.sideCarryYd).filter(finite);
      return {
        key,
        clubType: first.clubType,
        clubLabel: formatClubType(first.clubType),
        equipment: [first.clubBrand, first.clubModel].filter(Boolean).join(" "),
        source: sourceName(first.source),
        recorded: recorded.length,
        included: shots.length,
        carry,
        speed,
        offline,
        bestCarry: carries.length ? Math.max(...carries) : null,
        spread: {
          value: carries.length >= 3 ? sampleStandardDeviation(carries) : null,
          count: carries.length,
        },
        left: sides.filter((value) => value < -2).length,
        straight: sides.filter((value) => Math.abs(value) <= 2).length,
        right: sides.filter((value) => value > 2).length,
      };
    })
    .sort(
      (a, b) =>
        clubSortValue(a.clubType) - clubSortValue(b.clubType) ||
        a.source.localeCompare(b.source) ||
        a.key.localeCompare(b.key),
    );
  const uploads = [...new Set(raw.map((shot) => shot.sessionId))].map((id) => {
    const shots = raw.filter((shot) => shot.sessionId === id);
    return {
      id,
      source: sourceName(shots[0].source),
      fileName: shots[0].fileName,
      recorded: shots.length,
      included: shots.filter((shot) => eligibleIds.has(shot.id)).length,
    };
  });
  const bestShot = (field: "carryYd" | "ballSpeedMph") => {
    const shot = eligible
      .filter((shot) => finite(shot[field]))
      .sort((a, b) => b[field]! - a[field]!)[0];
    return shot
      ? {
          value: shot[field]!,
          club: formatClubType(shot.clubType),
          source: sourceName(shot.source),
          sessionId: shot.sessionId,
          shotNumber: shot.shotNumber,
        }
      : null;
  };
  const tightest =
    clubs
      .filter((club) => club.spread.count >= 5 && club.spread.value !== null)
      .sort((a, b) => a.spread.value! - b.spread.value!)[0] ?? null;
  return {
    recorded: raw.length,
    included: eligible.length,
    clubCount: new Set(raw.map((shot) => shot.clubType)).size,
    mixedSources: new Set(raw.map((shot) => shot.source)).size > 1,
    clubs,
    uploads,
    longest: bestShot("carryYd"),
    fastest: bestShot("ballSpeedMph"),
    tightest,
  };
}
export type TodayPracticeRecapModel = ReturnType<typeof buildTodayPracticeRecap>;
