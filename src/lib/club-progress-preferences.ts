import { trendMetrics, type ClubTrend, type TrendMetric } from "./club-progress";
import { evidenceClasses } from "./club-progress";
import type { ClubSpeedMeasurementTrust } from "./club-speed-evidence";
export type ClubProgressPreferences = {
  version: 1;
  clubId?: string;
  series?: string;
  metric?: TrendMetric;
  window?: 5 | 10 | 20;
  rolling?: boolean;
  evidence?: ClubSpeedMeasurementTrust;
};
export function progressStorageKey(accountId: string) {
  return `fkh:club-progress:v1:${accountId}`;
}
export function parseProgressPreferences(raw: string | null): ClubProgressPreferences {
  try {
    const data = JSON.parse(raw ?? "null");
    if (!data || data.version !== 1 || typeof data !== "object") return { version: 1 };
    return {
      version: 1,
      clubId: typeof data.clubId === "string" ? data.clubId : undefined,
      series: typeof data.series === "string" ? data.series : undefined,
      metric: trendMetrics.some((m) => m.key === data.metric) ? data.metric : undefined,
      window: [5, 10, 20].includes(data.window) ? data.window : undefined,
      rolling: typeof data.rolling === "boolean" ? data.rolling : undefined,
      evidence: evidenceClasses.includes(data.evidence) ? data.evidence : undefined,
    };
  } catch {
    return { version: 1 };
  }
}
export function resolveProgressSelection(
  clubs: ClubTrend[],
  query: URLSearchParams,
  saved: ClubProgressPreferences,
) {
  const explicitClub = query.has("cpClub");
  const explicitSeries = query.has("cpSeries");
  const requestedClub = query.get("cpClub") ?? saved.clubId;
  const availableClub = clubs.some((c) => c.clubId === requestedClub);
  const clubId = availableClub || explicitClub ? requestedClub : clubs[0]?.clubId;
  const candidates = clubs.filter((c) => c.clubId === clubId);
  const requestedSeries = query.get("cpSeries") ?? saved.series;
  const club =
    candidates.find((c) => c.id === requestedSeries) ??
    (explicitSeries
      ? undefined
      : [...candidates].sort(
          (a, b) => (b.points.at(-1)?.timestamp ?? 0) - (a.points.at(-1)?.timestamp ?? 0),
        )[0]);
  const rawMetric = query.get("cpMetric") ?? saved.metric;
  const metric = trendMetrics.find((m) => m.key === rawMetric)?.key ?? "carryYd";
  const sessionId =
    query.get("cpSession") ??
    club?.points.findLast((p) => p.current)?.sessionId ??
    club?.points.at(-1)?.sessionId;
  const rawWindow = Number(query.get("cpWindow") ?? saved.window ?? 10);
  const window = ([5, 10, 20].includes(rawWindow) ? rawWindow : 10) as 5 | 10 | 20;
  const rolling = query.has("cpRolling")
    ? query.get("cpRolling") === "1"
    : (saved.rolling ?? false);
  const rawEvidence = query.get("cpEvidence") ?? saved.evidence;
  const evidence = evidenceClasses.includes(rawEvidence as ClubSpeedMeasurementTrust)
    ? (rawEvidence as ClubSpeedMeasurementTrust)
    : (club?.defaultEvidence ?? "measured");
  return {
    club,
    clubId,
    metric,
    sessionId,
    window,
    rolling,
    evidence,
    unavailable: !club || !club.points.some((p) => p.sessionId === sessionId),
  };
}
