import {
  buildClubKey,
  formatClubType,
  normalizeClubType,
  parseRapsodoCsv,
  type DistanceUnit,
  type ParsedRapsodoRawRow,
  type ParsedRapsodoShot,
  type ParseRapsodoCsvResult,
  type RapsodoColumnMapping,
} from "@/lib/rapsodo/parser";
import {
  detectLaunchMonitorProvider,
  launchMonitorProviders,
  type LaunchMonitorProviderKind,
  type NormalizedSession,
  type NormalizedShot,
} from "@/lib/imports/providers";

export type ParsedLaunchMonitorImportResult = Omit<ParseRapsodoCsvResult, "source"> & {
  source: LaunchMonitorProviderKind;
};

export async function parseLaunchMonitorImportCsv({
  rawCsvText,
  fileName,
  source,
  fallbackDistanceUnit = "yards",
  columnMapping,
}: {
  rawCsvText: string;
  fileName?: string;
  source?: LaunchMonitorProviderKind;
  fallbackDistanceUnit?: DistanceUnit;
  columnMapping?: RapsodoColumnMapping;
}): Promise<ParsedLaunchMonitorImportResult> {
  if (source === "rapsodo") {
    return parseRapsodoImport(rawCsvText, fallbackDistanceUnit, columnMapping);
  }

  const provider =
    source !== undefined
      ? launchMonitorProviders.find((candidate) => candidate.providerKind === source)
      : await detectLaunchMonitorProvider({ fileName, text: rawCsvText });

  if (!provider || provider.providerKind === "rapsodo") {
    return parseRapsodoImport(rawCsvText, fallbackDistanceUnit, columnMapping);
  }

  const session = await provider.parse({ fileName, text: rawCsvText });
  return normalizedSessionToParsedImport(session, fallbackDistanceUnit);
}

function parseRapsodoImport(
  rawCsvText: string,
  fallbackDistanceUnit: DistanceUnit,
  columnMapping?: RapsodoColumnMapping,
): ParsedLaunchMonitorImportResult {
  const parsed = parseRapsodoCsv(rawCsvText, {
    fallbackDistanceUnit,
    columnMapping,
  });

  return {
    ...parsed,
    source: "rapsodo",
  };
}

function normalizedSessionToParsedImport(
  session: NormalizedSession,
  fallbackDistanceUnit: DistanceUnit,
): ParsedLaunchMonitorImportResult {
  const rawRows = normalizedRawRows(session);
  const shots = session.shots
    .map((shot, index) => normalizedShotToParsedShot(shot, index))
    .filter((shot): shot is ParsedRapsodoShot => shot !== null);

  return {
    source: session.providerKind,
    rowCount: rawRows.length,
    shotCount: shots.length,
    sessionTitle: session.sessionTitle,
    exportedAtIso: null,
    detectedDistanceUnit: "unknown",
    appliedDistanceUnit: fallbackDistanceUnit,
    headers: session.rawHeaders,
    shots,
    rawRows,
    warnings: session.warnings,
  };
}

function normalizedRawRows(session: NormalizedSession): ParsedRapsodoRawRow[] {
  const headerRow =
    session.rawHeaders.length > 0
      ? [
          {
            rowNumber: 1,
            rowType: "header" as const,
            cells: session.rawHeaders,
            sourceRawJson: Object.fromEntries(
              session.rawHeaders.map((header, index) => [`cell_${index + 1}`, header]),
            ),
          },
        ]
      : [];

  return [
    ...headerRow,
    ...session.shots.map((shot, index) => ({
      rowNumber: shot.rowNumber ?? index + 2,
      rowType: "shot" as const,
      cells: session.rawHeaders.map((header) => shot.raw[header] ?? ""),
      sourceRawJson: shot.raw,
    })),
  ];
}

function normalizedShotToParsedShot(shot: NormalizedShot, index: number): ParsedRapsodoShot | null {
  const clubType = normalizeClubType(shot.clubRaw ?? shot.clubType);

  if (clubType === "unknown" && Object.keys(shot.metrics).length === 0) {
    return null;
  }

  const rowNumber = shot.rowNumber ?? index + 2;

  return {
    rowNumber,
    shotNumber: shot.shotNumber ?? index + 1,
    clubTypeRaw: shot.clubRaw,
    clubType,
    clubLabel: formatClubType(clubType),
    clubBrand: null,
    clubModel: null,
    clubKey: buildClubKey(clubType, null, null),
    carryYd: metricValue(shot, "carry_yards"),
    totalYd: metricValue(shot, "total_yards"),
    ballSpeedMph: metricValue(shot, "ball_speed_mph"),
    clubSpeedMph: metricValue(shot, "club_speed_mph"),
    launchAngleDeg: metricValue(shot, "launch_angle_deg"),
    launchDirectionDeg: metricValue(shot, "launch_direction_deg"),
    apexFt: metricValue(shot, "apex_feet"),
    sideCarryYd: metricValue(shot, "offline_yards"),
    attackAngleDeg: metricValue(shot, "attack_angle_deg"),
    clubPathDeg: metricValue(shot, "club_path_deg"),
    faceAngleDeg: metricValue(shot, "face_angle_deg"),
    descentAngleDeg: metricValue(shot, "descent_angle_deg"),
    smashFactor: metricValue(shot, "smash_factor"),
    spinRate: metricValue(shot, "spin_rate_rpm"),
    spinAxis: metricValue(shot, "spin_axis_deg"),
    shotShape: null,
    shotCategory: "full",
    qualityTag: null,
    clubDataEstType: null,
    sourceRawJson: shot.raw,
    warnings: shot.warnings,
  };
}

function metricValue(shot: NormalizedShot, key: keyof NormalizedShot["metrics"]) {
  const value = shot.metrics[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
