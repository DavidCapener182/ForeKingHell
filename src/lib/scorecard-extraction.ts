export type ExtractedScorecardHole = {
  holeNumber: number;
  par: number | null;
  yards: number | null;
  strokeIndex: number | null;
  score: number | null;
  netScore: number | null;
  fairwayHit: boolean | null;
  gir: boolean | null;
  putts: number | null;
};

export type ExtractedScorecard = {
  courseName: string | null;
  dateIso: string | null;
  teeName: string | null;
  totalYards: number | null;
  courseRating: number | null;
  slopeRating: number | null;
  totalScore: number | null;
  totalPutts: number | null;
  fairwaysHitTotal: number | null;
  girTotal: number | null;
  holes: ExtractedScorecardHole[];
};

export function normalizeExtractedScorecard(input: unknown): ExtractedScorecard {
  const source = asRecord(input);
  const holesSource = Array.isArray(source.holes) ? source.holes : [];
  const holes = holesSource
    .map((hole) => normalizeExtractedHole(hole))
    .filter((hole): hole is ExtractedScorecardHole => hole !== null)
    .sort((left, right) => left.holeNumber - right.holeNumber);

  return {
    courseName: nullableText(source.courseName),
    dateIso: normalizeDateIso(source.dateIso),
    teeName: nullableText(source.teeName),
    totalYards: nullableInteger(source.totalYards),
    courseRating: nullableNumber(source.courseRating),
    slopeRating: nullableInteger(source.slopeRating),
    totalScore: nullableInteger(source.totalScore),
    totalPutts: nullableInteger(source.totalPutts),
    fairwaysHitTotal: nullableInteger(source.fairwaysHitTotal),
    girTotal: nullableInteger(source.girTotal),
    holes,
  };
}

function normalizeExtractedHole(input: unknown): ExtractedScorecardHole | null {
  const source = asRecord(input);
  const holeNumber = nullableInteger(source.holeNumber);

  if (holeNumber === null || holeNumber < 1 || holeNumber > 18) {
    return null;
  }

  return {
    holeNumber,
    par: nullableInteger(source.par),
    yards: nullableInteger(source.yards),
    strokeIndex: nullableInteger(source.strokeIndex),
    score: nullableInteger(source.score),
    netScore: nullableInteger(source.netScore),
    fairwayHit: nullableBoolean(source.fairwayHit),
    gir: nullableBoolean(source.gir),
    putts: nullableInteger(source.putts),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function nullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nullableNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function nullableInteger(value: unknown) {
  const parsed = nullableNumber(value);

  if (parsed === null) {
    return null;
  }

  return Math.max(0, Math.floor(parsed));
}

function nullableBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["true", "yes", "hit", "check", "checked", "1"].includes(normalized)) {
      return true;
    }

    if (["false", "no", "miss", "x", "0"].includes(normalized)) {
      return false;
    }
  }

  return null;
}

function normalizeDateIso(value: unknown) {
  const text = nullableText(value);

  if (!text) {
    return null;
  }

  const slashDateMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashDateMatch) {
    const [, day, month, year] = slashDateMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(text);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}
