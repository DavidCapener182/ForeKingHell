import { mean, sampleStandardDeviation } from "@/lib/analysis-statistics";
import { clubSortValue, formatClubType } from "@/lib/club-format";
import { isRoundSessionType } from "@/lib/round-sessions";
import { withDirectionalConfidence } from "@/lib/session-data-confidence";
import { detectShotDataIntegrityIssue } from "@/lib/shot-data-integrity";
import { isComparisonShot } from "@/lib/today-practice-evidence";
import type { TodayPracticeShot } from "@/lib/today-session-data";

export type TodayProgressHistoryDay = { dateKey: string; rawShots: TodayPracticeShot[] };
export type TodayProgressVerdict = "better" | "worse" | "mixed" | "steady" | "building";
export type TodayProgressMetricKey = "offline" | "carrySpread" | "carry" | "ballSpeed";
export type TodayProgressMetric = {
  key: TodayProgressMetricKey;
  label: string;
  unit: "yd" | "mph";
  previous: number | null;
  current: number | null;
  delta: number | null;
  previousCount: number;
  currentCount: number;
  direction: "improved" | "declined" | "steady" | "changed" | "unavailable";
};
export type TodayProgressChange = {
  clubLabel: string;
  equipmentLabel: string;
  metric: TodayProgressMetricKey;
  previous: number;
  current: number;
  delta: number;
  unit: "yd" | "mph";
  text: string;
};
export type TodayProgressClub = {
  key: string;
  clubId: string | null;
  clubType: string;
  clubLabel: string;
  equipmentLabel: string;
  status: "compared" | "equipment-changed" | "unknown-equipment" | "low-sample" | "new-club";
  reason: string;
  verdict: TodayProgressVerdict;
  currentShotCount: number;
  previousShotCount: number;
  metrics: TodayProgressMetric[];
};
export type TodayProgressDaySummary = {
  dateKey: string;
  uploadCount: number;
  shotCount: number;
  eligibleShotCount: number;
  excludedShotCount: number;
  clubCount: number;
};
export type TodayProgressRecentDay = TodayProgressDaySummary & {
  verdict: TodayProgressVerdict | "baseline";
  takeaway: string;
  baselineDateKey: string | null;
};
export type TodayProgressReport = {
  scope: "day" | "session";
  latest: TodayProgressDaySummary;
  previous: TodayProgressDaySummary | null;
  verdict: TodayProgressVerdict;
  headline: string;
  summary: string;
  improvements: TodayProgressChange[];
  setbacks: TodayProgressChange[];
  changes: TodayProgressChange[];
  clubs: TodayProgressClub[];
  coverage: {
    matchedClubs: number;
    totalClubs: number;
    matchedShotCount: number;
    eligibleShotCount: number;
    label: string;
  };
  recentTrend: {
    verdict: TodayProgressVerdict;
    headline: string;
    summary: string;
    comparedClubs: number;
    days: TodayProgressRecentDay[];
  };
  method: string[];
};

type ClubGroup = { raw: TodayPracticeShot[]; eligible: TodayPracticeShot[] };
type PreparedDay = {
  summary: TodayProgressDaySummary;
  clubs: Map<string, ClubGroup>;
  hasPracticeRows: boolean;
};
type Measure = { value: number | null; count: number };
const MIN_READINGS = 3;
const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const metricDefinitions = [
  { key: "offline", label: "Average sideways miss", unit: "yd", threshold: 2 },
  { key: "carrySpread", label: "Carry spread", unit: "yd", threshold: 2 },
  { key: "carry", label: "Average carry", unit: "yd", threshold: 2 },
  { key: "ballSpeed", label: "Average ball speed", unit: "mph", threshold: 1 },
] as const;

/** Complete practice dates are supplied separately from Today's rolling 50-shot baseline. */
export function buildTodayProgress({
  dateKey,
  rawShots,
  previousDays,
  scope = "day",
  clubType,
}: {
  dateKey: string;
  rawShots: TodayPracticeShot[];
  previousDays: TodayProgressHistoryDay[];
  scope?: "day" | "session";
  clubType?: string;
}): TodayProgressReport {
  const seen = new Set<string>();
  const latest = prepareDay({ dateKey, rawShots }, seen, clubType);
  const groupedHistory = new Map<string, TodayPracticeShot[]>();
  for (const day of previousDays) {
    if (!validDateKey(day.dateKey) || day.dateKey >= dateKey) continue;
    groupedHistory.set(day.dateKey, [...(groupedHistory.get(day.dateKey) ?? []), ...day.rawShots]);
  }
  const history = [...groupedHistory]
    .sort(([left], [right]) => right.localeCompare(left))
    .slice(0, 5)
    .map(([key, rows]) => prepareDay({ dateKey: key, rawShots: rows }, seen, clubType))
    .filter((day) => day.hasPracticeRows);
  const previous = history[0] ?? null;
  const clubs = [...latest.clubs.entries()]
    .map(([key, group]) => compareClub(key, group, previous))
    .sort(
      (a, b) => clubSortValue(a.clubType) - clubSortValue(b.clubType) || a.key.localeCompare(b.key),
    );
  const compared = clubs.filter((club) => club.status === "compared");
  const verdict = comparisonVerdict(compared);
  const carryTradeoffs = compared
    .map(carryTradeoff)
    .filter((text): text is string => Boolean(text));
  const improvements = changesFor(clubs, "improved");
  const setbacks = changesFor(clubs, "declined");
  const changes = changesFor(clubs, "changed");
  const matchedShotCount = compared.reduce((total, club) => total + club.currentShotCount, 0);
  const coverage = {
    matchedClubs: compared.length,
    totalClubs: clubs.length,
    matchedShotCount,
    eligibleShotCount: latest.summary.eligibleShotCount,
    label: `${compared.length} of ${clubs.length} clubs compared · ${matchedShotCount} of ${latest.summary.eligibleShotCount} trusted full shots`,
  };
  const sampleLabel = compared.some((club) =>
    club.metrics.some(
      (metric) => metric.delta !== null && Math.min(metric.currentCount, metric.previousCount) < 10,
    ),
  )
    ? "This is an early signal from small samples."
    : "";
  const summary = !previous
    ? "Your measurements are visible. A previous practice date with the same equipment is needed to judge a change."
    : compared.length === 0
      ? "There are not yet enough comparable control or carry readings from the same equipment to judge better or worse."
      : [
          `${clubType ? `${formatClubType(clubType)} in the ${scope === "session" ? "selected upload" : "selected practice day"}` : scope === "session" ? "Selected upload" : "Selected practice day"} compared with ${formatDate(previous.summary.dateKey)}.`,
          clubVerdictSummary(compared),
          ...carryTradeoffs,
          verdict === "mixed"
            ? "Some comparable measurements improved while others slipped."
            : null,
          verdict === "steady"
            ? "Comparable control or carry-consistency measurements stayed within 2 yd of the previous practice day."
            : null,
          sampleLabel,
        ]
          .filter(Boolean)
          .join(" ");

  return {
    scope,
    latest: latest.summary,
    previous: previous?.summary ?? null,
    verdict,
    headline: reportHeadline(
      verdict,
      compared.length,
      clubs.length,
      matchedShotCount,
      latest.summary.eligibleShotCount,
      scope,
      clubType,
    ),
    summary,
    improvements,
    setbacks,
    changes,
    clubs,
    coverage,
    recentTrend: buildRecentTrend([latest, ...history], scope),
    method: [
      ...(clubType
        ? [
            `This report is limited to ${formatClubType(clubType)}. Counts, comparisons and recent-day outcomes use this club type only; earlier practice dates without it remain visible.`,
          ]
        : []),
      "Comparisons match the same saved club and club type. Changed or unidentified equipment stays visible without being treated as comparable.",
      "Each comparison needs at least 3 available readings for that metric on both dates. Fewer than 10 readings is an early signal. Missing or questioned direction is omitted, never counted as zero.",
      "Control uses mean absolute sideways miss; carry spread uses standard deviation. A 2 yd change counts as a control or consistency signal. Carry and ball speed changes alone do not establish improvement.",
      "A carry loss of at least 10 yd and 10% alongside better control or consistency is shown as a mixed trade-off. This is a review cue, not a claim about your intent or the cause of shorter shots.",
      "Excluded shots, warm-ups, data errors, pitches, chips, recovery shots and rounds do not contribute. Restored shots follow your review choice. Multiple uploads on one practice date count as one day.",
      "The recent trend needs at least 3 dates with the same equipment and measured metrics throughout. Each date and club has equal weight. Weather and playing conditions are not adjusted, so a change does not establish its cause.",
    ],
  };
}

function prepareDay(
  day: TodayProgressHistoryDay,
  seen: Set<string>,
  clubType?: string,
): PreparedDay {
  const practiceRows = day.rawShots.filter((shot) => {
    const time = new Date(shot.shotAt);
    if (
      !validDateKey(day.dateKey) ||
      !Number.isFinite(time.getTime()) ||
      dateFormatter.format(time) !== day.dateKey ||
      isRoundSessionType(shot.sessionType) ||
      seen.has(shot.id)
    )
      return false;
    seen.add(shot.id);
    return true;
  });
  const raw = clubType ? practiceRows.filter((shot) => shot.clubType === clubType) : practiceRows;
  const eligible = raw
    .map((shot) => ({
      ...shot,
      dataIntegrityIssue: shot.dataIntegrityIssue ?? detectShotDataIntegrityIssue(shot),
    }))
    .map(withDirectionalConfidence)
    .filter(isComparisonShot)
    .filter(
      (shot) =>
        !["pitch", "partial", "partial_shot", "partial-shot"].includes(
          shot.shotCategory?.trim().toLowerCase() ?? "",
        ),
    );
  const groups = new Map<string, ClubGroup>();
  for (const shot of raw) {
    const key = equipmentKey(shot);
    const group = groups.get(key) ?? { raw: [], eligible: [] };
    group.raw.push(shot);
    groups.set(key, group);
  }
  for (const shot of eligible) groups.get(equipmentKey(shot))!.eligible.push(shot);
  return {
    hasPracticeRows: practiceRows.length > 0,
    summary: {
      dateKey: day.dateKey,
      uploadCount: new Set(raw.map((shot) => shot.sessionId)).size,
      shotCount: raw.length,
      eligibleShotCount: eligible.length,
      excludedShotCount: raw.length - eligible.length,
      clubCount: groups.size,
    },
    clubs: groups,
  };
}

function compareClub(
  key: string,
  group: ClubGroup,
  previous: PreparedDay | null,
): TodayProgressClub {
  const shot = group.raw[0];
  const prior = shot.clubId ? previous?.clubs.get(key) : undefined;
  const metrics = metricDefinitions.map((definition) =>
    compareMetric(definition, group.eligible, prior?.eligible ?? []),
  );
  const enough = metrics.some((metric) => isControlMetric(metric) && metric.delta !== null);
  const otherEquipment =
    previous &&
    [...previous.clubs.values()].some((candidate) => candidate.raw[0].clubType === shot.clubType);
  const status: TodayProgressClub["status"] = !shot.clubId
    ? "unknown-equipment"
    : !prior
      ? otherEquipment
        ? "equipment-changed"
        : "new-club"
      : enough
        ? "compared"
        : "low-sample";
  const reason =
    status === "unknown-equipment"
      ? "The saved equipment identity is missing."
      : status === "equipment-changed"
        ? "The previous date used different equipment for this club type."
        : status === "new-club"
          ? "This equipment has no readings on the previous practice date."
          : status === "low-sample"
            ? "At least 3 control or carry readings are needed on both dates."
            : metrics.some(
                  (metric) =>
                    isControlMetric(metric) &&
                    metric.delta !== null &&
                    Math.min(metric.currentCount, metric.previousCount) < 10,
                )
              ? "Same equipment · early signal from fewer than 10 readings."
              : "Same equipment and comparable measured readings.";
  return {
    key,
    clubId: shot.clubId ?? null,
    clubType: shot.clubType,
    clubLabel: formatClubType(shot.clubType),
    equipmentLabel:
      [shot.clubBrand, shot.clubModel].filter(Boolean).join(" ") || "Unspecified equipment",
    status,
    reason,
    verdict: enough ? metricVerdict(metrics) : "building",
    currentShotCount: group.eligible.length,
    previousShotCount: prior?.eligible.length ?? 0,
    metrics,
  };
}

function measure(shots: TodayPracticeShot[], key: TodayProgressMetricKey): Measure {
  const values = shots
    .map((shot) =>
      key === "offline" ? shot.sideCarryYd : key === "ballSpeed" ? shot.ballSpeedMph : shot.carryYd,
    )
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .filter((value) => key === "offline" || value >= 0);
  return {
    count: values.length,
    value:
      key === "carrySpread"
        ? sampleStandardDeviation(values)
        : mean(key === "offline" ? values.map(Math.abs) : values),
  };
}

function compareMetric(
  definition: (typeof metricDefinitions)[number],
  currentShots: TodayPracticeShot[],
  previousShots: TodayPracticeShot[],
): TodayProgressMetric {
  const current = measure(currentShots, definition.key);
  const previous = measure(previousShots, definition.key);
  const rawDelta =
    current.count >= MIN_READINGS &&
    previous.count >= MIN_READINGS &&
    current.value !== null &&
    previous.value !== null
      ? current.value - previous.value
      : null;
  return {
    key: definition.key,
    label: definition.label,
    unit: definition.unit,
    current: rounded(current.value),
    previous: rounded(previous.value),
    currentCount: current.count,
    previousCount: previous.count,
    delta: rounded(rawDelta),
    direction:
      rawDelta === null
        ? "unavailable"
        : Math.abs(rawDelta) < definition.threshold
          ? "steady"
          : definition.key === "carry" || definition.key === "ballSpeed"
            ? "changed"
            : rawDelta < 0
              ? "improved"
              : "declined",
  };
}

function isControlMetric(metric: { key: TodayProgressMetricKey }) {
  return metric.key === "offline" || metric.key === "carrySpread";
}

function verdictFor(
  metrics: Array<Pick<TodayProgressMetric, "delta" | "direction">>,
): TodayProgressVerdict {
  const measured = metrics.filter((metric) => metric.delta !== null);
  if (!measured.length) return "building";
  const improved = measured.some((metric) => metric.direction === "improved");
  const declined = measured.some((metric) => metric.direction === "declined");
  return improved && declined ? "mixed" : improved ? "better" : declined ? "worse" : "steady";
}

function materialCarryLoss(metric: TodayProgressMetric | undefined) {
  return Boolean(
    metric &&
    metric.previous !== null &&
    metric.current !== null &&
    metric.delta !== null &&
    metric.previous > 0 &&
    metric.delta <= -10 &&
    metric.current <= metric.previous * 0.9,
  );
}

function metricVerdict(metrics: TodayProgressMetric[]): TodayProgressVerdict {
  const verdict = verdictFor(metrics.filter(isControlMetric));
  return verdict === "better" && materialCarryLoss(metrics.find((metric) => metric.key === "carry"))
    ? "mixed"
    : verdict;
}

function comparisonVerdict(clubs: TodayProgressClub[]): TodayProgressVerdict {
  const verdict = verdictFor(clubs.flatMap((club) => club.metrics.filter(isControlMetric)));
  return verdict === "better" && clubs.some((club) => carryTradeoff(club)) ? "mixed" : verdict;
}

function carryTradeoff(club: TodayProgressClub): string | null {
  const carry = club.metrics.find((metric) => metric.key === "carry");
  if (verdictFor(club.metrics.filter(isControlMetric)) !== "better" || !materialCarryLoss(carry))
    return null;
  const improvement = club.metrics.find(
    (metric) => isControlMetric(metric) && metric.direction === "improved",
  );
  return `${club.clubLabel}: ${improvement?.key === "offline" ? "closer landings" : "tighter carry spread"} came with ${Math.abs(carry!.delta!)} yd less carry (${carry!.previous} → ${carry!.current} yd), so the result is mixed.`;
}

function changesFor(
  clubs: TodayProgressClub[],
  direction: "improved" | "declined" | "changed",
): TodayProgressChange[] {
  return clubs
    .flatMap((club) =>
      club.metrics.flatMap((metric) => {
        if (
          club.status !== "compared" ||
          metric.direction !== direction ||
          metric.previous === null ||
          metric.current === null ||
          metric.delta === null
        )
          return [];
        const changeLabel =
          metric.key === "offline"
            ? metric.delta < 0
              ? "closer to target"
              : "farther from target"
            : metric.key === "carrySpread"
              ? metric.delta < 0
                ? "tighter carry spread"
                : "wider carry spread"
              : metric.key === "carry"
                ? metric.delta > 0
                  ? "longer average carry"
                  : "shorter average carry"
                : metric.delta > 0
                  ? "more ball speed"
                  : "less ball speed";
        return [
          {
            clubLabel: club.clubLabel,
            equipmentLabel: club.equipmentLabel,
            metric: metric.key,
            previous: metric.previous,
            current: metric.current,
            delta: metric.delta,
            unit: metric.unit,
            text: `${club.clubLabel}: ${Math.abs(metric.delta)} ${metric.unit} ${changeLabel} (${metric.previous} → ${metric.current} ${metric.unit}).`,
          },
        ];
      }),
    )
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

function reportHeadline(
  verdict: TodayProgressVerdict,
  matched: number,
  total: number,
  matchedShots: number,
  eligible: number,
  scope: "day" | "session",
  clubType?: string,
) {
  if (clubType) {
    const label = formatClubType(clubType);
    return verdict === "building"
      ? `${label}: more comparable practice is needed`
      : verdict === "better"
        ? `${label}: control or consistency improved`
        : verdict === "worse"
          ? `${label}: control or consistency slipped`
          : verdict === "mixed"
            ? `${label}: improvements and trade-offs`
            : `${label}: broadly steady`;
  }
  if (verdict === "building") return "More comparable practice is needed";
  const scoped = matched < total || matchedShots < eligible / 2;
  const subject = scoped
    ? `${matched} comparable ${matched === 1 ? "club" : "clubs"}`
    : scope === "session"
      ? "This upload"
      : "Your practice";
  return verdict === "better"
    ? scoped
      ? "Improvement in the comparable clubs"
      : "Better than your previous practice"
    : verdict === "worse"
      ? scoped
        ? "Setbacks in the comparable clubs"
        : "Behind your previous practice"
      : verdict === "mixed"
        ? `${subject}: improvements and setbacks`
        : `${subject}: broadly steady`;
}

function clubVerdictSummary(clubs: TodayProgressClub[]) {
  const labels = {
    better: "improved",
    worse: "slipped",
    mixed: "mixed",
    steady: "steady",
  } as const;
  const counts = Object.entries(labels).flatMap(([verdict, label]) => {
    const count = clubs.filter((club) => club.verdict === verdict).length;
    return count ? [`${count} ${label}`] : [];
  });
  return counts.length ? `Comparable clubs: ${counts.join(", ")}.` : "";
}

function buildRecentTrend(
  days: PreparedDay[],
  scope: "day" | "session",
): TodayProgressReport["recentTrend"] {
  const summaries = recentDaySummaries(days);
  // A single selected upload must not be presented as the complete latest practice day.
  if (scope === "session")
    return {
      verdict: "building",
      headline: "Full-day trend available in Today",
      summary:
        "This report is scoped to one upload. Open the full practice day to compare recent days consistently.",
      comparedClubs: 0,
      days: summaries,
    };
  for (let length = days.length; length >= 3; length--) {
    const window = days.slice(0, length);
    const cohort = [...window[0].clubs.entries()].flatMap(([key, latest]) => {
      if (!latest.raw[0].clubId) return [];
      const metrics = metricDefinitions
        .filter((definition) => isControlMetric(definition))
        .flatMap((definition) => {
          const values = [...window]
            .reverse()
            .map((day) => measure(day.clubs.get(key)?.eligible ?? [], definition.key));
          if (values.some((value) => value.count < MIN_READINGS || value.value === null)) return [];
          const change = fittedChange(values.map((value) => value.value!));
          return [
            {
              delta: change,
              direction:
                Math.abs(change) < definition.threshold
                  ? ("steady" as const)
                  : change < 0
                    ? ("improved" as const)
                    : ("declined" as const),
            },
          ];
        });
      const endpointComparison = compareClub(key, latest, window.at(-1)!);
      return metrics.length ? [{ key, metrics, tradeoff: carryTradeoff(endpointComparison) }] : [];
    });
    if (!cohort.length) continue;
    // Each club contributes one equal-weight trend after equal-weight daily measurements.
    const clubChanges = cohort.map((club) => mean(club.metrics.map((metric) => metric.delta))!);
    const combinedChange = mean(clubChanges)!;
    const anyImprovement = cohort.some((club) => verdictFor(club.metrics) === "better");
    const anyDecline = cohort.some((club) => verdictFor(club.metrics) === "worse");
    const mixedWithinClub = cohort.some((club) => verdictFor(club.metrics) === "mixed");
    const measuredVerdict: TodayProgressVerdict =
      (anyImprovement && anyDecline) || mixedWithinClub
        ? "mixed"
        : combinedChange <= -2
          ? "better"
          : combinedChange >= 2
            ? "worse"
            : "steady";
    const tradeoffs = cohort
      .map((club) => club.tradeoff)
      .filter((text): text is string => Boolean(text));
    const verdict = measuredVerdict === "better" && tradeoffs.length ? "mixed" : measuredVerdict;
    const subject =
      cohort.length === 1
        ? `${formatClubType(window[0].clubs.get(cohort[0].key)!.raw[0].clubType)} trend`
        : `${cohort.length} comparable clubs`;
    const headline =
      verdict === "better"
        ? `${subject}: improving`
        : verdict === "worse"
          ? `${subject}: slipping`
          : verdict === "mixed"
            ? `${subject}: gains and setbacks`
            : `${subject}: broadly steady`;
    return {
      verdict,
      headline,
      summary: [
        `${cohort.length} ${cohort.length === 1 ? "club is" : "clubs are"} comparable across ${length} practice dates, ${formatDate(window.at(-1)!.summary.dateKey)} to ${formatDate(window[0].summary.dateKey)}. Each day and club counts equally.`,
        ...tradeoffs,
      ].join(" "),
      comparedClubs: cohort.length,
      days: summaries,
    };
  }
  return {
    verdict: "building",
    headline: "Building your recent practice trend",
    summary:
      days.length < 3
        ? "At least 3 practice dates with comparable equipment and readings are needed for a recent trend."
        : "No equipment has enough control or carry readings across 3 consecutive recent practice dates yet.",
    comparedClubs: 0,
    days: summaries,
  };
}

function recentDaySummaries(days: PreparedDay[]): TodayProgressRecentDay[] {
  return days.map((day, index) => {
    const previous = days[index + 1];
    if (!previous)
      return {
        ...day.summary,
        verdict: "baseline",
        takeaway: "Starting point for the displayed practice history.",
        baselineDateKey: null,
      };
    const clubs = [...day.clubs].map(([key, group]) => compareClub(key, group, previous));
    const comparable = clubs.filter((club) => club.status === "compared");
    const verdict = comparisonVerdict(comparable);
    const improvement = changesFor(clubs, "improved")[0];
    const setback = changesFor(clubs, "declined")[0];
    const tradeoff = comparable.map(carryTradeoff).find(Boolean);
    const takeaway =
      verdict === "building"
        ? "More readings from the same equipment are needed for this comparison."
        : [tradeoff ?? improvement?.text, setback?.text].filter(Boolean).join(" ") ||
          `${comparable.length} comparable ${comparable.length === 1 ? "club" : "clubs"}: available control or carry-consistency measurements were broadly steady.`;
    return { ...day.summary, verdict, takeaway, baselineDateKey: previous.summary.dateKey };
  });
}

function fittedChange(values: number[]) {
  const center = (values.length - 1) / 2;
  const average = mean(values)!;
  let numerator = 0;
  let denominator = 0;
  values.forEach((value, index) => {
    numerator += (index - center) * (value - average);
    denominator += (index - center) ** 2;
  });
  return denominator ? (numerator / denominator) * (values.length - 1) : 0;
}

function equipmentKey(shot: TodayPracticeShot) {
  return `${shot.clubId ?? `unknown:${shot.clubBrand ?? ""}:${shot.clubModel ?? ""}`}::${shot.clubType}`;
}
function rounded(value: number | null) {
  return value === null ? null : Math.round(value * 10) / 10;
}
function validDateKey(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T12:00:00Z`)) &&
    new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
  );
}
function formatDate(key: string) {
  return new Date(`${key}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}
