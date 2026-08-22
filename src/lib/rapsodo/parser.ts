import { resolveClubFaceAngleDeg } from "@/lib/club-face-angle";
import {
  quarantineIncompatibleTotalDistance,
  type ShotMetricIntegrityIssue,
} from "@/lib/imports/shot-metric-integrity";

export type DistanceUnit = "meters" | "yards";
export type DetectedDistanceUnit = DistanceUnit | "unknown";

export type ShotCategory = "full" | "pitch" | "chip" | "recovery" | "tee" | "approach";
export type RapsodoRawRowType = "preamble" | "header" | "shot" | "summary" | "unknown";
export type RapsodoColumnField =
  | "shotNumber"
  | "clubType"
  | "clubBrand"
  | "clubModel"
  | "carryDistance"
  | "totalDistance"
  | "ballSpeed"
  | "launchAngle"
  | "launchDirection"
  | "apex"
  | "sideCarry"
  | "clubSpeed"
  | "smashFactor"
  | "descentAngle"
  | "attackAngle"
  | "clubPath"
  | "faceAngle"
  | "clubDataEstType"
  | "spinRate"
  | "spinAxis"
  | "shotShape";
export type RapsodoColumnMapping = Partial<Record<RapsodoColumnField, string>>;

export type ParsedRapsodoShot = {
  rowNumber: number;
  shotNumber: number | null;
  clubTypeRaw: string | null;
  clubType: string;
  clubLabel: string;
  clubBrand: string | null;
  clubModel: string | null;
  clubKey: string;
  carryYd: number | null;
  totalYd: number | null;
  ballSpeedMph: number | null;
  clubSpeedMph: number | null;
  launchAngleDeg: number | null;
  launchDirectionDeg: number | null;
  apexFt: number | null;
  sideCarryYd: number | null;
  attackAngleDeg: number | null;
  clubPathDeg: number | null;
  faceAngleDeg: number | null;
  descentAngleDeg: number | null;
  smashFactor: number | null;
  spinRate: number | null;
  spinAxis: number | null;
  shotShape: string | null;
  shotCategory: ShotCategory;
  qualityTag: string | null;
  clubDataEstType: string | null;
  sourceRawJson: Record<string, string>;
  clubIdentityProvenance?: "source" | "mapped_source" | "inferred" | "unknown";
  warnings: string[];
  integrityIssues?: ShotMetricIntegrityIssue[];
};

export type ParsedRapsodoRawRow = {
  rowNumber: number;
  rowType: RapsodoRawRowType;
  cells: string[];
  sourceRawJson: Record<string, string>;
};

export type ParseRapsodoCsvResult = {
  source: "rapsodo";
  rowCount: number;
  shotCount: number;
  sessionTitle: string | null;
  exportedAtIso: string | null;
  detectedDistanceUnit: DetectedDistanceUnit;
  appliedDistanceUnit: DistanceUnit;
  headers: string[];
  shots: ParsedRapsodoShot[];
  rawRows: ParsedRapsodoRawRow[];
  warnings: string[];
};

type ParserOptions = {
  fallbackDistanceUnit?: DistanceUnit;
  columnMapping?: RapsodoColumnMapping;
};

const METERS_PER_YARD = 0.9144;
const METERS_PER_FOOT = 0.3048;
const YARDS_PER_METER = 1 / METERS_PER_YARD;
const FEET_PER_METER = 1 / METERS_PER_FOOT;

const FIELD_ALIASES = {
  shotNumber: ["shotnumber", "shot", "shotno", "shotnum"],
  clubType: ["clubtype", "club", "clubname"],
  clubBrand: ["clubbrand", "brand"],
  clubModel: ["clubmodel", "model"],
  carryDistance: ["carrydistance", "carry"],
  totalDistance: ["totaldistance", "total"],
  ballSpeed: ["ballspeed"],
  launchAngle: ["launchangle"],
  launchDirection: ["launchdirection", "startdirection"],
  apex: ["apex", "maxheight", "height"],
  sideCarry: ["sidecarry", "offline", "sideoffline"],
  clubSpeed: ["clubspeed"],
  smashFactor: ["smashfactor"],
  descentAngle: ["descentangle", "landingangle"],
  attackAngle: ["attackangle"],
  clubPath: ["clubpath"],
  faceAngle: ["faceangle", "clubfaceangle"],
  clubDataEstType: ["clubdataesttype", "clubdataestimatedtype"],
  spinRate: ["spinrate", "backspin"],
  spinAxis: ["spinaxis"],
  shotShape: ["shotshape", "shape"],
} as const;

export const RAPSODO_COLUMN_FIELD_LABELS: Record<RapsodoColumnField, string> = {
  shotNumber: "Shot number",
  clubType: "Club type",
  clubBrand: "Club brand",
  clubModel: "Club model",
  carryDistance: "Carry distance",
  totalDistance: "Total distance",
  ballSpeed: "Ball speed",
  launchAngle: "Launch angle",
  launchDirection: "Launch direction",
  apex: "Apex",
  sideCarry: "Side carry",
  clubSpeed: "Club speed",
  smashFactor: "Smash factor",
  descentAngle: "Descent angle",
  attackAngle: "Attack angle",
  clubPath: "Club path",
  faceAngle: "Face angle",
  clubDataEstType: "Club data estimate",
  spinRate: "Spin rate",
  spinAxis: "Spin axis",
  shotShape: "Shot shape",
};

const SHOT_METRIC_FIELDS: RapsodoColumnField[] = [
  "carryDistance",
  "totalDistance",
  "ballSpeed",
  "launchAngle",
];

const FIELD_HINTS: Record<RapsodoColumnField, string[]> = {
  shotNumber: ["shotnumber", "shotno", "shot"],
  clubType: ["clubtype", "clubused", "club", "stick"],
  clubBrand: ["clubbrand", "brand", "make"],
  clubModel: ["clubmodel", "model"],
  carryDistance: [
    "carrydistance",
    "carry",
    "carrymetres",
    "carrymeters",
    "carryyards",
    "flightmetres",
    "flightmeters",
  ],
  totalDistance: ["totaldistance", "total", "totalmetres", "totalmeters", "totalyards"],
  ballSpeed: ["ballspeed", "ballvelocity"],
  launchAngle: ["launchangle", "launch"],
  launchDirection: ["launchdirection", "startdirection", "direction"],
  apex: ["apex", "height", "maxheight", "peakheight"],
  sideCarry: ["sidecarry", "offline", "sideoffline", "lateral"],
  clubSpeed: ["clubspeed", "clubvelocity", "swingspeed"],
  smashFactor: ["smashfactor", "smash"],
  descentAngle: ["descentangle", "landingangle"],
  attackAngle: ["attackangle", "aoa"],
  clubPath: ["clubpath", "path"],
  faceAngle: ["faceangle", "clubfaceangle", "face"],
  clubDataEstType: ["clubdataesttype", "clubdataestimatedtype"],
  spinRate: ["spinrate", "backspin", "spin"],
  spinAxis: ["spinaxis"],
  shotShape: ["shotshape", "shape"],
};

const DISTANCE_FIELDS = new Set<string>([
  ...FIELD_ALIASES.carryDistance,
  ...FIELD_ALIASES.totalDistance,
  ...FIELD_ALIASES.apex,
  ...FIELD_ALIASES.sideCarry,
]);
const RAPSODO_SESSION_TITLE_PATTERN =
  /\b(?:rapsodo|r-cloud|mlm\s*2\s*pro|mlm2pro|mlm\s*pro|mlm)\b/i;
const RAPSODO_WALL_CLOCK_TIME_ZONE = "Europe/London";
const SLASH_DATE_PATTERN =
  /(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM)(?:\s*(?:\(\s*)?(GMT[+-]\d{1,2}(?::?\d{2})?|[+-]\d{2}:?\d{2}|Europe\/London|Z|UTC|GMT|BST)(?:\s*\))?)?)?/i;
const LONDON_WALL_CLOCK_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: RAPSODO_WALL_CLOCK_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function parseRapsodoCsv(
  csvText: string,
  options: ParserOptions = {},
): ParseRapsodoCsvResult {
  const warnings: string[] = [];
  const columnMapping = sanitizeColumnMapping(options.columnMapping);
  if (hasMalformedQuotedCsv(csvText)) {
    warnings.push("CSV contains an unterminated quoted field; parsed results may be incomplete.");
  }
  const rows = parseCsvRows(csvText).filter((row) => row.some((cell) => cell.trim() !== ""));

  if (rows.length === 0) {
    return emptyResult(options.fallbackDistanceUnit ?? "yards", ["CSV file is empty."]);
  }

  const headerIndex = rows.findIndex((row) => isHeaderRow(row, columnMapping));

  if (headerIndex === -1) {
    return emptyResult(options.fallbackDistanceUnit ?? "yards", [
      "Rapsodo column headers were not found in the CSV.",
    ]);
  }

  if (rows.length <= headerIndex + 1) {
    return emptyResult(options.fallbackDistanceUnit ?? "yards", [
      "CSV file contains headers but no shot rows.",
    ]);
  }

  const preambleRows = rows.slice(0, headerIndex);
  const sessionTitle = findSessionTitle(preambleRows);
  const exportedAtIso = parseExportedAtIso(sessionTitle);

  if (hasAmbiguousSlashDate(sessionTitle)) {
    warnings.push("Export date is ambiguous; confirm the session date before saving this import.");
  }
  const headers = rows[headerIndex].map((header) => header.trim());
  const dataRows = rows.slice(headerIndex + 1);
  const rawRows = rows.map((row, index) =>
    parseRawRow(row, index, headers, headerIndex, columnMapping),
  );
  const shotRows = dataRows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => isShotDataRow(headers, row, columnMapping));
  const detectedDistanceUnit = detectDistanceUnit(headers);
  const appliedDistanceUnit =
    detectedDistanceUnit === "unknown"
      ? (options.fallbackDistanceUnit ?? "yards")
      : detectedDistanceUnit;
  const apexUnit = detectApexUnit(headers, appliedDistanceUnit);

  if (detectedDistanceUnit === "unknown" && !options.fallbackDistanceUnit) {
    warnings.push("Distance units were not detected from the CSV headers.");
  }

  const shots = shotRows.map(({ row, index }, sequenceIndex) =>
    parseShotRow(
      headers,
      row,
      headerIndex + index + 2,
      sequenceIndex + 1,
      appliedDistanceUnit,
      apexUnit,
      columnMapping,
    ),
  );
  warnings.push(...shots.flatMap((shot) => shot.warnings));

  return {
    source: "rapsodo",
    rowCount: rawRows.length,
    shotCount: shots.length,
    sessionTitle,
    exportedAtIso,
    detectedDistanceUnit,
    appliedDistanceUnit,
    headers,
    shots,
    rawRows,
    warnings,
  };
}

export function analyzeRapsodoCsvColumns(csvText: string, options: ParserOptions = {}) {
  const columnMapping = sanitizeColumnMapping(options.columnMapping);
  const rows = parseCsvRows(csvText).filter((row) => row.some((cell) => cell.trim() !== ""));

  if (rows.length === 0) {
    return {
      headerRowNumber: null,
      headers: [],
      suggestedMapping: {} satisfies RapsodoColumnMapping,
      needsManualMapping: true,
      warnings: ["CSV file is empty."],
    };
  }

  const defaultHeaderIndex = rows.findIndex((row) => isHeaderRow(row, {}));
  const mappedHeaderIndex = rows.findIndex((row) => isHeaderRow(row, columnMapping));
  const headerIndex =
    mappedHeaderIndex !== -1
      ? mappedHeaderIndex
      : defaultHeaderIndex !== -1
        ? defaultHeaderIndex
        : findLikelyHeaderRow(rows);

  if (headerIndex === -1) {
    return {
      headerRowNumber: null,
      headers: [],
      suggestedMapping: {} satisfies RapsodoColumnMapping,
      needsManualMapping: true,
      warnings: ["No likely CSV header row was found."],
    };
  }

  const headers = rows[headerIndex].map((header) => header.trim()).filter(Boolean);
  const suggestedMapping = suggestColumnMapping(headers, columnMapping);

  return {
    headerRowNumber: headerIndex + 1,
    headers,
    suggestedMapping,
    needsManualMapping: defaultHeaderIndex === -1 && !hasMinimumShotMapping(headers, columnMapping),
    warnings: [],
  };
}

export function normalizeClubType(value: string | null | undefined) {
  const compact = slugPart(value);

  if (!compact) {
    return "unknown";
  }

  if (compact === "ot" || compact === "other" || compact === "otherclub") {
    return "other";
  }

  if (compact === "d" || compact === "drv" || compact === "driver") {
    return "driver";
  }

  const fairwayMatch = compact.match(/^([1-9])(?:wood|w|fairwaywood|fairway)$/);
  if (fairwayMatch) {
    return `${fairwayMatch[1]}w`;
  }

  const hybridMatch = compact.match(/^([1-9])(?:hybrid|h|rescue)$/);
  if (hybridMatch) {
    return `${hybridMatch[1]}h`;
  }

  if (compact === "hybrid" || compact === "rescue") {
    return "hybrid";
  }

  const ironMatch = compact.match(/^([1-9])(?:iron|i)?$/);
  if (ironMatch) {
    return `${ironMatch[1]}i`;
  }

  if (compact === "pw" || compact === "pitchingwedge") {
    return "pw";
  }

  if (compact === "gw" || compact === "gapwedge") {
    return "gw";
  }

  if (compact === "aw" || compact === "approachwedge") {
    return "aw";
  }

  if (compact === "sw" || compact === "sandwedge") {
    return "sw";
  }

  if (compact === "lw" || compact === "lobwedge") {
    return "lw";
  }

  if (compact.includes("wedge")) {
    return "wedge";
  }

  if (compact === "putter" || compact === "pt") {
    return "putter";
  }

  return compact;
}

export function formatClubType(clubType: string) {
  if (clubType === "driver") {
    return "Driver";
  }

  if (/^[1-9]w$/.test(clubType)) {
    return clubType.toUpperCase();
  }

  if (/^[1-9]h$/.test(clubType)) {
    return `${clubType[0]}H`;
  }

  if (/^[1-9]i$/.test(clubType)) {
    return `${clubType[0]}i`;
  }

  if (["pw", "gw", "aw", "sw", "lw"].includes(clubType)) {
    return clubType.toUpperCase();
  }

  if (clubType === "unknown") {
    return "Unknown";
  }

  return clubType
    .split("-")
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

export function buildClubKey(
  clubType: string,
  brand: string | null | undefined,
  model: string | null | undefined,
) {
  return [clubType || "unknown", slugPart(brand) || "generic", slugPart(model) || "generic"].join(
    ":",
  );
}

function parseShotRow(
  headers: string[],
  row: string[],
  rowNumber: number,
  sequenceNumber: number,
  distanceUnit: DistanceUnit,
  apexUnit: "meters" | "yards" | "feet",
  columnMapping: RapsodoColumnMapping,
): ParsedRapsodoShot {
  const raw = toRawRow(headers, row);
  const clubTypeRaw = valueForField(raw, "clubType", columnMapping);
  const clubType = normalizeClubType(clubTypeRaw);
  const clubBrand = nullableText(valueForField(raw, "clubBrand", columnMapping));
  const clubModel = nullableText(valueForField(raw, "clubModel", columnMapping));
  const launchDirectionDeg = parseNumber(valueForField(raw, "launchDirection", columnMapping));
  const clubPathDeg = parseNumber(valueForField(raw, "clubPath", columnMapping));
  const faceAngleDeg = resolveClubFaceAngleDeg({
    faceAngleDeg: parseNumber(valueForField(raw, "faceAngle", columnMapping)),
    launchDirectionDeg,
    clubPathDeg,
  });
  const warnings: string[] = [];
  const carryYd = parseDistanceYd(valueForField(raw, "carryDistance", columnMapping), distanceUnit);
  const parsedTotalYd = parseDistanceYd(
    valueForField(raw, "totalDistance", columnMapping),
    distanceUnit,
  );
  const totalDistance = quarantineIncompatibleTotalDistance({
    carryYd,
    totalYd: parsedTotalYd,
    rowNumber,
  });

  if (clubType === "unknown") {
    warnings.push("Club type was missing or could not be normalised.");
  }

  if (totalDistance.warning) {
    warnings.push(totalDistance.warning);
  }

  return {
    rowNumber,
    shotNumber: parseInteger(valueForField(raw, "shotNumber", columnMapping)) ?? sequenceNumber,
    clubTypeRaw: nullableText(clubTypeRaw),
    clubType,
    clubLabel: formatClubType(clubType),
    clubBrand,
    clubModel,
    clubKey: buildClubKey(clubType, clubBrand, clubModel),
    carryYd,
    totalYd: totalDistance.totalYd,
    ballSpeedMph: parseNumber(valueForField(raw, "ballSpeed", columnMapping)),
    clubSpeedMph: parseNumber(valueForField(raw, "clubSpeed", columnMapping)),
    launchAngleDeg: parseNumber(valueForField(raw, "launchAngle", columnMapping)),
    launchDirectionDeg,
    apexFt: parseApexFt(valueForField(raw, "apex", columnMapping), apexUnit),
    sideCarryYd: parseDistanceYd(valueForField(raw, "sideCarry", columnMapping), distanceUnit),
    attackAngleDeg: parseNumber(valueForField(raw, "attackAngle", columnMapping)),
    clubPathDeg,
    faceAngleDeg,
    descentAngleDeg: parseNumber(valueForField(raw, "descentAngle", columnMapping)),
    smashFactor: parseNumber(valueForField(raw, "smashFactor", columnMapping)),
    spinRate: parseNumber(valueForField(raw, "spinRate", columnMapping)),
    spinAxis: parseNumber(valueForField(raw, "spinAxis", columnMapping)),
    shotShape: nullableText(valueForField(raw, "shotShape", columnMapping)),
    shotCategory: "full",
    qualityTag: null,
    clubDataEstType: nullableText(valueForField(raw, "clubDataEstType", columnMapping)),
    sourceRawJson: raw,
    warnings,
    integrityIssues: totalDistance.issue ? [totalDistance.issue] : [],
  };
}

function parseCsvRows(csvText: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const text = csvText.replace(/^\uFEFF/, "");

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);

  return rows;
}

function isHeaderRow(row: string[], columnMapping: RapsodoColumnMapping = {}) {
  const hasClubType = row.some((cell) => headerMatchesField(cell, "clubType", columnMapping));
  const hasLaunchMetric = row.some((cell) =>
    SHOT_METRIC_FIELDS.some((field) => headerMatchesField(cell, field, columnMapping)),
  );

  return hasClubType && hasLaunchMetric;
}

function isShotDataRow(headers: string[], row: string[], columnMapping: RapsodoColumnMapping) {
  const clubTypeIndex = headers.findIndex((header) =>
    headerMatchesField(header, "clubType", columnMapping),
  );
  const clubType = normalizeHeader(row[clubTypeIndex] ?? "");

  if (!clubType) {
    return false;
  }

  return !isNonShotClubType(clubType) && hasUsefulShotMetric(headers, row, columnMapping);
}

function isSummaryRow(headers: string[], row: string[], columnMapping: RapsodoColumnMapping) {
  const clubTypeIndex = headers.findIndex((header) =>
    headerMatchesField(header, "clubType", columnMapping),
  );
  return isNonShotClubType(normalizeHeader(row[clubTypeIndex] ?? ""));
}

function isNonShotClubType(clubType: string) {
  return ["average", "avg", "stddev", "standarddeviation", "clubtype"].includes(clubType);
}

function hasUsefulShotMetric(
  headers: string[],
  row: string[],
  columnMapping: RapsodoColumnMapping,
) {
  const raw = toRawRow(headers, row);
  return SHOT_METRIC_FIELDS.some(
    (field) => parseNumber(valueForField(raw, field, columnMapping)) !== null,
  );
}

function parseRawRow(
  row: string[],
  rowIndex: number,
  headers: string[],
  headerIndex: number,
  columnMapping: RapsodoColumnMapping,
): ParsedRapsodoRawRow {
  const rowNumber = rowIndex + 1;

  if (rowIndex < headerIndex) {
    return {
      rowNumber,
      rowType: "preamble",
      cells: row,
      sourceRawJson: toCellRawJson(row),
    };
  }

  if (rowIndex === headerIndex || isHeaderRow(row, columnMapping)) {
    return {
      rowNumber,
      rowType: "header",
      cells: row,
      sourceRawJson: toCellRawJson(row),
    };
  }

  if (isShotDataRow(headers, row, columnMapping)) {
    return {
      rowNumber,
      rowType: "shot",
      cells: row,
      sourceRawJson: toRawRow(headers, row),
    };
  }

  if (isSummaryRow(headers, row, columnMapping)) {
    return {
      rowNumber,
      rowType: "summary",
      cells: row,
      sourceRawJson: toRawRow(headers, row),
    };
  }

  return {
    rowNumber,
    rowType: "unknown",
    cells: row,
    sourceRawJson: toRawRow(headers, row),
  };
}

function findSessionTitle(rows: string[][]) {
  const cells = rows.flatMap((row) => row).map((cell) => cell.trim());
  return nullableText(
    cells.find(
      (cell) => RAPSODO_SESSION_TITLE_PATTERN.test(cell) && SLASH_DATE_PATTERN.test(cell),
    ) ??
      cells.find((cell) => RAPSODO_SESSION_TITLE_PATTERN.test(cell)) ??
      cells.find((cell) => SLASH_DATE_PATTERN.test(cell)) ??
      null,
  );
}

function parseExportedAtIso(title: string | null) {
  if (!title) {
    return null;
  }

  const match = title.match(SLASH_DATE_PATTERN);

  if (!match) {
    return null;
  }

  const [, firstText, secondText, yearText, hourText, minuteText, meridiem, timezoneText] = match;
  const first = Number(firstText);
  const second = Number(secondText);
  const year = Number(yearText);
  const isDayFirst = first > 12 && second <= 12;
  const isMonthFirst = second > 12 && first <= 12;

  if (!isDayFirst && !isMonthFirst) {
    return null;
  }

  const day = isDayFirst ? first : second;
  const month = isDayFirst ? second : first;
  let hour = hourText ? Number(hourText) : 12;
  const minute = minuteText ? Number(minuteText) : 0;

  if (
    !isValidCalendarDate(year, month, day) ||
    (hourText && (hour < 1 || hour > 12)) ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  if (meridiem?.toUpperCase() === "PM" && hour < 12) {
    hour += 12;
  }
  if (meridiem?.toUpperCase() === "AM" && hour === 12) {
    hour = 0;
  }

  const wallClock = { year, month, day, hour, minute };
  const usesLondonTimeZone = !timezoneText || timezoneText.trim().toUpperCase() === "EUROPE/LONDON";
  const explicitOffset = usesLondonTimeZone
    ? null
    : explicitTimezoneOffsetMinutes(timezoneText ?? "");

  if (!usesLondonTimeZone && explicitOffset === null) {
    return null;
  }

  const parsed =
    explicitOffset === null
      ? londonWallClockToDate(wallClock)
      : new Date(Date.UTC(year, month - 1, day, hour, minute) - explicitOffset * 60_000);

  if (!parsed || Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

type RapsodoWallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function isValidCalendarDate(year: number, month: number, day: number) {
  if (year < 1900 || year > 9999 || month < 1 || month > 12 || day < 1) {
    return false;
  }

  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function explicitTimezoneOffsetMinutes(value: string) {
  const normalized = value.trim().toUpperCase();

  if (normalized === "Z" || normalized === "UTC" || normalized === "GMT") {
    return 0;
  }

  if (normalized === "BST") {
    return 60;
  }

  if (normalized === "EUROPE/LONDON") {
    return null;
  }

  const match = normalized.match(/^(?:GMT)?([+-])(\d{1,2})(?::?(\d{2}))?$/);

  if (!match) {
    return null;
  }

  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? 0);

  if (hours > 23 || minutes > 59) {
    return null;
  }

  const total = hours * 60 + minutes;
  return match[1] === "-" ? -total : total;
}

function londonWallClockToDate(wallClock: RapsodoWallClock) {
  const wallClockUtc = Date.UTC(
    wallClock.year,
    wallClock.month - 1,
    wallClock.day,
    wallClock.hour,
    wallClock.minute,
  );
  const offsetSamples = [-36, 0, 36].map((hours) =>
    londonOffsetMinutesAt(new Date(wallClockUtc + hours * 60 * 60 * 1000)),
  );
  const candidates = [...new Set(offsetSamples)]
    .map((offsetMinutes) => new Date(wallClockUtc - offsetMinutes * 60_000))
    .filter((candidate) => wallClockMatches(candidate, wallClock))
    .sort((left, right) => left.getTime() - right.getTime());

  return candidates[0] ?? null;
}

function londonOffsetMinutesAt(date: Date) {
  const parts = londonWallClockParts(date);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return Math.round((asUtc - date.getTime()) / 60_000);
}

function wallClockMatches(date: Date, expected: RapsodoWallClock) {
  const actual = londonWallClockParts(date);
  return (
    actual.year === expected.year &&
    actual.month === expected.month &&
    actual.day === expected.day &&
    actual.hour === expected.hour &&
    actual.minute === expected.minute
  );
}

function londonWallClockParts(date: Date): RapsodoWallClock {
  const values = new Map(
    LONDON_WALL_CLOCK_FORMATTER.formatToParts(date).map((part) => [part.type, part.value]),
  );

  return {
    year: Number(values.get("year")),
    month: Number(values.get("month")),
    day: Number(values.get("day")),
    hour: Number(values.get("hour")),
    minute: Number(values.get("minute")),
  };
}

function toRawRow(headers: string[], row: string[]) {
  const seenHeaders = new Map<string, number>();

  return headers.reduce<Record<string, string>>((rawRow, header, index) => {
    const label = header.trim() || `column_${index + 1}`;
    const seenCount = seenHeaders.get(label) ?? 0;
    seenHeaders.set(label, seenCount + 1);
    const key = seenCount === 0 ? label : `${label} (${seenCount + 1})`;
    rawRow[key] = (row[index] ?? "").trim();
    return rawRow;
  }, {});
}

function toCellRawJson(row: string[]) {
  return row.reduce<Record<string, string>>((rawRow, cell, index) => {
    rawRow[`cell_${index + 1}`] = cell.trim();
    return rawRow;
  }, {});
}

function valueFor(raw: Record<string, string>, aliases: readonly string[]) {
  const entry = Object.entries(raw).find(([header]) => {
    const normalized = normalizeHeader(header);
    return aliases.some((alias) => normalized === alias || normalized.startsWith(alias));
  });

  return entry?.[1] ?? null;
}

function valueForField(
  raw: Record<string, string>,
  field: RapsodoColumnField,
  columnMapping: RapsodoColumnMapping,
) {
  const mappedHeader = columnMapping[field];

  if (mappedHeader) {
    const mappedEntry = Object.entries(raw).find(
      ([header]) => normalizeHeader(header) === normalizeHeader(mappedHeader),
    );

    if (mappedEntry) {
      return mappedEntry[1];
    }
  }

  return valueFor(raw, FIELD_ALIASES[field]);
}

function headerMatchesField(
  header: string,
  field: RapsodoColumnField,
  columnMapping: RapsodoColumnMapping,
) {
  const normalized = normalizeHeader(header);
  const mappedHeader = columnMapping[field];

  if (mappedHeader && normalized === normalizeHeader(mappedHeader)) {
    return true;
  }

  return FIELD_ALIASES[field].some((alias) => normalized === alias || normalized.startsWith(alias));
}

function sanitizeColumnMapping(mapping: RapsodoColumnMapping | undefined): RapsodoColumnMapping {
  if (!mapping) {
    return {};
  }

  const sanitized: RapsodoColumnMapping = {};

  for (const field of Object.keys(FIELD_ALIASES) as RapsodoColumnField[]) {
    const value = mapping[field]?.trim();

    if (value) {
      sanitized[field] = value.slice(0, 160);
    }
  }

  return sanitized;
}

function findLikelyHeaderRow(rows: string[][]) {
  return rows.findIndex((row) => {
    const cells = row.map((cell) => cell.trim()).filter(Boolean);

    if (cells.length < 2) {
      return false;
    }

    const textLikeCount = cells.filter((cell) =>
      Number.isNaN(Number(cell.replace(/,/g, ""))),
    ).length;
    return textLikeCount >= Math.min(2, cells.length);
  });
}

function suggestColumnMapping(headers: string[], currentMapping: RapsodoColumnMapping) {
  const mapping: RapsodoColumnMapping = { ...currentMapping };

  for (const field of Object.keys(FIELD_ALIASES) as RapsodoColumnField[]) {
    if (mapping[field]) {
      continue;
    }

    const header = headers.find((candidate) => {
      const normalized = normalizeHeader(candidate);
      return FIELD_HINTS[field].some((hint) => normalized === hint || normalized.includes(hint));
    });

    if (header && !headerMatchesField(header, field, {})) {
      mapping[field] = header;
    }
  }

  return mapping;
}

function hasMinimumShotMapping(headers: string[], columnMapping: RapsodoColumnMapping) {
  return (
    headers.some((header) => headerMatchesField(header, "clubType", columnMapping)) &&
    headers.some((header) =>
      SHOT_METRIC_FIELDS.some((field) => headerMatchesField(header, field, columnMapping)),
    )
  );
}

function detectDistanceUnit(headers: string[]): DetectedDistanceUnit {
  let sawMeters = false;
  let sawYards = false;

  for (const header of headers) {
    const normalized = normalizeHeader(header);
    const isDistanceHeader = [...DISTANCE_FIELDS].some(
      (alias) => normalized === alias || normalized.startsWith(alias),
    );

    if (!isDistanceHeader) {
      continue;
    }

    const lowerHeader = header.toLowerCase();
    if (/\b(yd|yds|yard|yards)\b/.test(lowerHeader)) {
      sawYards = true;
    }
    if (/\b(m|meter|meters|metres)\b/.test(lowerHeader)) {
      sawMeters = true;
    }
  }

  if (sawMeters && !sawYards) {
    return "meters";
  }

  if (sawYards && !sawMeters) {
    return "yards";
  }

  return "unknown";
}

function detectApexUnit(
  headers: string[],
  fallbackDistanceUnit: DistanceUnit,
): "meters" | "yards" | "feet" {
  const apexHeader = headers.find((header) => {
    const normalized = normalizeHeader(header);
    return FIELD_ALIASES.apex.some((alias) => normalized === alias || normalized.startsWith(alias));
  });

  if (apexHeader) {
    const lowerHeader = apexHeader.toLowerCase();

    if (/\b(ft|feet|foot)\b/.test(lowerHeader)) {
      return "feet";
    }

    if (/\b(yd|yds|yard|yards)\b/.test(lowerHeader)) {
      return "yards";
    }

    if (/\b(m|meter|meters|metres)\b/.test(lowerHeader)) {
      return "meters";
    }
  }

  return fallbackDistanceUnit === "yards" ? "feet" : "meters";
}

function parseDistanceYd(value: string | null, unit: DistanceUnit) {
  const number = parseNumber(value);

  if (number === null) {
    return null;
  }

  return roundTo(unit === "meters" ? number * YARDS_PER_METER : number, 3);
}

function parseApexFt(value: string | null, unit: DistanceUnit | "feet") {
  const number = parseNumber(value);

  if (number === null) {
    return null;
  }

  if (unit === "yards") {
    return roundTo(number * 3, 3);
  }

  if (unit === "meters") {
    return roundTo(number * FEET_PER_METER, 3);
  }

  return roundTo(number, 3);
}

function parseInteger(value: string | null) {
  const number = parseNumber(value);
  return number === null ? null : Math.trunc(number);
}

function parseNumber(value: string | null) {
  const text = value?.trim();

  if (!text || ["-", "--", "n/a", "na", "null"].includes(text.toLowerCase())) {
    return null;
  }

  const match = text.replace(/,/g, "").match(/[-+]?\d*\.?\d+/);

  if (!match) {
    return null;
  }

  const number = Number(match[0]);
  return Number.isFinite(number) ? number : null;
}

function nullableText(value: string | null) {
  const text = value?.trim();
  return text ? text : null;
}

function normalizeHeader(value: string) {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function slugPart(value: string | null | undefined) {
  return (
    value
      ?.toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "")
      .trim() ?? ""
  );
}

function roundTo(value: number, decimals: number) {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}

function emptyResult(appliedDistanceUnit: DistanceUnit, warnings: string[]): ParseRapsodoCsvResult {
  return {
    source: "rapsodo",
    rowCount: 0,
    shotCount: 0,
    sessionTitle: null,
    exportedAtIso: null,
    detectedDistanceUnit: "unknown",
    appliedDistanceUnit,
    headers: [],
    shots: [],
    rawRows: [],
    warnings,
  };
}

function hasMalformedQuotedCsv(csvText: string) {
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const nextChar = csvText[index + 1];

    if (char !== '"') {
      continue;
    }

    if (inQuotes && nextChar === '"') {
      index += 1;
      continue;
    }

    inQuotes = !inQuotes;
  }

  return inQuotes;
}

function hasAmbiguousSlashDate(title: string | null) {
  const match = title?.match(/(\d{1,2})\/(\d{1,2})\/\d{4}/);

  if (!match) {
    return false;
  }

  const first = Number(match[1]);
  const second = Number(match[2]);
  return first >= 1 && first <= 12 && second >= 1 && second <= 12;
}
