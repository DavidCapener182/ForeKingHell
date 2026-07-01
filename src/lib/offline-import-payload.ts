import type { SaveRapsodoImportInput } from "@/lib/imports/save-rapsodo-import";

const sessionTypes = new Set(["range", "round", "simulator", "simulated_course"]);
const distanceUnits = new Set(["yards", "meters"]);
const importSources = new Set(["rapsodo", "square", "trackman"]);
const columnMappingFields = new Set([
  "shotNumber",
  "clubType",
  "clubBrand",
  "clubModel",
  "carryDistance",
  "totalDistance",
  "ballSpeed",
  "launchAngle",
  "launchDirection",
  "apex",
  "sideCarry",
  "clubSpeed",
  "smashFactor",
  "descentAngle",
  "attackAngle",
  "clubPath",
  "faceAngle",
  "clubDataEstType",
  "spinRate",
  "spinAxis",
  "shotShape",
]);

export type OfflineImportPayload = {
  inputs: SaveRapsodoImportInput[];
};

type OfflineHoleScoringRow = NonNullable<SaveRapsodoImportInput["courseHoleScoring"]>[number];

export function parseOfflineImportPayload(value: unknown): OfflineImportPayload | null {
  if (!isRecord(value) || !Array.isArray(value.inputs)) {
    return null;
  }

  const inputs = value.inputs.map(parseImportInput);

  if (inputs.some((input) => input === null)) {
    return null;
  }

  return { inputs: inputs as SaveRapsodoImportInput[] };
}

function parseImportInput(value: unknown): SaveRapsodoImportInput | null {
  if (!isRecord(value)) {
    return null;
  }

  const rawCsvText = stringValue(value.rawCsvText);
  const fileName = stringValue(value.fileName);
  const fileSizeBytes = numberValue(value.fileSizeBytes);
  const source = importSources.has(stringValue(value.source) ?? "")
    ? (value.source as SaveRapsodoImportInput["source"])
    : null;
  const sessionType = sessionTypes.has(stringValue(value.sessionType) ?? "")
    ? (value.sessionType as SaveRapsodoImportInput["sessionType"])
    : null;
  const sessionDate = stringValue(value.sessionDate);
  const distanceUnit = distanceUnits.has(stringValue(value.distanceUnit) ?? "")
    ? (value.distanceUnit as SaveRapsodoImportInput["distanceUnit"])
    : null;

  if (
    !rawCsvText ||
    !fileName ||
    fileSizeBytes === null ||
    !source ||
    !sessionType ||
    !sessionDate ||
    !distanceUnit
  ) {
    return null;
  }

  return {
    rawCsvText,
    fileName,
    fileSizeBytes,
    source,
    sessionType,
    sessionDate,
    distanceUnit,
    columnMapping: parseColumnMapping(value.columnMapping),
    courseName: stringValue(value.courseName) ?? undefined,
    courseScorecardText: stringValue(value.courseScorecardText) ?? undefined,
    courseHoleShotCounts: parseHoleShotCounts(value.courseHoleShotCounts),
    courseHoleScoring: parseHoleScoring(value.courseHoleScoring),
    notes: stringValue(value.notes) ?? undefined,
  };
}

function parseColumnMapping(value: unknown) {
  if (!isRecord(value)) {
    return undefined;
  }

  const mapping: NonNullable<SaveRapsodoImportInput["columnMapping"]> = {};

  for (const [field, header] of Object.entries(value)) {
    if (!columnMappingFields.has(field)) {
      continue;
    }

    const mappedHeader = stringValue(header);

    if (mappedHeader) {
      mapping[field as keyof typeof mapping] = mappedHeader.slice(0, 160);
    }
  }

  return Object.keys(mapping).length > 0 ? mapping : undefined;
}

function parseHoleShotCounts(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const rows = value
    .map((row) => {
      if (!isRecord(row)) {
        return null;
      }

      const holeNumber = numberValue(row.holeNumber);
      const shotCount = numberValue(row.shotCount);

      return holeNumber === null || shotCount === null ? null : { holeNumber, shotCount };
    })
    .filter((row): row is { holeNumber: number; shotCount: number } => row !== null);

  return rows.length > 0 ? rows : undefined;
}

function parseHoleScoring(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const rows: OfflineHoleScoringRow[] = [];

  for (const row of value) {
    if (!isRecord(row)) {
      continue;
    }

    const holeNumber = numberValue(row.holeNumber);
    const csvShotCount = numberValue(row.csvShotCount);

    if (holeNumber === null || csvShotCount === null) {
      continue;
    }

    rows.push({
      holeNumber,
      csvShotCount,
      putts: nullableNumberValue(row.putts),
      penalties: nullableNumberValue(row.penalties),
      score: nullableNumberValue(row.score),
      netScore: nullableNumberValue(row.netScore),
      fairwayHit: nullableBooleanValue(row.fairwayHit),
      gir: nullableBooleanValue(row.gir),
      strokeIndex: nullableNumberValue(row.strokeIndex),
    });
  }

  return rows.length > 0 ? rows : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nullableNumberValue(value: unknown) {
  return value === null || value === undefined ? null : numberValue(value);
}

function nullableBooleanValue(value: unknown) {
  return typeof value === "boolean" ? value : null;
}
