export const roundSessionTypes = ["round", "simulator", "simulated_course", "real_round"] as const;

export type RoundSessionType = (typeof roundSessionTypes)[number];
export type ImportedSessionType = "range" | Exclude<RoundSessionType, "real_round">;

const nonRoundRapsodoSimulationModes = new Set(["range", "target", "ctp"]);

export function isRoundSessionType(value: string | null | undefined): value is RoundSessionType {
  return roundSessionTypes.includes(value as RoundSessionType);
}

export function isNonRoundRapsodoSimulationMode(value: string | null | undefined) {
  return Boolean(value && nonRoundRapsodoSimulationModes.has(value.trim().toLowerCase()));
}

export function isRoundHistorySession(session: {
  type: string | null | undefined;
  providerKind?: string | null;
  providerSessionMode?: string | null;
}) {
  if (!isRoundSessionType(session.type)) {
    return false;
  }

  return !(
    session.type === "simulator" &&
    session.providerKind === "simulation" &&
    isNonRoundRapsodoSimulationMode(session.providerSessionMode)
  );
}

export function inferRapsodoImportSessionType(session: {
  providerKind: string | null | undefined;
  providerSessionMode?: string | null;
  providerSessionType?: string | null;
  title?: string | null;
}): ImportedSessionType {
  const descriptor = [session.providerSessionMode, session.providerSessionType, session.title]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (session.providerKind === "simulation" && /\bcourses?\b/.test(descriptor)) {
    return "simulated_course";
  }

  if (
    session.providerKind === "simulation" &&
    (isNonRoundRapsodoSimulationMode(session.providerSessionMode) ||
      /\b(range|target|ctp|closest to pin)\b/.test(descriptor))
  ) {
    return "range";
  }

  if (session.providerKind === "simulation") {
    return "simulator";
  }

  return "range";
}
