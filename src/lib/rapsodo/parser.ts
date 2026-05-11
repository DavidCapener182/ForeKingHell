export type DistanceUnit = "meters" | "yards";
export type DetectedDistanceUnit = DistanceUnit | "unknown";

export type ShotCategory = "full" | "pitch" | "chip" | "recovery" | "tee" | "approach";
export type RapsodoRawRowType = "preamble" | "header" | "shot" | "summary" | "unknown";

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
  descentAngleDeg: number | null;
  smashFactor: number | null;
  spinRate: number | null;
  spinAxis: number | null;
  shotShape: string | null;
  shotCategory: ShotCategory;
  qualityTag: string | null;
  clubDataEstType: string | null;
  sourceRawJson: Record<string, string>;
  warnings: string[];
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
  clubDataEstType: ["clubdataesttype", "clubdataestimatedtype"],
  spinRate: ["spinrate", "backspin"],
  spinAxis: ["spinaxis"],
  shotShape: ["shotshape", "shape"],
} as const;

const DISTANCE_FIELDS = new Set<string>([
  ...FIELD_ALIASES.carryDistance,
  ...FIELD_ALIASES.totalDistance,
  ...FIELD_ALIASES.apex,
  ...FIELD_ALIASES.sideCarry,
]);

export function parseRapsodoCsv(csvText: string, options: ParserOptions = {}): ParseRapsodoCsvResult {
  const warnings: string[] = [];
  if (hasMalformedQuotedCsv(csvText)) {
    warnings.push("CSV contains an unterminated quoted field; parsed results may be incomplete.");
  }
  const rows = parseCsvRows(csvText).filter((row) => row.some((cell) => cell.trim() !== ""));

  if (rows.length === 0) {
    return emptyResult(options.fallbackDistanceUnit ?? "yards", ["CSV file is empty."]);
  }

  const headerIndex = rows.findIndex(isHeaderRow);

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
    warnings.push("Export date is ambiguous; slash dates are interpreted as US month/day/year.");
  }
  const headers = rows[headerIndex].map((header) => header.trim());
  const dataRows = rows.slice(headerIndex + 1);
  const rawRows = rows.map((row, index) => parseRawRow(row, index, headers, headerIndex));
  const shotRows = dataRows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => isShotDataRow(headers, row));
  const detectedDistanceUnit = detectDistanceUnit(headers);
  const appliedDistanceUnit =
    detectedDistanceUnit === "unknown" ? options.fallbackDistanceUnit ?? "yards" : detectedDistanceUnit;
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
    ),
  );

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
): ParsedRapsodoShot {
  const raw = toRawRow(headers, row);
  const clubTypeRaw = valueFor(raw, FIELD_ALIASES.clubType);
  const clubType = normalizeClubType(clubTypeRaw);
  const clubBrand = nullableText(valueFor(raw, FIELD_ALIASES.clubBrand));
  const clubModel = nullableText(valueFor(raw, FIELD_ALIASES.clubModel));
  const warnings: string[] = [];

  if (clubType === "unknown") {
    warnings.push("Club type was missing or could not be normalised.");
  }

  return {
    rowNumber,
    shotNumber: parseInteger(valueFor(raw, FIELD_ALIASES.shotNumber)) ?? sequenceNumber,
    clubTypeRaw: nullableText(clubTypeRaw),
    clubType,
    clubLabel: formatClubType(clubType),
    clubBrand,
    clubModel,
    clubKey: buildClubKey(clubType, clubBrand, clubModel),
    carryYd: parseDistanceYd(valueFor(raw, FIELD_ALIASES.carryDistance), distanceUnit),
    totalYd: parseDistanceYd(valueFor(raw, FIELD_ALIASES.totalDistance), distanceUnit),
    ballSpeedMph: parseNumber(valueFor(raw, FIELD_ALIASES.ballSpeed)),
    clubSpeedMph: parseNumber(valueFor(raw, FIELD_ALIASES.clubSpeed)),
    launchAngleDeg: parseNumber(valueFor(raw, FIELD_ALIASES.launchAngle)),
    launchDirectionDeg: parseNumber(valueFor(raw, FIELD_ALIASES.launchDirection)),
    apexFt: parseApexFt(valueFor(raw, FIELD_ALIASES.apex), apexUnit),
    sideCarryYd: parseDistanceYd(valueFor(raw, FIELD_ALIASES.sideCarry), distanceUnit),
    attackAngleDeg: parseNumber(valueFor(raw, FIELD_ALIASES.attackAngle)),
    clubPathDeg: parseNumber(valueFor(raw, FIELD_ALIASES.clubPath)),
    descentAngleDeg: parseNumber(valueFor(raw, FIELD_ALIASES.descentAngle)),
    smashFactor: parseNumber(valueFor(raw, FIELD_ALIASES.smashFactor)),
    spinRate: parseNumber(valueFor(raw, FIELD_ALIASES.spinRate)),
    spinAxis: parseNumber(valueFor(raw, FIELD_ALIASES.spinAxis)),
    shotShape: nullableText(valueFor(raw, FIELD_ALIASES.shotShape)),
    shotCategory: "full",
    qualityTag: null,
    clubDataEstType: nullableText(valueFor(raw, FIELD_ALIASES.clubDataEstType)),
    sourceRawJson: raw,
    warnings,
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

function isHeaderRow(row: string[]) {
  const normalizedCells = row.map(normalizeHeader);
  const hasClubType = normalizedCells.some((cell) => FIELD_ALIASES.clubType.some((alias) => alias === cell));
  const hasLaunchMetric = normalizedCells.some((cell) =>
    [
      ...FIELD_ALIASES.carryDistance,
      ...FIELD_ALIASES.totalDistance,
      ...FIELD_ALIASES.ballSpeed,
      ...FIELD_ALIASES.launchAngle,
    ].some((alias) => alias === cell),
  );

  return hasClubType && hasLaunchMetric;
}

function isShotDataRow(headers: string[], row: string[]) {
  const clubTypeIndex = headers.findIndex((header) => {
    const normalized = normalizeHeader(header);
    return FIELD_ALIASES.clubType.some((alias) => alias === normalized);
  });
  const clubType = normalizeHeader(row[clubTypeIndex] ?? "");

  if (!clubType) {
    return false;
  }

  return !isNonShotClubType(clubType);
}

function isSummaryRow(headers: string[], row: string[]) {
  const clubTypeIndex = headers.findIndex((header) => {
    const normalized = normalizeHeader(header);
    return FIELD_ALIASES.clubType.some((alias) => alias === normalized);
  });
  return isNonShotClubType(normalizeHeader(row[clubTypeIndex] ?? ""));
}

function isNonShotClubType(clubType: string) {
  return ["average", "avg", "stddev", "standarddeviation", "clubtype"].includes(clubType);
}

function parseRawRow(
  row: string[],
  rowIndex: number,
  headers: string[],
  headerIndex: number,
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

  if (rowIndex === headerIndex || isHeaderRow(row)) {
    return {
      rowNumber,
      rowType: "header",
      cells: row,
      sourceRawJson: toCellRawJson(row),
    };
  }

  if (isShotDataRow(headers, row)) {
    return {
      rowNumber,
      rowType: "shot",
      cells: row,
      sourceRawJson: toRawRow(headers, row),
    };
  }

  if (isSummaryRow(headers, row)) {
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
  return nullableText(rows.flatMap((row) => row).find((cell) => /rapsodo mlm2pro/i.test(cell)) ?? null);
}

function parseExportedAtIso(title: string | null) {
  if (!title) {
    return null;
  }

  const match = title.match(
    /(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM))?/i,
  );

  if (!match) {
    return null;
  }

  const [, monthText, dayText, yearText, hourText, minuteText, meridiem] = match;
  const month = Number(monthText);
  const day = Number(dayText);
  const year = Number(yearText);
  let hour = hourText ? Number(hourText) : 12;
  const minute = minuteText ? Number(minuteText) : 0;

  if (meridiem?.toUpperCase() === "PM" && hour < 12) {
    hour += 12;
  }
  if (meridiem?.toUpperCase() === "AM" && hour === 12) {
    hour = 0;
  }

  const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute));

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
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

function detectApexUnit(headers: string[], fallbackDistanceUnit: DistanceUnit): "meters" | "yards" | "feet" {
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

    if (char !== "\"") {
      continue;
    }

    if (inQuotes && nextChar === "\"") {
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
