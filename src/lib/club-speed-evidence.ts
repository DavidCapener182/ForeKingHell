export type ClubSpeedMeasurementTrust = "measured" | "estimated" | "unknown";

export function clubSpeedMeasurementTrust(value: string | null): ClubSpeedMeasurementTrust {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (
    value === null ||
    /^0(?:\.0+)?$/.test(normalized) ||
    ["false", "measured", "direct"].includes(normalized)
  ) {
    return "measured";
  }

  if (
    /^1(?:\.0+)?$/.test(normalized) ||
    normalized === "true" ||
    normalized.includes("est") ||
    normalized.includes("model")
  ) {
    return "estimated";
  }

  return "unknown";
}
