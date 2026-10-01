import { clubSortValue, formatClubIdentityLabel, isTrackedClubType } from "@/lib/club-format";
import { classifyStockShotRole } from "@/lib/stock-yardage";
import { isCleanPracticeShot } from "@/lib/today-practice-evidence";
import { isRoundSessionType } from "@/lib/round-sessions";
import { withDirectionalConfidence } from "@/lib/session-data-confidence";
import { detectShotDataIntegrityIssue } from "@/lib/shot-data-integrity";
import {
  clubSpeedMeasurementTrust,
  type ClubSpeedMeasurementTrust,
} from "@/lib/club-speed-evidence";
import type { TodayPracticeShot } from "@/lib/today-session-data";

import {
  trendMetrics,
  evidenceClasses,
  type TrendPoint,
  type ClubTrend,
  type ClubFamily,
} from "@/lib/club-progress";
export * from "@/lib/club-progress";

type Metrics = TrendPoint["values"];
type Counts = TrendPoint["counts"];

export function clubFamily(type: string): ClubFamily {
  return type === "driver"
    ? "Driver"
    : type.endsWith("w") && !["pw", "gw", "aw", "sw", "lw"].includes(type)
      ? "Woods"
      : type.endsWith("h")
        ? "Hybrids"
        : type.endsWith("i")
          ? "Irons"
          : "Wedges";
}
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
export function eligibleClubProgressShot(shot: TodayPracticeShot) {
  const category = shot.shotCategory?.trim().toLowerCase();
  if (
    !shot.clubId ||
    shot.clubActive === false ||
    !isTrackedClubType(shot.clubType) ||
    isRoundSessionType(shot.sessionType)
  )
    return false;
  // Explicit intent wins; reject partial/recovery categories before the stock-role heuristic.
  if (category && category !== "full") return false;
  const clean = isCleanPracticeShot({
    ...shot,
    dataIntegrityIssue: shot.dataIntegrityIssue ?? detectShotDataIntegrityIssue(shot),
  });
  return clean && (category === "full" || classifyStockShotRole(shot) === "full");
}
export function progressSeriesKey(shot: TodayPracticeShot) {
  // No stable device identifier is stored in the session schema. Provider is not device identity.
  return JSON.stringify([
    shot.clubId,
    shot.source,
    shot.sessionType,
    shot.playContext || "unknown",
    shot.shotPlayContext || "unknown",
  ]);
}
/** Session.date orders saved uploads; ties use session ID for presentation, not causal ordering.
 * The immediate tied predecessor is shown, but interpretation is withheld. Invalid dates are omitted.
 * Today ends at each series' latest in-scope upload; Dashboard retains clubs absent from the latest upload.
 */
export function buildClubProgress(rows: TodayPracticeShot[], currentSessionIds: string[] | null) {
  const current = currentSessionIds === null ? null : new Set(currentSessionIds);
  const groups = new Map<
    string,
    { shot: TodayPracticeShot; sessions: Map<string, TodayPracticeShot[]> }
  >();
  const invalid = new Set<string>();
  for (const raw of rows) {
    if (!eligibleClubProgressShot(raw)) continue;
    const timestamp = new Date(raw.sessionDate ?? raw.shotAt).getTime();
    if (!finite(timestamp)) {
      invalid.add(raw.sessionId);
      continue;
    }
    const shot = withDirectionalConfidence(raw);
    const key = progressSeriesKey(shot);
    const group = groups.get(key) ?? { shot, sessions: new Map() };
    const session = group.sessions.get(shot.sessionId) ?? [];
    session.push(shot);
    group.sessions.set(shot.sessionId, session);
    groups.set(key, group);
  }
  const clubs: ClubTrend[] = [...groups]
    .filter(([, g]) => current === null || [...g.sessions.keys()].some((id) => current.has(id)))
    .sort(
      ([, a], [, b]) =>
        clubSortValue(a.shot.clubType) - clubSortValue(b.shot.clubType) ||
        a.shot.clubId!.localeCompare(b.shot.clubId!) ||
        progressSeriesKey(a.shot).localeCompare(progressSeriesKey(b.shot)),
    )
    .map(([id, group]) => {
      const preferred =
        evidenceClasses.find((trust) =>
          [...group.sessions.values()]
            .flat()
            .some(
              (s) =>
                clubSpeedMeasurementTrust(s.clubDataEstType ?? null) === trust &&
                (finite(s.clubSpeedMph) || finite(s.smashFactor)),
            ),
        ) ?? "unknown";
      let points: TrendPoint[] = [...group.sessions]
        .map(([sessionId, shots]) => {
          const summarize = (trust?: ClubSpeedMeasurementTrust) => {
            const values = {} as Metrics;
            const counts = {} as Counts;
            for (const metric of trendMetrics) {
              const numbers = shots
                .filter(
                  (s) =>
                    !metric.clubEvidence ||
                    clubSpeedMeasurementTrust(s.clubDataEstType ?? null) === (trust ?? "measured"),
                )
                .map(metric.read)
                .filter(finite);
              counts[metric.key] = numbers.length;
              values[metric.key] = metric.calculate(numbers);
            }
            return { values, counts };
          };
          const timestamp = new Date(shots[0].sessionDate ?? shots[0].shotAt).getTime();
          const clubEvidence = Object.fromEntries(
            evidenceClasses.map((trust) => [trust, summarize(trust)]),
          ) as TrendPoint["clubEvidence"];
          return {
            sessionId,
            timestamp,
            date: new Intl.DateTimeFormat("en-GB", {
              timeZone: "Europe/London",
              year: "numeric",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            }).format(timestamp),
            current: current?.has(sessionId) ?? false,
            shotCount: shots.length,
            fileName: shots[0].fileName ?? null,
            ambiguousTime: false,
            weather: Object.values(shots[0].weather ?? {})
              .filter(Boolean)
              .join(" · "),
            ...summarize(),
            clubEvidence,
          };
        })
        .sort((a, b) => a.timestamp - b.timestamp || a.sessionId.localeCompare(b.sessionId));
      points.forEach((p, i) => {
        p.ambiguousTime =
          points[i - 1]?.timestamp === p.timestamp || points[i + 1]?.timestamp === p.timestamp;
      });
      if (current) {
        const end = points.findLastIndex((p) => p.current);
        points = points.slice(0, end + 1);
      } else if (points.length) points[points.length - 1].current = true;
      return {
        id,
        clubId: group.shot.clubId!,
        clubType: group.shot.clubType,
        family: clubFamily(group.shot.clubType),
        label: formatClubIdentityLabel({
          type: group.shot.clubType,
          brand: group.shot.clubBrand,
          model: group.shot.clubModel,
        }),
        source: group.shot.source,
        context: group.shot.sessionType,
        playContext: group.shot.playContext || "unknown",
        shotPlayContext: group.shot.shotPlayContext || "unknown",
        defaultEvidence: preferred,
        points,
      };
    });
  return { clubs, invalidSessionCount: invalid.size };
}
export function buildTodayClubTrends(rows: TodayPracticeShot[], currentSessionIds: string[]) {
  return buildClubProgress(rows, currentSessionIds).clubs;
}
