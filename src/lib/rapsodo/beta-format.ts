/** Beta R-Cloud supplies SI measurements; convert explicitly for the existing CSV parser. */
export function betaShots(detail: unknown): Record<string, unknown>[] {
  const data = betaData(detail);
  if (!Array.isArray(data.shots)) throw new Error("Beta R-Cloud did not return session shots.");
  return data.shots
    .filter(isRecord)
    .sort((a, b) => String(a.startDate ?? "").localeCompare(String(b.startDate ?? "")));
}

export function betaData(payload: unknown): Record<string, unknown> {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    throw new Error("Beta R-Cloud returned an unexpected session response.");
  }
  return payload.data;
}

export function betaSessionCsv(detail: unknown, clubs: Record<string, unknown>[]) {
  const byId = new Map(clubs.map((club) => [String(club.id), club]));
  const headers = [
    "Shot Number",
    "Club Type",
    "Club Brand",
    "Club Model",
    "Carry Distance (yards)",
    "Total Distance (yards)",
    "Ball Speed",
    "Club Speed",
    "Launch Angle",
    "Launch Direction",
    "Apex (ft)",
    "Side Carry (yards)",
    "Smash Factor",
    "Descent Angle",
    "Attack Angle",
    "Club Path",
    "Spin Rate",
    "Spin Axis",
    "Club Data Est Type",
    "Beta source shot JSON",
  ];
  const rows = betaShots(detail).map((shot, index) => {
    const club = byId.get(String(shot.clubId));
    return [
      index + 1,
      club?.code ?? club?.type ?? "unknown",
      club?.brandName,
      club?.modelName ?? club?.name,
      converted(shot.carry, 0.9144),
      converted(shot.carryTotal, 0.9144),
      converted(shot.ballSpeed, 0.44704),
      converted(shot.clubSpeed, 0.44704),
      shot.launchAngle,
      shot.launchDirection,
      converted(shot.apex, 0.3048),
      converted(shot.sideCarry, 0.9144),
      shot.smashFactor,
      shot.descentAngle,
      shot.attackAngle,
      shot.clubPath,
      shot.spinRate,
      shot.spinAxis,
      shot.clubDataEstType,
      JSON.stringify(shot),
    ];
  });
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

export function converted(value: unknown, divisor: number): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value / divisor : null;
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
