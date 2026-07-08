export const playContextOptions = [
  "on_course",
  "simulator",
  "practice_bay",
  "indoor",
  "unknown",
] as const;

export type PlayContext = (typeof playContextOptions)[number];

const validPlayContexts = new Set<string>(playContextOptions);

export function normalizePlayContext(value: string | null | undefined): PlayContext {
  const normalized = value
    ?.trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return normalized && validPlayContexts.has(normalized) ? (normalized as PlayContext) : "unknown";
}

export function inferPlayContext(input: {
  sessionType?: string | null;
  source?: string | null;
  providerKind?: string | null;
  providerSessionMode?: string | null;
  title?: string | null;
}): PlayContext {
  const descriptor = [
    input.sessionType,
    input.source,
    input.providerKind,
    input.providerSessionMode,
    input.title,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (input.sessionType === "real_round" || /\bon[-_\s]?course\b/.test(descriptor)) {
    return "on_course";
  }

  if (
    input.sessionType === "simulator" ||
    input.sessionType === "simulated_course" ||
    /\b(simulator|simulation|simulated course)\b/.test(descriptor)
  ) {
    return "simulator";
  }

  if (
    input.sessionType === "range" ||
    /\b(range|rapsodo|launch monitor|practice bay)\b/.test(descriptor)
  ) {
    return "practice_bay";
  }

  if (/\b(indoor|studio)\b/.test(descriptor)) {
    return "indoor";
  }

  return "unknown";
}

export function playContextLabel(context: string | null | undefined) {
  switch (normalizePlayContext(context)) {
    case "on_course":
      return "On course";
    case "simulator":
      return "Simulator";
    case "practice_bay":
      return "Practice bay";
    case "indoor":
      return "Indoor";
    default:
      return "Unknown";
  }
}

export function playContextEvidenceLabel(context: string | null | undefined) {
  switch (normalizePlayContext(context)) {
    case "on_course":
      return "Outdoor truth";
    case "simulator":
      return "Simulator only";
    case "practice_bay":
      return "Launch-monitor bay";
    case "indoor":
      return "Indoor session";
    default:
      return "Unclassified";
  }
}
