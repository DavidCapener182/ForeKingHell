export type CourseGapWindowInput = {
  longerClubType: string | null | undefined;
  shorterClubType: string | null | undefined;
  gapYd: number | null | undefined;
};

const MISSING_YARDAGE_WINDOW_GAP_YD = 18;
const MANAGEABLE_TOP_END_GAP_YD = 35;
const SCORING_CLUB_TYPES = new Set(["pw", "gw", "aw", "sw", "lw"]);

export function isMissingYardageWindowGap(input: CourseGapWindowInput) {
  return (
    isFiniteGap(input.gapYd) &&
    input.gapYd > MISSING_YARDAGE_WINDOW_GAP_YD &&
    !isManageableTopEndGap(input)
  );
}

export function isManageableTopEndGap(input: CourseGapWindowInput) {
  return (
    isFiniteGap(input.gapYd) &&
    input.gapYd <= MANAGEABLE_TOP_END_GAP_YD &&
    normalizeClubType(input.longerClubType) === "driver" &&
    isLongGameBridgeClubType(input.shorterClubType)
  );
}

export function isScoringEndGap(input: CourseGapWindowInput) {
  return isScoringClubType(input.longerClubType) || isScoringClubType(input.shorterClubType);
}

export function missingYardageWindowPriority(input: CourseGapWindowInput) {
  if (isScoringEndGap(input)) {
    return 3;
  }

  if (isIronClubType(input.longerClubType) || isIronClubType(input.shorterClubType)) {
    return 2;
  }

  return 1;
}

function isScoringClubType(value: string | null | undefined) {
  return SCORING_CLUB_TYPES.has(normalizeClubType(value));
}

function isLongGameBridgeClubType(value: string | null | undefined) {
  const normalized = normalizeClubType(value);

  return /^[1-9][wh]$/.test(normalized);
}

function isIronClubType(value: string | null | undefined) {
  return /^[1-9]i$/.test(normalizeClubType(value));
}

function normalizeClubType(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function isFiniteGap(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
