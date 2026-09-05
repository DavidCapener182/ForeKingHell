import { isEstimatedClubData } from "@/lib/club-analytics";
import { clubSortValue, formatCompanionClubType } from "@/lib/club-format";

export type SessionStoryShot = {
  carryYd: number | null;
  sideCarryYd: number | null;
  ballSpeedMph: number | null;
  clubSpeedMph: number | null;
  launchAngleDeg: number | null;
  smashFactor: number | null;
  clubDataEstType?: string | null;
};

export type SessionStoryGroup = {
  clubType: string;
  label: string;
  importedCount: number;
  trustedCount: number;
  metrics: ReturnType<typeof mobileSessionMetrics>;
};

/** Only this session's rows are supplied; clubs without trusted readings stay discoverable. */
export function mobileSessionGroups(
  raw: Array<SessionStoryShot & { clubType: string }>,
  trusted: Array<SessionStoryShot & { clubType: string }>,
): SessionStoryGroup[] {
  return [...new Set(raw.map((shot) => shot.clubType))]
    .sort((a, b) => clubSortValue(a) - clubSortValue(b) || a.localeCompare(b))
    .map((clubType) => {
      const selected = trusted.filter((shot) => shot.clubType === clubType);
      return {
        clubType,
        label: formatCompanionClubType(clubType),
        importedCount: raw.filter((shot) => shot.clubType === clubType).length,
        trustedCount: selected.length,
        metrics: mobileSessionMetrics(selected),
      };
    });
}

/** Each metric uses its own available trusted readings; missing side never erases carry. */
export function mobileSessionMetrics(shots: SessionStoryShot[]) {
  const values = (key: keyof SessionStoryShot) =>
    shots
      .map((s) => s[key])
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const carry = values("carryYd");
  const sides = values("sideCarryYd");
  const metrics: { label: string; value: string; unit?: string; detail: string }[] = [];
  if (carry.length)
    metrics.push({
      label: "carry",
      value: String(Math.round(percentile(carry, 0.5))),
      unit: "yd",
      detail: `Median of ${carry.length} trusted carry readings`,
    });
  if (sides.length >= 3)
    metrics.push({
      label: "dispersion width",
      value: String(Math.round(percentile(sides, 0.9) - percentile(sides, 0.1))),
      unit: "yd",
      detail: `Middle 80% of ${sides.length} measured side readings`,
    });
  for (const [label, key, unit, digits] of [
    ["ball speed", "ballSpeedMph", "mph", 1],
    ["club speed", "clubSpeedMph", "mph", 1],
    ["launch", "launchAngleDeg", "°", 1],
    ["smash factor", "smashFactor", "", 2],
  ] as const) {
    const measured = values(key);
    if (!measured.length) continue;
    const estimated =
      key === "clubSpeedMph" || key === "smashFactor"
        ? shots.filter(
            (shot) =>
              typeof shot[key] === "number" &&
              Number.isFinite(shot[key]) &&
              isEstimatedClubData(shot.clubDataEstType),
          ).length
        : 0;
    metrics.push({
      label,
      value: (measured.reduce((a, b) => a + b, 0) / measured.length).toFixed(digits),
      unit,
      detail: `Average of ${measured.length} trusted readings${estimated ? ` · ${estimated} based on estimated club speed` : ""}`,
    });
  }
  return metrics;
}
function percentile(values: number[], fraction: number) {
  const sorted = [...values].sort((a, b) => a - b);
  const i = (sorted.length - 1) * fraction;
  const lower = Math.floor(i);
  return sorted[lower] + (sorted[Math.ceil(i)] - sorted[lower]) * (i - lower);
}

export function sessionPracticeHref(
  clubType: string | null,
  clubLabel: string | null,
  purpose = "control",
) {
  if (!clubType) return "/practice";
  const params = new URLSearchParams({
    club: clubType,
    focus: `${clubLabel ?? clubType} ${purpose}`,
  });
  return `/practice/quick-range?${params.toString()}`;
}

export function mobileSessionVerdict(
  comparisons: Array<{
    clubLabel: string;
    verdict: "better" | "worse" | "mixed" | "new";
    score: number;
  }>,
) {
  const sorted = [...comparisons].sort((a, b) => a.score - b.score);
  const weaker = sorted.find((c) => c.verdict === "worse");
  const stronger = [...sorted].reverse().find((c) => c.verdict === "better");
  if (stronger && weaker)
    return `${stronger.clubLabel} improved, while ${weaker.clubLabel} fell behind its previous baseline.`;
  if (stronger) return `${stronger.clubLabel} improved against its previous baseline.`;
  if (weaker) return `${weaker.clubLabel} fell behind its previous baseline.`;
  if (sorted.some((c) => c.verdict === "mixed"))
    return "Results were mixed against your previous baseline.";
  return "More comparable shots are needed to judge a change.";
}

export function sessionFocusClub(
  requested: string | null | undefined,
  weakest: string | null | undefined,
  trustedClubs: string[],
  rawClubs: string[],
) {
  const available = trustedClubs.length ? trustedClubs : rawClubs;
  if (requested && available.includes(requested)) return requested;
  if (weakest && available.includes(weakest)) return weakest;
  return available[0] ?? null;
}
