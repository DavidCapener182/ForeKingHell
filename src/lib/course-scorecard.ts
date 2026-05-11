import type { ParsedRapsodoShot, ShotCategory } from "@/lib/rapsodo/parser";

export type CourseScorecardHole = {
  holeNumber: number;
  par: number;
  yards: number;
  name: string | null;
};

export type ScorecardParseResult = {
  holes: CourseScorecardHole[];
  warnings: string[];
};

export type InferredCourseShot = {
  sourceShot: ParsedRapsodoShot;
  absoluteShotNumber: number;
  holeNumber: number;
  holeShotNumber: number;
  holePar: number;
  holeYards: number;
  holeName: string | null;
  shotDistanceYd: number | null;
  forwardDistanceYd: number | null;
  progressBeforeYd: number;
  progressAfterYd: number;
  distanceRemainingYd: number;
  displaySideYd: number;
  shotCategory: ShotCategory;
};

export type InferredCourseHole = CourseScorecardHole & {
  shots: InferredCourseShot[];
  progressYd: number;
  distanceRemainingYd: number;
};

export type CourseInferenceResult = {
  scorecard: CourseScorecardHole[];
  holes: InferredCourseHole[];
  shots: InferredCourseShot[];
  assignedShotCount: number;
  unassignedShotCount: number;
  completedHoleCount: number;
  totalScorecardYards: number;
  warnings: string[];
};

const MAX_SHOTS_PER_HOLE = 10;
const MAX_REASONABLE_HOLE_YARDS = 800;
const MIN_REASONABLE_HOLE_YARDS = 50;

export function parseScorecardText(text: string | string[]): ScorecardParseResult {
  const scorecardText = (Array.isArray(text) ? text.join("\n") : text).replaceAll("\\n", "\n");
  const warnings: string[] = [];
  const seenHoles = new Set<number>();
  const holes: CourseScorecardHole[] = [];
  const lines = scorecardText
    .replace(/\\r\\n|\\n/g, "\n")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const [lineIndex, line] of lines.entries()) {
    if (isLikelyScorecardHeader(line)) {
      continue;
    }

    const parsed = parseScorecardLine(line, lineIndex + 1);

    if (!parsed) {
      warnings.push(`Line ${lineIndex + 1} was not recognised as hole, par, yards.`);
      continue;
    }

    if (seenHoles.has(parsed.holeNumber)) {
      warnings.push(`Hole ${parsed.holeNumber} appears more than once; using the first row.`);
      continue;
    }

    seenHoles.add(parsed.holeNumber);
    holes.push(parsed);
  }

  holes.sort((left, right) => left.holeNumber - right.holeNumber);

  if (holes.length > 0 && holes.length !== 9 && holes.length !== 18) {
    warnings.push(`Scorecard has ${holes.length} holes; 9 or 18 holes is expected.`);
  }

  return { holes, warnings };
}

export function inferCourseShots(
  shots: ParsedRapsodoShot[],
  scorecard: CourseScorecardHole[],
): CourseInferenceResult {
  const warnings: string[] = [];
  const totalScorecardYards = scorecard.reduce((total, hole) => total + hole.yards, 0);

  if (shots.length === 0 || scorecard.length === 0) {
    return {
      scorecard,
      holes: scorecard.map((hole) => ({
        ...hole,
        shots: [],
        progressYd: 0,
        distanceRemainingYd: hole.yards,
      })),
      shots: [],
      assignedShotCount: 0,
      unassignedShotCount: shots.length,
      completedHoleCount: 0,
      totalScorecardYards,
      warnings,
    };
  }

  const playableHoleCount = Math.min(scorecard.length, shots.length);
  const assignableShotCount = Math.min(shots.length, playableHoleCount * MAX_SHOTS_PER_HOLE);
  const playableScorecard = scorecard.slice(0, playableHoleCount);
  const playableShots = shots.slice(0, assignableShotCount);
  const forwardDistances = playableShots.map((shot) => forwardDistanceYd(shot) ?? 0);
  const prefixDistances = [0];

  for (const distance of forwardDistances) {
    prefixDistances.push(prefixDistances[prefixDistances.length - 1] + distance);
  }

  const partitions = findBestPartitions(playableShots, playableScorecard, prefixDistances);
  const inferredShots: InferredCourseShot[] = [];
  const inferredHoles = scorecard.map<InferredCourseHole>((hole) => ({
    ...hole,
    shots: [],
    progressYd: 0,
    distanceRemainingYd: hole.yards,
  }));

  for (const partition of partitions) {
    const hole = playableScorecard[partition.holeIndex];
    let progress = 0;

    for (let shotIndex = partition.startShotIndex; shotIndex < partition.endShotIndex; shotIndex += 1) {
      const sourceShot = playableShots[shotIndex];
      const forwardDistance = forwardDistanceYd(sourceShot);
      const shotDistance = sourceShot.totalYd ?? sourceShot.carryYd;
      const progressBefore = progress;
      progress += forwardDistance ?? 0;
      const distanceRemaining = Math.max(0, hole.yards - progress);
      const inferredShot: InferredCourseShot = {
        sourceShot,
        absoluteShotNumber: shotIndex + 1,
        holeNumber: hole.holeNumber,
        holeShotNumber: shotIndex - partition.startShotIndex + 1,
        holePar: hole.par,
        holeYards: hole.yards,
        holeName: hole.name,
        shotDistanceYd: shotDistance,
        forwardDistanceYd: forwardDistance,
        progressBeforeYd: roundOne(progressBefore),
        progressAfterYd: roundOne(progress),
        distanceRemainingYd: roundOne(distanceRemaining),
        displaySideYd: sourceShot.sideCarryYd ?? 0,
        shotCategory: classifyCourseShot(sourceShot, shotIndex - partition.startShotIndex + 1),
      };

      inferredShots.push(inferredShot);
      inferredHoles[partition.holeIndex].shots.push(inferredShot);
    }

    inferredHoles[partition.holeIndex].progressYd = roundOne(progress);
    inferredHoles[partition.holeIndex].distanceRemainingYd = roundOne(Math.max(0, hole.yards - progress));
  }

  const unassignedShotCount = shots.length - inferredShots.length;

  if (unassignedShotCount > 0) {
    warnings.push(`${unassignedShotCount} shot${unassignedShotCount === 1 ? "" : "s"} could not be assigned to the scorecard.`);
  }

  if (scorecard.length > shots.length) {
    warnings.push("There are fewer shots than scorecard holes, so later holes have no shot overlay.");
  }

  return {
    scorecard,
    holes: inferredHoles,
    shots: inferredShots,
    assignedShotCount: inferredShots.length,
    unassignedShotCount,
    completedHoleCount: inferredHoles.filter((hole) => hole.shots.length > 0).length,
    totalScorecardYards,
    warnings,
  };
}

export function inferCourseShotsFromHoleShotCounts(
  shots: ParsedRapsodoShot[],
  scorecard: CourseScorecardHole[],
  holeShotCounts: Array<{ holeNumber: number; shotCount: number }>,
): CourseInferenceResult {
  const totalScorecardYards = scorecard.reduce((total, hole) => total + hole.yards, 0);
  const warnings: string[] = [];
  const countByHole = new Map(
    holeShotCounts.map((entry) => [
      entry.holeNumber,
      Math.max(0, Math.min(MAX_SHOTS_PER_HOLE, Math.floor(entry.shotCount))),
    ]),
  );
  const inferredShots: InferredCourseShot[] = [];
  const inferredHoles = scorecard.map<InferredCourseHole>((hole) => ({
    ...hole,
    shots: [],
    progressYd: 0,
    distanceRemainingYd: hole.yards,
  }));
  let cursor = 0;

  for (const [holeIndex, hole] of scorecard.entries()) {
    const requestedCount = countByHole.get(hole.holeNumber) ?? 0;
    const endShotIndex = Math.min(shots.length, cursor + requestedCount);
    let progress = 0;

    for (let shotIndex = cursor; shotIndex < endShotIndex; shotIndex += 1) {
      const sourceShot = shots[shotIndex];
      const forwardDistance = forwardDistanceYd(sourceShot);
      const shotDistance = sourceShot.totalYd ?? sourceShot.carryYd;
      const progressBefore = progress;
      progress += forwardDistance ?? 0;
      const distanceRemaining = Math.max(0, hole.yards - progress);
      const inferredShot: InferredCourseShot = {
        sourceShot,
        absoluteShotNumber: shotIndex + 1,
        holeNumber: hole.holeNumber,
        holeShotNumber: shotIndex - cursor + 1,
        holePar: hole.par,
        holeYards: hole.yards,
        holeName: hole.name,
        shotDistanceYd: shotDistance,
        forwardDistanceYd: forwardDistance,
        progressBeforeYd: roundOne(progressBefore),
        progressAfterYd: roundOne(progress),
        distanceRemainingYd: roundOne(distanceRemaining),
        displaySideYd: sourceShot.sideCarryYd ?? 0,
        shotCategory: classifyCourseShot(sourceShot, shotIndex - cursor + 1),
      };

      inferredShots.push(inferredShot);
      inferredHoles[holeIndex].shots.push(inferredShot);
    }

    inferredHoles[holeIndex].progressYd = roundOne(progress);
    inferredHoles[holeIndex].distanceRemainingYd = roundOne(Math.max(0, hole.yards - progress));
    cursor = endShotIndex;
  }

  const unassignedShotCount = Math.max(0, shots.length - inferredShots.length);

  if (unassignedShotCount > 0) {
    warnings.push(`${unassignedShotCount} shot${unassignedShotCount === 1 ? "" : "s"} are still unassigned. Increase the CSV shot counts on the review rows.`);
  }

  return {
    scorecard,
    holes: inferredHoles,
    shots: inferredShots,
    assignedShotCount: inferredShots.length,
    unassignedShotCount,
    completedHoleCount: inferredHoles.filter((hole) => hole.shots.length > 0).length,
    totalScorecardYards,
    warnings,
  };
}

function parseScorecardLine(line: string, oneBasedLineNumber: number): CourseScorecardHole | null {
  const cells = splitScorecardLine(line);
  const numbers = cells
    .map((cell, index) => ({ value: parseInteger(cell), index }))
    .filter((entry): entry is { value: number; index: number } => entry.value !== null);

  if (numbers.length < 2) {
    return null;
  }

  const hasExplicitHole = numbers.length >= 3 && isHoleNumber(numbers[0].value);
  const holeNumber = hasExplicitHole ? numbers[0].value : oneBasedLineNumber;
  const par = hasExplicitHole ? numbers[1].value : numbers[0].value;
  const yards = hasExplicitHole ? numbers[2].value : numbers[1].value;
  const nameStartIndex = hasExplicitHole ? numbers[2].index + 1 : numbers[1].index + 1;
  const name = cells
    .slice(nameStartIndex)
    .join(" ")
    .trim();

  if (!isHoleNumber(holeNumber) || par < 3 || par > 6) {
    return null;
  }

  if (yards < MIN_REASONABLE_HOLE_YARDS || yards > MAX_REASONABLE_HOLE_YARDS) {
    return null;
  }

  return {
    holeNumber,
    par,
    yards,
    name: name || null,
  };
}

function splitScorecardLine(line: string) {
  if (/[,\t;]/.test(line)) {
    return parseDelimitedLine(line).map((cell) => cell.trim()).filter(Boolean);
  }

  return line.split(/\s+/).map((cell) => cell.trim()).filter(Boolean);
}

function parseDelimitedLine(line: string) {
  const cells: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if ((char === "," || char === "\t" || char === ";") && !inQuotes) {
      cells.push(cell);
      cell = "";
      continue;
    }

    cell += char;
  }

  cells.push(cell);
  return cells;
}

type HolePartition = {
  holeIndex: number;
  startShotIndex: number;
  endShotIndex: number;
};

function findBestPartitions(
  shots: ParsedRapsodoShot[],
  holes: CourseScorecardHole[],
  prefixDistances: number[],
) {
  const holeCount = holes.length;
  const shotCount = shots.length;
  const dp = Array.from({ length: holeCount + 1 }, () =>
    Array.from({ length: shotCount + 1 }, () => Number.POSITIVE_INFINITY),
  );
  const choices: Array<Array<number | null>> = Array.from({ length: holeCount + 1 }, () =>
    Array.from({ length: shotCount + 1 }, () => null),
  );

  dp[0][0] = 0;

  for (let holeIndex = 1; holeIndex <= holeCount; holeIndex += 1) {
    for (let endShotIndex = holeIndex; endShotIndex <= shotCount; endShotIndex += 1) {
      const remainingHoles = holeCount - holeIndex;
      const remainingShots = shotCount - endShotIndex;

      if (remainingShots < remainingHoles || remainingShots > remainingHoles * MAX_SHOTS_PER_HOLE) {
        continue;
      }

      const maxGroupSize = Math.min(MAX_SHOTS_PER_HOLE, endShotIndex);

      for (let groupSize = 1; groupSize <= maxGroupSize; groupSize += 1) {
        const startShotIndex = endShotIndex - groupSize;
        const previousCost = dp[holeIndex - 1][startShotIndex];

        if (!Number.isFinite(previousCost)) {
          continue;
        }

        const hole = holes[holeIndex - 1];
        const distance = prefixDistances[endShotIndex] - prefixDistances[startShotIndex];
        const totalCost =
          previousCost +
          holePartitionCost(hole, shots, startShotIndex, endShotIndex, distance);

        if (totalCost < dp[holeIndex][endShotIndex]) {
          dp[holeIndex][endShotIndex] = totalCost;
          choices[holeIndex][endShotIndex] = startShotIndex;
        }
      }
    }
  }

  if (!Number.isFinite(dp[holeCount][shotCount])) {
    return holes.map<HolePartition>((_, holeIndex) => ({
      holeIndex,
      startShotIndex: holeIndex,
      endShotIndex: Math.min(holeIndex + 1, shotCount),
    }));
  }

  const partitions: HolePartition[] = [];
  let cursor = shotCount;

  for (let holeIndex = holeCount; holeIndex >= 1; holeIndex -= 1) {
    const startShotIndex = choices[holeIndex][cursor] ?? Math.max(0, cursor - 1);
    partitions.push({
      holeIndex: holeIndex - 1,
      startShotIndex,
      endShotIndex: cursor,
    });
    cursor = startShotIndex;
  }

  return partitions.reverse();
}

function holePartitionCost(
  hole: CourseScorecardHole,
  shots: ParsedRapsodoShot[],
  startShotIndex: number,
  endShotIndex: number,
  distance: number,
) {
  const puttingGapAllowance = Math.max(18, Math.min(38, hole.yards * 0.06));
  const overshootAllowance = Math.max(28, Math.min(55, hole.yards * 0.08));
  const shortfall = Math.max(0, hole.yards - distance - puttingGapAllowance);
  const overshoot = Math.max(0, distance - hole.yards - overshootAllowance);
  const groupSize = endShotIndex - startShotIndex;
  const firstShot = shots[startShotIndex];
  const lastShot = shots[endShotIndex - 1];
  const expectedShots = expectedNonPuttingShotCount(hole);

  let cost = shortfall * 1.35 + overshoot * 0.8 + Math.abs(groupSize - expectedShots) * 5;

  if (firstShot) {
    cost += teeShotPenalty(firstShot, hole);
  }

  if (lastShot && groupSize > 1 && isLikelyTeeClub(lastShot.clubType) && distance < hole.yards * 0.75) {
    cost += 45;
  }

  return cost;
}

function expectedNonPuttingShotCount(hole: CourseScorecardHole) {
  if (hole.par <= 3) {
    return 2;
  }

  if (hole.par === 4) {
    return 3;
  }

  return 4;
}

function teeShotPenalty(shot: ParsedRapsodoShot, hole: CourseScorecardHole) {
  const distance = shot.totalYd ?? shot.carryYd ?? 0;

  if (hole.par >= 4 && isShortGameClub(shot.clubType) && distance < 140) {
    return 70;
  }

  if (hole.par === 5 && distance < 140) {
    return 35;
  }

  if (hole.par === 3 && shot.clubType === "driver") {
    return 30;
  }

  return 0;
}

function classifyCourseShot(shot: ParsedRapsodoShot, holeShotNumber: number): ShotCategory {
  const distance = shot.totalYd ?? shot.carryYd ?? 0;

  if (holeShotNumber === 1) {
    return "tee";
  }

  if (distance <= 35) {
    return "chip";
  }

  if (distance <= 95 && isShortGameClub(shot.clubType)) {
    return "pitch";
  }

  return "approach";
}

function forwardDistanceYd(shot: ParsedRapsodoShot) {
  const totalDistance = shot.totalYd ?? shot.carryYd;

  if (totalDistance === null) {
    return null;
  }

  const sideDistance = shot.sideCarryYd ?? 0;
  const forwardSquared = totalDistance ** 2 - sideDistance ** 2;

  if (forwardSquared <= 0) {
    return roundOne(Math.max(0, totalDistance));
  }

  return roundOne(Math.sqrt(forwardSquared));
}

function isLikelyScorecardHeader(line: string) {
  return /hole/i.test(line) && /par/i.test(line) && /(yard|yd|distance)/i.test(line);
}

function isHoleNumber(value: number) {
  return Number.isInteger(value) && value >= 1 && value <= 18;
}

function isShortGameClub(clubType: string) {
  return ["pw", "gw", "aw", "sw", "lw", "wedge"].includes(clubType);
}

function isLikelyTeeClub(clubType: string) {
  return clubType === "driver" || /^[1-9][wh]$/.test(clubType);
}

function parseInteger(value: string) {
  const match = value.replace(/,/g, "").match(/^\D*(\d+)\D*$/);

  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isInteger(parsed) ? parsed : null;
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}
