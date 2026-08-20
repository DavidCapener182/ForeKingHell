import { clubSortValue, formatClubType } from "@/lib/club-format";
import { isEstimatedClubData } from "@/lib/club-analytics";
import { calculateFaceToPathDeg, resolveClubFaceAngleDeg } from "@/lib/club-face-angle";
import { isMissingYardageWindowGap, isScoringEndGap } from "@/lib/gapping-windows";
import { isShotEvidenceEligible, type ShotReviewStatus } from "@/lib/shot-review";
import type { StockShotRoleSummary } from "@/lib/stock-yardage";

export type IntelligenceTone = "green" | "sky" | "amber" | "pink" | "slate";

export type BagIntelligenceShot = {
  id?: string | null;
  shotAt?: Date | string | null;
  clubType?: string | null;
  carryYd: number | null;
  totalYd: number | null;
  sideCarryYd: number | null;
  launchDirectionDeg?: number | null;
  clubPathDeg?: number | null;
  faceAngleDeg?: number | null;
  clubDataEstType?: string | null;
  shotCategory?: string | null;
  qualityTag?: string | null;
  reviewStatus?: ShotReviewStatus | null;
  sessionType?: string | null;
};

export type BagIntelligenceClub = {
  id: string;
  type: string;
  brandModel: string;
  shots: BagIntelligenceShot[];
  stock: {
    bestStockCarryYd: number | null;
    coursePlayCarryYd: number | null;
    latestReliableCarryYd: number | null;
    latestReliableCarryP25Yd: number | null;
    latestReliableCarryP75Yd: number | null;
    personalBestCarryYd: number | null;
    confidenceScore: number;
    sampleSize: number;
    dispersionLeftYd: number | null;
    dispersionRightYd: number | null;
    shotRoleSummaries: StockShotRoleSummary[];
  };
};

export type BagIntelligenceGappingRow = {
  id: string;
  clubType: string;
  gappingCarryYd: number | null;
  gapToNextYd: number | null;
  nextClubType: string | null;
  confidenceScore: number;
  sampleSize: number;
};

export type WedgeMatrixShotKey = "full" | "threeQuarter" | "half";

export type WedgeMatrixShot = {
  key: WedgeMatrixShotKey;
  label: string;
  carryYd: number | null;
  sampleSize: number;
  status: "trusted" | "measured" | "target" | "building";
  detail: string;
  tone: IntelligenceTone;
};

export type WedgeMatrixClub = {
  id: string;
  clubType: string;
  label: string;
  brandModel: string;
  isSuggested: boolean;
  matrixScore: number;
  fullCarryYd: number | null;
  rows: WedgeMatrixShot[];
};

export type SmartBagSuggestion = {
  id: string;
  title: string;
  detail: string;
  scoreAfter: number;
  scoreLift: number;
  tone: IntelligenceTone;
};

export type SmartBagBuilder = {
  currentScore: number;
  scoreLabel: string;
  suggestions: SmartBagSuggestion[];
};

export type PathTrendPoint = {
  monthKey: string;
  label: string;
  pathDeg: number | null;
  faceDeg: number | null;
  faceToPathProxyDeg: number | null;
  patternCode: string;
  patternLabel: string;
  patternDetail: string;
  sampleSize: number;
};

export type PathTrendClubSummary = {
  clubId: string;
  clubType: string;
  label: string;
  sampleSize: number;
  pathDeg: number | null;
  faceDeg: number | null;
  faceToPathProxyDeg: number | null;
  patternCode: string;
  patternLabel: string;
};

export type PathTrendShot = {
  key: string;
  label: string;
  shotAtLabel: string;
  pathDeg: number | null;
  faceDeg: number | null;
  faceToPathProxyDeg: number | null;
  patternCode: string;
  patternLabel: string;
  patternDetail: string;
};

export type PathTrendTracking = {
  clubId: string | null;
  clubType: string;
  label: string;
  status: "neutralising" | "stable" | "widening" | "building";
  detail: string;
  points: PathTrendPoint[];
  clubs: PathTrendClubSummary[];
  recentShots: PathTrendShot[];
};

export type ShotPatternOverlaySummary = {
  clubId: string;
  clubType: string;
  label: string;
  sampleSize: number;
  carryP10Yd: number | null;
  carryP50Yd: number | null;
  carryP90Yd: number | null;
  sideP10Yd: number | null;
  sideP90Yd: number | null;
  playableRate: number | null;
  primaryMiss: "Left" | "Right" | "Balanced";
  tone: IntelligenceTone;
};

export type ConfidenceHeatBand = {
  label: string;
  rangeLabel: string;
  detail: string;
  tone: IntelligenceTone;
};

export type ConfidenceHeatMap = {
  clubId: string;
  clubType: string;
  label: string;
  confidenceScore: number;
  sampleSize: number;
  bands: ConfidenceHeatBand[];
};

export type CourseStrategyScenario = {
  key: string;
  label: string;
  targetYd: number;
  recommendation: string;
  detail: string;
  clubId?: string;
  tone: IntelligenceTone;
};

export type CourseStrategyMode = {
  scenarios: CourseStrategyScenario[];
};

export type PersonalStrokesGainedEvent = {
  category: string;
  startLie: string;
  endLie?: string | null;
  startDistanceYd?: number | null;
  strokesGained: number | null;
};

export type PersonalStrokesGainedCategory = {
  category: string;
  label: string;
  sampleSize: number;
  pendingCount: number;
  total: number | null;
  average: number | null;
  tone: IntelligenceTone;
};

export type PersonalStrokesGainedModel = {
  status: "live" | "building";
  sampleSize: number;
  pendingCount: number;
  total: number | null;
  average: number | null;
  strongestCategory: PersonalStrokesGainedCategory | null;
  weakestCategory: PersonalStrokesGainedCategory | null;
  categories: PersonalStrokesGainedCategory[];
};

export type AiCaddieCard = {
  id: string;
  title: string;
  value: string;
  detail: string;
  tone: IntelligenceTone;
};

const WEDGE_TYPES = new Set(["pw", "gw", "aw", "sw", "lw"]);
const WEDGE_TARGET_FACTORS: Record<Exclude<WedgeMatrixShotKey, "full">, number> = {
  threeQuarter: 0.85,
  half: 0.7,
};

export function buildWedgeMatrix(clubs: BagIntelligenceClub[]): WedgeMatrixClub[] {
  const wedges = clubs
    .filter((club) => WEDGE_TYPES.has(normalizeClubType(club.type)))
    .sort((left, right) => clubSortValue(left.type) - clubSortValue(right.type));
  const rows = wedges.map((club) => buildWedgeMatrixClub(club, false));
  const suggestedGapWedge = buildSuggestedGapWedge(wedges);

  return suggestedGapWedge
    ? [...rows, suggestedGapWedge].sort(
        (left, right) => clubSortValue(left.clubType) - clubSortValue(right.clubType),
      )
    : rows;
}

export function buildSmartBagBuilder({
  clubs,
  gappingRows,
  wedgeMatrix,
}: {
  clubs: BagIntelligenceClub[];
  gappingRows: BagIntelligenceGappingRow[];
  wedgeMatrix: WedgeMatrixClub[];
}): SmartBagBuilder {
  const currentScore = calculateBagReadinessScore(clubs, gappingRows);
  const suggestions: SmartBagSuggestion[] = [];
  const suggestedGapWedge = wedgeMatrix.find((club) => club.isSuggested);
  const topGap = [...gappingRows]
    .filter((row) => isMissingYardageWindowGap(gapWindowInput(row)))
    .sort((left, right) => (right.gapToNextYd ?? 0) - (left.gapToNextYd ?? 0))[0];
  const weakClub = [...gappingRows]
    .filter((row) => row.sampleSize > 0 && (row.confidenceScore < 60 || row.sampleSize < 12))
    .sort((left, right) => left.confidenceScore - right.confidenceScore)[0];

  if (suggestedGapWedge) {
    suggestions.push({
      id: "add-gap-wedge",
      title: "Add 48 deg GW",
      detail: "Fills the PW-to-SW scoring window before it costs approach shots.",
      scoreLift: 7,
      scoreAfter: clamp(currentScore + 7, 0, 100),
      tone: "green",
    });
  }

  const hasSevenWood = clubs.some((club) => normalizeClubType(club.type) === "7w");
  const topEndGap = gappingRows.find(
    (row) =>
      normalizeClubType(row.clubType) === "driver" &&
      row.gapToNextYd !== null &&
      row.gapToNextYd > 28,
  );

  if (!hasSevenWood && topEndGap) {
    suggestions.push({
      id: "add-seven-wood",
      title: "Test 7W",
      detail: "Adds a higher-launch bridge when driver leaves too much to the next club.",
      scoreLift: 5,
      scoreAfter: clamp(currentScore + 5, 0, 100),
      tone: "sky",
    });
  }

  if (!suggestedGapWedge && topGap) {
    suggestions.push({
      id: `build-${topGap.id}`,
      title: `Build ${formatClubType(topGap.clubType)} gap shot`,
      detail: `${formatClubType(topGap.clubType)} leaves ${formatYards(topGap.gapToNextYd)} to the next course number.`,
      scoreLift: isScoringEndGap(gapWindowInput(topGap)) ? 6 : 4,
      scoreAfter: clamp(currentScore + (isScoringEndGap(gapWindowInput(topGap)) ? 6 : 4), 0, 100),
      tone: isScoringEndGap(gapWindowInput(topGap)) ? "amber" : "sky",
    });
  }

  if (weakClub) {
    suggestions.push({
      id: `retest-${weakClub.id}`,
      title: `Retest ${formatClubType(weakClub.clubType)}`,
      detail: `${weakClub.sampleSize} clean shots and ${weakClub.confidenceScore}% trust is holding the bag score down.`,
      scoreLift: 3,
      scoreAfter: clamp(currentScore + 3, 0, 100),
      tone: "amber",
    });
  }

  return {
    currentScore,
    scoreLabel:
      currentScore >= 85 ? "Pressure-ready" : currentScore >= 70 ? "Playable" : "Needs work",
    suggestions: suggestions
      .sort((left, right) => right.scoreLift - left.scoreLift || right.scoreAfter - left.scoreAfter)
      .slice(0, 3),
  };
}

export function calculateBagReadinessScore(
  clubs: BagIntelligenceClub[],
  gappingRows: BagIntelligenceGappingRow[],
) {
  const playableClubs = clubs.filter((club) => club.stock.sampleSize > 0);
  const averageConfidence =
    playableClubs.length === 0
      ? 0
      : (average(playableClubs.map((club) => club.stock.confidenceScore)) ?? 0);
  const gapPenalty = gappingRows.reduce((total, row) => {
    if (!isMissingYardageWindowGap(gapWindowInput(row))) {
      return total;
    }

    const gap = row.gapToNextYd ?? 0;
    return total + Math.min(isScoringEndGap(gapWindowInput(row)) ? 12 : 8, (gap - 18) / 2);
  }, 0);

  return clamp(Math.round(averageConfidence - gapPenalty), 0, 100);
}

export function buildPathTrendTracking(clubs: BagIntelligenceClub[]): PathTrendTracking {
  const clubSummaries = clubs
    .map((item) => buildPathClubSummary(item))
    .filter((item): item is PathTrendClubSummary => Boolean(item))
    .sort((left, right) => clubSortValue(left.clubType) - clubSortValue(right.clubType));
  const club =
    clubs.find((item) => normalizeClubType(item.type) === "driver" && countPathShots(item) >= 3) ??
    [...clubs].sort((left, right) => countPathShots(right) - countPathShots(left))[0] ??
    null;

  if (!club || countPathShots(club) === 0) {
    return {
      clubId: null,
      clubType: "driver",
      label: "Driver",
      status: "building",
      detail: "Import club-path rows to start path trend tracking.",
      points: [],
      clubs: clubSummaries,
      recentShots: [],
    };
  }

  const grouped = new Map<string, BagIntelligenceShot[]>();

  for (const shot of pathShotsForClub(club)) {
    const key = monthKey(shot.shotAt);
    grouped.set(key, [...(grouped.get(key) ?? []), shot]);
  }

  const points = [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-6)
    .map(([key, shotsForMonth]) => {
      const pathDeg = roundOne(
        average(shotsForMonth.map((shot) => shot.clubPathDeg).filter(isNumber)),
      );
      const faceDeg = roundOne(
        average(shotsForMonth.map((shot) => resolveClubFaceAngleDeg(shot)).filter(isNumber)),
      );
      const faceToPathProxyDeg = roundOne(
        average(shotsForMonth.map((shot) => calculateFaceToPathDeg(shot)).filter(isNumber)),
      );
      const pattern = classifyFacePathPattern(pathDeg, faceToPathProxyDeg);

      return {
        monthKey: key,
        label: monthLabel(key),
        pathDeg,
        faceDeg,
        faceToPathProxyDeg,
        patternCode: pattern.code,
        patternLabel: pattern.label,
        patternDetail: pattern.detail,
        sampleSize: shotsForMonth.length,
      };
    });

  const first = points.find((point) => isNumber(point.pathDeg));
  const latest = [...points].reverse().find((point) => isNumber(point.pathDeg));
  const firstAbs = Math.abs(first?.pathDeg ?? 0);
  const latestAbs = Math.abs(latest?.pathDeg ?? 0);
  const status =
    points.length < 2 || !first || !latest
      ? "building"
      : latestAbs + 1 < firstAbs
        ? "neutralising"
        : latestAbs > firstAbs + 1
          ? "widening"
          : "stable";

  return {
    clubId: club.id,
    clubType: club.type,
    label: formatClubType(club.type),
    status,
    detail: pathTrendDetail(status, first?.pathDeg ?? null, latest?.pathDeg ?? null),
    points,
    clubs: clubSummaries,
    recentShots: pathShotsForClub(club)
      .sort((left, right) => shotTime(right.shotAt) - shotTime(left.shotAt))
      .slice(0, 6)
      .map((shot, index) => buildPathTrendShot(shot, index)),
  };
}

export function buildShotPatternOverlaySummaries(
  clubs: BagIntelligenceClub[],
): ShotPatternOverlaySummary[] {
  return clubs
    .map((club): ShotPatternOverlaySummary | null => {
      const shotsForClub = usableShots(club.shots).filter(
        (shot): shot is BagIntelligenceShot & { carryYd: number; sideCarryYd: number } =>
          isNumber(shot.carryYd) && isNumber(shot.sideCarryYd),
      );

      if (shotsForClub.length < 5) {
        return null;
      }

      const carryValues = shotsForClub.map((shot) => shot.carryYd);
      const sideValues = shotsForClub.map((shot) => shot.sideCarryYd);
      const playableLimit = playableMissLimit(club.type);
      const playableRate = Math.round(
        (shotsForClub.filter((shot) => Math.abs(shot.sideCarryYd) <= playableLimit).length /
          shotsForClub.length) *
          100,
      );
      const sideP10Yd = roundOne(percentile(sideValues, 0.1));
      const sideP90Yd = roundOne(percentile(sideValues, 0.9));

      return {
        clubId: club.id,
        clubType: club.type,
        label: formatClubType(club.type),
        sampleSize: shotsForClub.length,
        carryP10Yd: roundOne(percentile(carryValues, 0.1)),
        carryP50Yd: roundOne(percentile(carryValues, 0.5)),
        carryP90Yd: roundOne(percentile(carryValues, 0.9)),
        sideP10Yd,
        sideP90Yd,
        playableRate,
        primaryMiss: primaryMiss(sideP10Yd, sideP90Yd),
        tone: playableRate >= 70 ? "green" : playableRate >= 55 ? "sky" : "amber",
      } satisfies ShotPatternOverlaySummary;
    })
    .filter((summary): summary is ShotPatternOverlaySummary => summary !== null)
    .sort((left, right) => right.sampleSize - left.sampleSize)
    .slice(0, 4);
}

export function buildConfidenceHeatMaps(clubs: BagIntelligenceClub[]): ConfidenceHeatMap[] {
  return clubs
    .map((club): ConfidenceHeatMap | null => {
      const shotsForClub = usableShots(club.shots).filter(
        (shot): shot is BagIntelligenceShot & { carryYd: number } => isNumber(shot.carryYd),
      );
      const playNumber = club.stock.coursePlayCarryYd ?? club.stock.bestStockCarryYd;

      if (shotsForClub.length < 4 || playNumber === null) {
        return null;
      }

      const carryValues = shotsForClub.map((shot) => shot.carryYd);
      const safeLow = roundToNearestYard(
        club.stock.latestReliableCarryP25Yd ?? percentile(carryValues, 0.25) ?? playNumber - 8,
      );
      const safeHigh = roundToNearestYard(
        club.stock.coursePlayCarryYd ??
          club.stock.latestReliableCarryYd ??
          percentile(carryValues, 0.55) ??
          playNumber,
      );
      const amberHigh = Math.max(
        safeHigh + 1,
        roundToNearestYard(percentile(carryValues, 0.85) ?? playNumber + 8),
      );
      const personalBest = club.stock.personalBestCarryYd ?? Math.max(...carryValues);

      return {
        clubId: club.id,
        clubType: club.type,
        label: formatClubType(club.type),
        confidenceScore: club.stock.confidenceScore,
        sampleSize: shotsForClub.length,
        bands: [
          {
            label: "Green",
            rangeLabel: `${safeLow}-${safeHigh}`,
            detail: "Use this as the scoring window.",
            tone: "green",
          },
          {
            label: "Amber",
            rangeLabel: `${safeHigh + 1}-${amberHigh}`,
            detail: "Only use with room past the flag.",
            tone: "amber",
          },
          {
            label: "Red",
            rangeLabel: `${amberHigh + 1}+`,
            detail: `${formatYards(personalBest)} exists, but it is not the course number.`,
            tone: "pink",
          },
        ],
      } satisfies ConfidenceHeatMap;
    })
    .filter((heatMap): heatMap is ConfidenceHeatMap => heatMap !== null)
    .sort((left, right) => right.confidenceScore - left.confidenceScore)
    .slice(0, 8);
}

export function buildCourseStrategyMode({
  clubs,
  wedgeMatrix,
}: {
  clubs: BagIntelligenceClub[];
  wedgeMatrix: WedgeMatrixClub[];
}): CourseStrategyMode {
  const scenarios: CourseStrategyScenario[] = [
    buildTargetScenario("approach-150", "150 yd approach", 150, clubs, {
      excludeDriver: true,
      family: "iron",
    }),
    buildTargetScenario("tee-180", "180 yd tee or layup", 180, clubs, {
      excludeDriver: true,
      preferPosition: true,
    }),
    buildTargetScenario("long-200", "200 yd out", 200, clubs, {
      excludeDriver: true,
    }),
    buildWedgeScenario(wedgeMatrix, 85),
  ];

  return { scenarios };
}

export function buildPersonalStrokesGainedModel(
  events: PersonalStrokesGainedEvent[],
): PersonalStrokesGainedModel {
  const finiteValues = events.map((event) => event.strokesGained).filter(isNumber);
  const pendingCount = events.length - finiteValues.length;
  const categories = ["tee", "approach", "short_game", "putting"]
    .map((category) => {
      const categoryEvents = events.filter((event) => event.category === category);
      const categoryValues = categoryEvents.map((event) => event.strokesGained).filter(isNumber);
      const total = categoryValues.length > 0 ? roundOne(sum(categoryValues)) : null;

      return {
        category,
        label: categoryLabel(category),
        sampleSize: categoryValues.length,
        pendingCount: categoryEvents.length - categoryValues.length,
        total,
        average:
          categoryValues.length > 0 && total !== null
            ? roundOne(total / categoryValues.length)
            : null,
        tone: total === null ? "slate" : total >= 0 ? "green" : total <= -1 ? "pink" : "amber",
      } satisfies PersonalStrokesGainedCategory;
    })
    .filter((category) => category.sampleSize > 0 || category.pendingCount > 0);
  const judgedCategories = categories.filter((category) => category.total !== null);

  return {
    status: finiteValues.length > 0 ? "live" : "building",
    sampleSize: finiteValues.length,
    pendingCount,
    total: finiteValues.length > 0 ? roundOne(sum(finiteValues)) : null,
    average: finiteValues.length > 0 ? roundOne(sum(finiteValues) / finiteValues.length) : null,
    strongestCategory:
      [...judgedCategories].sort((left, right) => (right.total ?? 0) - (left.total ?? 0))[0] ??
      null,
    weakestCategory:
      [...judgedCategories].sort((left, right) => (left.total ?? 0) - (right.total ?? 0))[0] ??
      null,
    categories,
  };
}

export function buildAiCaddieCards({
  strategy,
  smartBag,
  heatMaps,
  pathTrend,
  personalStrokesGained,
}: {
  strategy: CourseStrategyMode;
  smartBag: SmartBagBuilder;
  heatMaps: ConfidenceHeatMap[];
  pathTrend: PathTrendTracking;
  personalStrokesGained: PersonalStrokesGainedModel;
}): AiCaddieCard[] {
  const firstStrategy =
    strategy.scenarios.find((scenario) => scenario.clubId) ?? strategy.scenarios[0];
  const pressureClub = heatMaps[0] ?? null;
  const bagSuggestion = smartBag.suggestions[0] ?? null;
  const sgLeak = personalStrokesGained.weakestCategory;

  return [
    {
      id: "next-shot",
      title: "Next shot",
      value: firstStrategy?.recommendation ?? "Build a trusted number",
      detail: firstStrategy?.detail ?? "Import more stock shots before trusting a pressure call.",
      tone: firstStrategy?.tone ?? "slate",
    },
    {
      id: "pressure-window",
      title: "Pressure window",
      value: pressureClub
        ? `${pressureClub.label} ${pressureClub.bands[0].rangeLabel}`
        : "Building",
      detail: pressureClub
        ? `${pressureClub.confidenceScore}% confidence. Stay out of the red band unless the miss is harmless.`
        : "Confidence heat maps need at least four usable carries.",
      tone: pressureClub?.bands[0].tone ?? "slate",
    },
    {
      id: "bag-build",
      title: "Bag build",
      value: bagSuggestion
        ? `${bagSuggestion.scoreAfter}% after ${bagSuggestion.title}`
        : `${smartBag.currentScore}% current`,
      detail: bagSuggestion?.detail ?? "No urgent purchase gap from the current bag map.",
      tone: bagSuggestion?.tone ?? "green",
    },
    {
      id: "scoring-leak",
      title: "Scoring leak",
      value: sgLeak ? sgLeak.label : pathTrend.label,
      detail: sgLeak
        ? `${formatSigned(sgLeak.total)} strokes total from ${sgLeak.sampleSize} judged shots.`
        : pathTrend.detail,
      tone: sgLeak?.tone ?? pathTrendTone(pathTrend.status),
    },
  ];
}

function buildWedgeMatrixClub(club: BagIntelligenceClub, isSuggested: boolean): WedgeMatrixClub {
  const fullCarryYd =
    club.stock.coursePlayCarryYd ??
    roleSummaryFor(club.stock.shotRoleSummaries, "full")?.carryMedianYd ??
    club.stock.bestStockCarryYd;
  const rows = [
    buildFullWedgeRow(club, fullCarryYd),
    buildPartialWedgeRow(club, "threeQuarter", fullCarryYd),
    buildPartialWedgeRow(club, "half", fullCarryYd),
  ];

  return {
    id: club.id,
    clubType: club.type,
    label: formatClubType(club.type),
    brandModel: club.brandModel,
    isSuggested,
    matrixScore: Math.round(
      average(
        rows.map((row) =>
          row.status === "trusted" || row.status === "measured"
            ? 100
            : row.status === "target"
              ? 45
              : 0,
        ),
      ) ?? 0,
    ),
    fullCarryYd,
    rows,
  };
}

function buildFullWedgeRow(club: BagIntelligenceClub, fullCarryYd: number | null): WedgeMatrixShot {
  const fullSummary = roleSummaryFor(club.stock.shotRoleSummaries, "full");
  const sampleSize = fullSummary?.sampleSize ?? club.stock.sampleSize;

  if (fullCarryYd === null) {
    return {
      key: "full",
      label: "Full",
      carryYd: null,
      sampleSize,
      status: "building",
      detail: "Needs full-swing carries.",
      tone: "slate",
    };
  }

  return {
    key: "full",
    label: "Full",
    carryYd: roundOne(fullCarryYd),
    sampleSize,
    status: club.stock.confidenceScore >= 70 && sampleSize >= 8 ? "trusted" : "measured",
    detail: sampleSize >= 8 ? "Measured full-shot anchor." : "Measured, needs more proof.",
    tone: club.stock.confidenceScore >= 70 && sampleSize >= 8 ? "green" : "sky",
  };
}

function buildPartialWedgeRow(
  club: BagIntelligenceClub,
  key: Exclude<WedgeMatrixShotKey, "full">,
  fullCarryYd: number | null,
): WedgeMatrixShot {
  const label = key === "threeQuarter" ? "3/4" : "Half";
  const measuredValues = partialWedgeCarryValues(club, key, fullCarryYd);

  if (measuredValues.length >= 3) {
    return {
      key,
      label,
      carryYd: roundOne(median(measuredValues)),
      sampleSize: measuredValues.length,
      status: "measured",
      detail: "Measured partial-shot window.",
      tone: "green",
    };
  }

  if (fullCarryYd !== null) {
    return {
      key,
      label,
      carryYd: Math.round(fullCarryYd * WEDGE_TARGET_FACTORS[key]),
      sampleSize: measuredValues.length,
      status: "target",
      detail: measuredValues.length > 0 ? "Early partial data." : "Calibration target.",
      tone: measuredValues.length > 0 ? "sky" : "amber",
    };
  }

  return {
    key,
    label,
    carryYd: null,
    sampleSize: measuredValues.length,
    status: "building",
    detail: "Needs wedge ladder shots.",
    tone: "slate",
  };
}

function partialWedgeCarryValues(
  club: BagIntelligenceClub,
  key: Exclude<WedgeMatrixShotKey, "full">,
  fullCarryYd: number | null,
) {
  const categoryMatches =
    key === "threeQuarter"
      ? new Set(["three-quarter", "three quarter", "threequarter", "3/4"])
      : new Set(["half", "1/2"]);

  return usableShots(club.shots)
    .filter((shot): shot is BagIntelligenceShot & { carryYd: number } => isNumber(shot.carryYd))
    .filter((shot) => {
      const category = normalizeShotCategory(shot.shotCategory);

      if (categoryMatches.has(category)) {
        return true;
      }

      if (category === "pitch" && fullCarryYd !== null) {
        if (key === "threeQuarter") {
          return shot.carryYd > fullCarryYd * 0.74 && shot.carryYd <= fullCarryYd * 0.92;
        }

        return (
          shot.carryYd >= Math.max(30, fullCarryYd * 0.45) && shot.carryYd <= fullCarryYd * 0.74
        );
      }

      if (key === "half" && category === "chip") {
        return fullCarryYd !== null && shot.carryYd >= Math.max(30, fullCarryYd * 0.45);
      }

      return false;
    })
    .map((shot) => shot.carryYd);
}

function buildSuggestedGapWedge(wedges: BagIntelligenceClub[]): WedgeMatrixClub | null {
  const hasGapWedge = wedges.some((club) => ["gw", "aw"].includes(normalizeClubType(club.type)));
  const pw = wedges.find((club) => normalizeClubType(club.type) === "pw");
  const sw = wedges.find((club) => normalizeClubType(club.type) === "sw");
  const pwFull = pw ? fullWedgeCarry(pw) : null;
  const swFull = sw ? fullWedgeCarry(sw) : null;

  if (hasGapWedge || pwFull === null || swFull === null || pwFull - swFull <= 18) {
    return null;
  }

  const fullCarryYd = Math.round((pwFull + swFull) / 2);
  const club: BagIntelligenceClub = {
    id: "suggested-gap-wedge",
    type: "gw",
    brandModel: "Suggested 48 deg gap wedge",
    shots: [],
    stock: {
      bestStockCarryYd: fullCarryYd,
      coursePlayCarryYd: fullCarryYd,
      latestReliableCarryYd: null,
      latestReliableCarryP25Yd: null,
      latestReliableCarryP75Yd: null,
      personalBestCarryYd: null,
      confidenceScore: 0,
      sampleSize: 0,
      dispersionLeftYd: null,
      dispersionRightYd: null,
      shotRoleSummaries: [],
    },
  };

  return {
    ...buildWedgeMatrixClub(club, true),
    rows: [
      {
        key: "full",
        label: "Full",
        carryYd: fullCarryYd,
        sampleSize: 0,
        status: "target",
        detail: "Gap-fill target.",
        tone: "amber",
      },
      {
        key: "threeQuarter",
        label: "3/4",
        carryYd: Math.round(fullCarryYd * WEDGE_TARGET_FACTORS.threeQuarter),
        sampleSize: 0,
        status: "target",
        detail: "Calibration target.",
        tone: "amber",
      },
      {
        key: "half",
        label: "Half",
        carryYd: Math.round(fullCarryYd * WEDGE_TARGET_FACTORS.half),
        sampleSize: 0,
        status: "target",
        detail: "Calibration target.",
        tone: "amber",
      },
    ],
  };
}

function fullWedgeCarry(club: BagIntelligenceClub) {
  return (
    club.stock.coursePlayCarryYd ??
    roleSummaryFor(club.stock.shotRoleSummaries, "full")?.carryMedianYd ??
    club.stock.bestStockCarryYd
  );
}

function roleSummaryFor(summaries: StockShotRoleSummary[], role: StockShotRoleSummary["role"]) {
  return summaries.find((summary) => summary.role === role) ?? null;
}

function buildTargetScenario(
  key: string,
  label: string,
  targetYd: number,
  clubs: BagIntelligenceClub[],
  options: { excludeDriver?: boolean; preferPosition?: boolean; family?: "iron" } = {},
): CourseStrategyScenario {
  const candidates = clubs
    .filter((club) => {
      if (options.excludeDriver && normalizeClubType(club.type) === "driver") {
        return false;
      }

      if (options.family === "iron" && !/^[1-9]i$/.test(normalizeClubType(club.type))) {
        return false;
      }

      return playNumber(club) !== null && club.stock.sampleSize >= 4;
    })
    .map((club) => {
      const yardage = playNumber(club)!;
      const distancePenalty = Math.abs(yardage - targetYd);
      const confidencePenalty = Math.max(0, 75 - club.stock.confidenceScore) / 5;
      const positionBonus = options.preferPosition && isPositionClub(club.type) ? -4 : 0;

      return {
        club,
        yardage,
        score: distancePenalty + confidencePenalty + missPenalty(club) + positionBonus,
      };
    })
    .sort((left, right) => left.score - right.score || right.yardage - left.yardage);
  const best = candidates[0];

  if (!best) {
    return {
      key,
      label,
      targetYd,
      recommendation: "Build a trusted number",
      detail: "No club has enough measured course data for this target yet.",
      tone: "slate",
    };
  }

  const miss = missLabel(best.club);
  const gap = Math.round(best.yardage - targetYd);

  return {
    key,
    label,
    targetYd,
    recommendation: `${formatClubType(best.club.type)} ${formatYards(best.yardage)}`,
    detail: `${gap === 0 ? "Dead on" : gap > 0 ? `${gap} yd long` : `${Math.abs(gap)} yd short`} from target. ${miss}.`,
    clubId: best.club.id,
    tone: best.club.stock.confidenceScore >= 75 && Math.abs(gap) <= 8 ? "green" : "sky",
  };
}

function buildWedgeScenario(
  wedgeMatrix: WedgeMatrixClub[],
  targetYd: number,
): CourseStrategyScenario {
  const candidates = wedgeMatrix.flatMap((club) =>
    club.rows
      .filter((row) => row.carryYd !== null)
      .map((row) => ({
        club,
        row,
        gap: Math.abs((row.carryYd ?? 0) - targetYd),
      })),
  );
  const best = candidates.sort(
    (left, right) =>
      left.gap - right.gap ||
      statusRank(right.row.status) - statusRank(left.row.status) ||
      left.club.label.localeCompare(right.club.label),
  )[0];

  if (!best) {
    return {
      key: "inside-100",
      label: "Inside 100 yd",
      targetYd,
      recommendation: "Build wedge matrix",
      detail: "No wedge carries are ready for scoring calls yet.",
      tone: "slate",
    };
  }

  return {
    key: "inside-100",
    label: "Inside 100 yd",
    targetYd,
    recommendation: `${best.club.label} ${best.row.label} ${formatYards(best.row.carryYd)}`,
    detail:
      best.row.status === "target"
        ? "Use as a calibration target until measured partials exist."
        : `${best.row.sampleSize} measured shots in this wedge window.`,
    clubId: best.club.isSuggested ? undefined : best.club.id,
    tone: best.row.tone,
  };
}

function playNumber(club: BagIntelligenceClub) {
  return club.stock.coursePlayCarryYd ?? club.stock.bestStockCarryYd;
}

function missPenalty(club: BagIntelligenceClub) {
  const left = club.stock.dispersionLeftYd ?? 0;
  const right = club.stock.dispersionRightYd ?? 0;

  return Math.max(left, right) / 12;
}

function missLabel(club: BagIntelligenceClub) {
  const left = club.stock.dispersionLeftYd ?? 0;
  const right = club.stock.dispersionRightYd ?? 0;

  if (left < 5 && right < 5) {
    return "Miss pattern still building";
  }

  if (left > right + 5) {
    return `Main miss left ${formatYards(left)}`;
  }

  if (right > left + 5) {
    return `Main miss right ${formatYards(right)}`;
  }

  return `Balanced miss window ${formatYards(Math.max(left, right))}`;
}

function isPositionClub(clubType: string) {
  const normalized = normalizeClubType(clubType);

  return /^[1-9][wh]$/.test(normalized) || /^[1-6]i$/.test(normalized);
}

function countPathShots(club: BagIntelligenceClub) {
  return pathShotsForClub(club).length;
}

function pathShotsForClub(club: BagIntelligenceClub) {
  return usableShots(club.shots).filter(
    (shot) => isNumber(shot.clubPathDeg) && !isEstimatedClubData(shot.clubDataEstType),
  );
}

function buildPathClubSummary(club: BagIntelligenceClub): PathTrendClubSummary | null {
  const shots = pathShotsForClub(club);

  if (shots.length === 0) {
    return null;
  }

  const pathDeg = roundOne(average(shots.map((shot) => shot.clubPathDeg).filter(isNumber)));
  const faceDeg = roundOne(
    average(shots.map((shot) => resolveClubFaceAngleDeg(shot)).filter(isNumber)),
  );
  const faceToPathProxyDeg = roundOne(
    average(shots.map((shot) => calculateFaceToPathDeg(shot)).filter(isNumber)),
  );
  const pattern = classifyFacePathPattern(pathDeg, faceToPathProxyDeg);

  return {
    clubId: club.id,
    clubType: club.type,
    label: formatClubType(club.type),
    sampleSize: shots.length,
    pathDeg,
    faceDeg,
    faceToPathProxyDeg,
    patternCode: pattern.code,
    patternLabel: pattern.label,
  };
}

function buildPathTrendShot(shot: BagIntelligenceShot, index: number): PathTrendShot {
  const pathDeg = roundOne(shot.clubPathDeg);
  const faceDeg = roundOne(resolveClubFaceAngleDeg(shot));
  const faceToPathProxyDeg = roundOne(calculateFaceToPathDeg(shot));
  const pattern = classifyFacePathPattern(pathDeg, faceToPathProxyDeg);

  return {
    key: shot.id ?? `${shot.shotAt ?? "shot"}-${index}`,
    label: `Shot ${index + 1}`,
    shotAtLabel: shotDateLabel(shot.shotAt),
    pathDeg,
    faceDeg,
    faceToPathProxyDeg,
    patternCode: pattern.code,
    patternLabel: pattern.label,
    patternDetail: pattern.detail,
  };
}

function usableShots(shots: BagIntelligenceShot[]) {
  return shots.filter(isShotEvidenceEligible);
}

function gapWindowInput(row: BagIntelligenceGappingRow) {
  return {
    longerClubType: row.clubType,
    shorterClubType: row.nextClubType,
    gapYd: row.gapToNextYd,
  };
}

function primaryMiss(sideP10Yd: number | null, sideP90Yd: number | null) {
  const left = Math.abs(Math.min(0, sideP10Yd ?? 0));
  const right = Math.max(0, sideP90Yd ?? 0);

  if (left > right + 6) {
    return "Left";
  }

  if (right > left + 6) {
    return "Right";
  }

  return "Balanced";
}

function playableMissLimit(clubType: string) {
  const normalized = normalizeClubType(clubType);

  if (normalized === "driver") {
    return 45;
  }

  if (/^[1-9][wh]$/.test(normalized)) {
    return 36;
  }

  if (/^[1-9]i$/.test(normalized)) {
    return 26;
  }

  return 18;
}

function statusRank(status: WedgeMatrixShot["status"]) {
  if (status === "trusted") {
    return 4;
  }

  if (status === "measured") {
    return 3;
  }

  if (status === "target") {
    return 2;
  }

  return 1;
}

function pathTrendDetail(
  status: PathTrendTracking["status"],
  firstPathDeg: number | null,
  latestPathDeg: number | null,
) {
  if (status === "building") {
    return "Need two measured months before trend judgement.";
  }

  const movement =
    firstPathDeg === null || latestPathDeg === null
      ? "Path trend is measured."
      : `${formatSigned(firstPathDeg)} to ${formatSigned(latestPathDeg)} path.`;

  if (status === "neutralising") {
    return `${movement} Delivery is moving closer to neutral.`;
  }

  if (status === "widening") {
    return `${movement} Keep this out of swing-tip territory and verify the next session.`;
  }

  return `${movement} Delivery is holding steady.`;
}

function classifyFacePathPattern(pathDeg: number | null, faceToPathDeg: number | null) {
  if (!isNumber(pathDeg)) {
    return {
      code: "-",
      label: "Path building",
      detail: "Needs club-path rows before face-to-path can be pictured.",
    };
  }

  const pathSide = pathDeg <= -2 ? "pull" : pathDeg >= 2 ? "push" : "straight";

  if (!isNumber(faceToPathDeg)) {
    const pathLabel =
      pathSide === "pull" ? "Pull path" : pathSide === "push" ? "Push path" : "Straight path";

    return {
      code: pathSide === "pull" ? "B" : pathSide === "push" ? "H" : "E",
      label: pathLabel,
      detail: "Path measured; add launch direction or face angle to split draw/fade.",
    };
  }

  const faceSide = faceToPathDeg <= -1.5 ? "closed" : faceToPathDeg >= 1.5 ? "open" : "square";
  const curveSeverity = Math.abs(faceToPathDeg) >= 3.5 ? "large" : "small";
  const pathLabel = pathSide === "pull" ? "pull" : pathSide === "push" ? "push" : "straight";
  const faceLabel =
    faceSide === "closed"
      ? "face closed to path"
      : faceSide === "open"
        ? "face open to path"
        : "face matching path";

  if (pathSide === "straight" && faceSide === "square") {
    return {
      code: "E",
      label: "Straight",
      detail: `Straight path with ${faceLabel}.`,
    };
  }

  if (pathSide === "straight" && faceSide === "open") {
    return {
      code: "F",
      label: curveSeverity === "large" ? "Straight slice" : "Straight fade",
      detail: `Straight path with ${faceLabel}.`,
    };
  }

  if (pathSide === "straight" && faceSide === "closed") {
    return {
      code: "D",
      label: curveSeverity === "large" ? "Straight hook" : "Straight draw",
      detail: `Straight path with ${faceLabel}.`,
    };
  }

  if (pathSide === "push" && faceSide === "square") {
    return {
      code: "H",
      label: "Push",
      detail: `Push path with ${faceLabel}.`,
    };
  }

  if (pathSide === "push" && faceSide === "open") {
    return {
      code: "I",
      label: curveSeverity === "large" ? "Push slice" : "Push fade",
      detail: `Push path with ${faceLabel}.`,
    };
  }

  if (pathSide === "push" && faceSide === "closed") {
    return {
      code: "G",
      label: "Push draw",
      detail: `Push path with ${faceLabel}.`,
    };
  }

  if (faceSide === "square") {
    return {
      code: "B",
      label: "Pull",
      detail: `Pull path with ${faceLabel}.`,
    };
  }

  if (faceSide === "open") {
    return {
      code: "C",
      label: curveSeverity === "large" ? "Pull slice" : "Pull fade",
      detail: `Pull path with ${faceLabel}.`,
    };
  }

  return {
    code: "A",
    label: curveSeverity === "large" ? "Pull hook" : "Pull draw",
    detail: `${pathLabel} path with ${faceLabel}.`,
  };
}

function pathTrendTone(status: PathTrendTracking["status"]): IntelligenceTone {
  if (status === "neutralising") {
    return "green";
  }

  if (status === "widening") {
    return "amber";
  }

  if (status === "stable") {
    return "sky";
  }

  return "slate";
}

function categoryLabel(category: string) {
  if (category === "tee") {
    return "Tee";
  }

  if (category === "approach") {
    return "Approach";
  }

  if (category === "short_game") {
    return "Short game";
  }

  if (category === "putting") {
    return "Putting";
  }

  return category
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatYards(value: number | null | undefined) {
  return isNumber(value) ? `${Math.round(value)} yd` : "--";
}

function formatSigned(value: number | null | undefined) {
  if (!isNumber(value)) {
    return "--";
  }

  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}`;
}

function normalizeClubType(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeShotCategory(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function monthKey(value: Date | string | null | undefined) {
  const date = value ? new Date(value) : new Date(0);
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");

  return `${year}-${month}`;
}

function monthLabel(key: string) {
  const [, rawMonth] = key.split("-");
  const month = Number(rawMonth);
  const labels = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  return labels[month - 1] ?? key;
}

function shotDateLabel(value: Date | string | null | undefined) {
  if (!value) {
    return "Recent";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recent";
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function shotTime(value: Date | string | null | undefined) {
  if (!value) {
    return 0;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return sum(values) / values.length;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function median(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function percentile(values: number[], percentileValue: number) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * percentileValue;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sorted[lower];
  }

  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function roundOne(value: number | null | undefined) {
  return isNumber(value) ? Math.round(value * 10) / 10 : null;
}

function roundToNearestYard(value: number) {
  return Math.round(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
