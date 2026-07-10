export const analysisAnnotationTypes = [
  "swing_thought",
  "lesson",
  "injury_fatigue",
  "equipment_change",
  "ball_change",
  "surface",
  "venue",
  "weather",
  "technique_experiment",
] as const;

export type AnalysisAnnotationType = (typeof analysisAnnotationTypes)[number];

export type DataQualityCounts = {
  unmappedClubs: number;
  duplicateImports: number;
  suspiciousDistances: number;
  likelyUnitMismatch: boolean;
  incompleteScorecards: number;
  missingRatingRounds: number;
  lowSampleClubs: number;
  unclassifiedSessions: number;
};

export type DataQualityIssue = {
  key: keyof DataQualityCounts;
  title: string;
  detail: string;
  count: number;
  severity: "high" | "medium" | "low";
  href: string;
  action: string;
};

export function buildDataQualityIssues(counts: DataQualityCounts) {
  const issues: DataQualityIssue[] = [];
  addIssue(issues, counts.unmappedClubs, {
    key: "unmappedClubs",
    title: "Unmapped clubs",
    detail: "Shots with unknown club labels cannot build dependable stock or gapping numbers.",
    severity: "high",
    href: "/shots?club=other",
    action: "Map clubs",
  });
  addIssue(issues, counts.duplicateImports, {
    key: "duplicateImports",
    title: "Duplicate imports",
    detail: "Review retained duplicate-file records before using session counts as evidence depth.",
    severity: "medium",
    href: "/import",
    action: "Review imports",
  });
  addIssue(issues, counts.suspiciousDistances, {
    key: "suspiciousDistances",
    title: "Suspicious distances",
    detail: "Non-positive or extreme distances need review as likely misreads or unit problems.",
    severity: "high",
    href: "/shots?sort=carry&dir=desc",
    action: "Inspect shots",
  });
  addIssue(issues, counts.likelyUnitMismatch ? 1 : 0, {
    key: "likelyUnitMismatch",
    title: "Likely unit mismatch",
    detail: "The overall carry distribution is outside a plausible yard-based range.",
    severity: "high",
    href: "/import",
    action: "Check source units",
  });
  addIssue(issues, counts.incompleteScorecards, {
    key: "incompleteScorecards",
    title: "Incomplete scorecards",
    detail: "Handicap estimates exclude scorecards without 9 or 18 complete hole scores.",
    severity: "medium",
    href: "/rounds",
    action: "Complete rounds",
  });
  addIssue(issues, counts.missingRatingRounds, {
    key: "missingRatingRounds",
    title: "Missing course rating or slope",
    detail: "Fallback estimates use par and slope 113 and should be treated as lower confidence.",
    severity: "medium",
    href: "/handicap#tasks",
    action: "Add rating data",
  });
  addIssue(issues, counts.lowSampleClubs, {
    key: "lowSampleClubs",
    title: "Low-sample stock distances",
    detail: "These active clubs need at least eight trusted stock shots before the number settles.",
    severity: "low",
    href: "/bag#bag-confidence",
    action: "Review bag trust",
  });
  addIssue(issues, counts.unclassifiedSessions, {
    key: "unclassifiedSessions",
    title: "Sessions need classification",
    detail: "Unknown play context weakens like-for-like personal baseline comparisons.",
    severity: "low",
    href: "/sessions",
    action: "Review sessions",
  });

  return issues.sort((left, right) => severityRank(left.severity) - severityRank(right.severity));
}

function addIssue(
  issues: DataQualityIssue[],
  count: number,
  issue: Omit<DataQualityIssue, "count">,
) {
  if (count > 0) issues.push({ ...issue, count });
}

function severityRank(severity: DataQualityIssue["severity"]) {
  return severity === "high" ? 0 : severity === "medium" ? 1 : 2;
}

export function validateAnalysisAnnotation(input: {
  annotationType: string;
  title: string;
  body: string;
  rangeFrom?: Date | null;
  rangeTo?: Date | null;
}) {
  if (!analysisAnnotationTypes.includes(input.annotationType as AnalysisAnnotationType)) {
    throw new Error("Choose a supported annotation type.");
  }
  const title = input.title.trim().slice(0, 180);
  const body = input.body.trim().slice(0, 4_000);
  if (!title || !body) throw new Error("Annotation title and note are required.");
  if (input.rangeFrom && input.rangeTo && input.rangeTo < input.rangeFrom) {
    throw new Error("Annotation end date cannot be before its start date.");
  }

  return {
    annotationType: input.annotationType as AnalysisAnnotationType,
    title,
    body,
    rangeFrom: input.rangeFrom ?? null,
    rangeTo: input.rangeTo ?? null,
  };
}

export function buildAnalysisSnapshot(input: {
  name: string;
  filters: Record<string, unknown>;
  chartState: Record<string, unknown>;
  selectedMetrics: string[];
  notes?: string | null;
  summary: Record<string, unknown>;
  sourceDataThrough?: Date | null;
  capturedAt?: Date;
}) {
  const name = input.name.trim().slice(0, 180);
  if (!name) throw new Error("Snapshot name is required.");

  return {
    name,
    filtersJson: structuredClone(input.filters),
    chartStateJson: structuredClone(input.chartState),
    selectedMetricsJson: [...new Set(input.selectedMetrics.map(cleanMetric).filter(Boolean))].slice(
      0,
      24,
    ),
    notes: input.notes?.trim().slice(0, 4_000) || null,
    summaryJson: structuredClone(input.summary),
    sourceDataThrough: input.sourceDataThrough ?? null,
    capturedAt: input.capturedAt ?? new Date(),
  };
}

function cleanMetric(value: string) {
  return value
    .trim()
    .replace(/[^a-z0-9 _-]/gi, "")
    .slice(0, 80);
}
