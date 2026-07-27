import type { CourseTwinSurface } from "@/lib/course-twin-surface";
import type { CourseTwinReplayShot } from "@/lib/course-twin-contract";
import type { CourseTwinReplaySimulation } from "@/lib/course-twin-physics";

export type CourseTwinPuttVector = { x: number; y: number; z: number };

export type CourseTwinPuttInput = {
  start: CourseTwinPuttVector;
  hole: CourseTwinPuttVector;
  aimOffsetDeg: number;
  pacePercent: number;
};

export type CourseTwinPuttingEnvironment = {
  groundHeight: (x: number, z: number) => number;
  surfaceAt: (x: number, z: number) => CourseTwinSurface;
};

export type CourseTwinPuttFrame = {
  timeS: number;
  position: CourseTwinPuttVector;
  velocity: CourseTwinPuttVector;
  phase: "roll" | "stopped";
  surface: CourseTwinSurface;
};

export type CourseTwinPuttResult = {
  input: CourseTwinPuttInput;
  frames: CourseTwinPuttFrame[];
  finalPosition: CourseTwinPuttVector;
  holed: boolean;
  totalDistanceM: number;
  remainingDistanceM: number;
  totalTimeS: number;
  finalSurface: CourseTwinSurface;
  provenance: "survey-contour-model";
};

const GRAVITY = 9.80665;
const BALL_RADIUS_M = 0.02135;
const CUP_CAPTURE_RADIUS_M = 0.054;
const MAX_CAPTURE_SPEED_MPS = 1.8;
const GREEN_ROLLING_DECELERATION_MPS2 = 0.34;
const OFF_GREEN_ROLLING_DECELERATION_MPS2 = 1.25;

export function simulateCourseTwinPutt(
  input: CourseTwinPuttInput,
  environment: CourseTwinPuttingEnvironment,
  options: { stepS?: number; maxTimeS?: number; frameIntervalS?: number } = {},
): CourseTwinPuttResult {
  validatePuttInput(input);
  const stepS = clamp(options.stepS ?? 1 / 120, 1 / 500, 1 / 30);
  const maxTimeS = clamp(options.maxTimeS ?? 25, 1, 60);
  const frameIntervalS = Math.max(stepS, options.frameIntervalS ?? 1 / 30);
  const targetDirection = normalise2d(input.hole.x - input.start.x, input.hole.z - input.start.z);
  const direction = rotate2d(
    targetDirection.x,
    targetDirection.z,
    (input.aimOffsetDeg * Math.PI) / 180,
  );
  const targetDistanceM = Math.hypot(input.hole.x - input.start.x, input.hole.z - input.start.z);
  const terminalCupSpeedMps = 0.42;
  const flatTargetSpeedMps = Math.sqrt(
    terminalCupSpeedMps ** 2 + 2 * GREEN_ROLLING_DECELERATION_MPS2 * targetDistanceM,
  );
  const launchSpeedMps = flatTargetSpeedMps * (input.pacePercent / 100);
  let position = {
    x: input.start.x,
    y: environment.groundHeight(input.start.x, input.start.z) + BALL_RADIUS_M,
    z: input.start.z,
  };
  let velocity = { x: direction.x * launchSpeedMps, y: 0, z: direction.z * launchSpeedMps };
  const frames: CourseTwinPuttFrame[] = [];
  let timeS = 0;
  let nextFrameTimeS = 0;
  let totalDistanceM = 0;
  let holed = false;

  while (timeS < maxTimeS) {
    const surface = environment.surfaceAt(position.x, position.z);
    if (timeS + Number.EPSILON >= nextFrameTimeS) {
      frames.push(frame(timeS, position, velocity, "roll", surface));
      nextFrameTimeS += frameIntervalS;
    }

    const previous = { ...position };
    const normal = terrainNormal(environment.groundHeight, position.x, position.z);
    const gravity = { x: 0, y: -GRAVITY, z: 0 };
    const downhill = subtract(gravity, multiply(normal, dot(gravity, normal)));
    const speed = Math.hypot(velocity.x, velocity.z);
    const rollingDeceleration =
      surface === "green" ? GREEN_ROLLING_DECELERATION_MPS2 : OFF_GREEN_ROLLING_DECELERATION_MPS2;
    const friction =
      speed > 0.0001
        ? {
            x: (-velocity.x / speed) * rollingDeceleration,
            y: 0,
            z: (-velocity.z / speed) * rollingDeceleration,
          }
        : { x: 0, y: 0, z: 0 };
    const acceleration = add(downhill, friction);
    const nextVelocity = add(velocity, multiply(acceleration, stepS));

    if (
      speed > 0 &&
      dot2d(velocity, nextVelocity) <= 0 &&
      magnitude2d(downhill) < rollingDeceleration
    ) {
      velocity = { x: 0, y: 0, z: 0 };
    } else {
      velocity = { x: nextVelocity.x, y: 0, z: nextVelocity.z };
      position = add(position, multiply(velocity, stepS));
      position.y = environment.groundHeight(position.x, position.z) + BALL_RADIUS_M;
      totalDistanceM += Math.hypot(position.x - previous.x, position.z - previous.z);
    }

    const segmentDistance = distanceToSegment2d(input.hole, previous, position);
    if (segmentDistance <= CUP_CAPTURE_RADIUS_M && magnitude2d(velocity) <= MAX_CAPTURE_SPEED_MPS) {
      position = {
        x: input.hole.x,
        y: environment.groundHeight(input.hole.x, input.hole.z) + BALL_RADIUS_M,
        z: input.hole.z,
      };
      velocity = { x: 0, y: 0, z: 0 };
      holed = true;
    }

    timeS += stepS;
    if (holed || (magnitude2d(velocity) < 0.025 && magnitude2d(downhill) < rollingDeceleration)) {
      break;
    }
  }

  const finalSurface = environment.surfaceAt(position.x, position.z);
  frames.push(frame(timeS, position, { x: 0, y: 0, z: 0 }, "stopped", finalSurface));
  return {
    input: {
      start: { ...input.start },
      hole: { ...input.hole },
      aimOffsetDeg: input.aimOffsetDeg,
      pacePercent: input.pacePercent,
    },
    frames,
    finalPosition: position,
    holed,
    totalDistanceM,
    remainingDistanceM: holed
      ? 0
      : Math.hypot(input.hole.x - position.x, input.hole.z - position.z),
    totalTimeS: timeS,
    finalSurface,
    provenance: "survey-contour-model",
  };
}

export function buildCourseTwinPuttEventPayload({
  holeNumber,
  puttNumber,
  result,
}: {
  holeNumber: number;
  puttNumber: number;
  result: CourseTwinPuttResult;
}) {
  return {
    holeNumber,
    puttNumber,
    source: "modelled" as const,
    start: vectorToPosition(result.input.start),
    end: vectorToPosition(result.finalPosition),
    distanceM: result.totalDistanceM,
    remainingDistanceM: result.remainingDistanceM,
    aimOffsetDeg: result.input.aimOffsetDeg,
    pacePercent: result.input.pacePercent,
    holed: result.holed,
  };
}

export function buildCourseTwinPuttReplay({
  id,
  holeNumber,
  puttNumber,
  result,
}: {
  id: string;
  holeNumber: number;
  puttNumber: number;
  result: CourseTwinPuttResult;
}): { shot: CourseTwinReplayShot; simulation: CourseTwinReplaySimulation } {
  const start = vectorToPosition(result.input.start);
  const end = vectorToPosition(result.finalPosition);
  const totalYd = result.totalDistanceM / 0.9144;
  const firstVelocity = result.frames[0]?.velocity ?? { x: 0, y: 0, z: 0 };
  const firstSpeed = Math.hypot(firstVelocity.x, firstVelocity.z);
  const direction = normalise2d(
    result.input.hole.x - result.input.start.x,
    result.input.hole.z - result.input.start.z,
  );
  const shot: CourseTwinReplayShot = {
    id,
    holeNumber,
    holeShotNumber: puttNumber,
    clubType: "putter",
    start,
    carryEnd: start,
    totalEnd: end,
    trajectory: result.frames.map((puttFrame) => vectorToPosition(puttFrame.position)),
    metrics: {
      carryYd: { value: 0, provenance: "derived" },
      totalYd: { value: totalYd, provenance: "derived" },
      sideCarryYd: { value: null, provenance: "unavailable" },
      apexFt: { value: 0, provenance: "derived" },
      ballSpeedMph: { value: firstSpeed * 2.236_936, provenance: "derived" },
      launchAngleDeg: { value: 0, provenance: "derived" },
      spinRate: { value: null, provenance: "unavailable" },
      spinAxis: { value: null, provenance: "unavailable" },
    },
    placementProvenance: "derived",
    trajectoryProvenance: "reconstructed",
    rollProvenance: "reconstructed",
  };
  return {
    shot,
    simulation: {
      input: {
        position: { ...result.input.start },
        direction,
        ballSpeedMps: firstSpeed,
        launchAngleDeg: 0,
        backSpinRpm: 0,
      },
      frames: result.frames,
      carryPosition: { ...result.input.start },
      finalPosition: { ...result.finalPosition },
      carryDistanceM: 0,
      totalDistanceM: result.totalDistanceM,
      apexM: 0,
      flightTimeS: 0,
      totalTimeS: result.totalTimeS,
      bounceCount: 0,
      landingSurface: "green",
      finalSurface: result.finalSurface,
      penalty: null,
      provenance: "putting-contour-model",
    },
  };
}

export function sampleCourseTwinPutt(result: CourseTwinPuttResult, progress: number) {
  if (!result.frames.length) return null;
  const targetTime = clamp(progress, 0, 1) * result.totalTimeS;
  const rightIndex = result.frames.findIndex((candidate) => candidate.timeS >= targetTime);
  if (rightIndex <= 0) return result.frames[0];
  const right = result.frames[rightIndex];
  const left = result.frames[rightIndex - 1];
  const span = Math.max(Number.EPSILON, right.timeS - left.timeS);
  const amount = (targetTime - left.timeS) / span;
  return {
    ...right,
    timeS: targetTime,
    position: lerpVector(left.position, right.position, amount),
    velocity: lerpVector(left.velocity, right.velocity, amount),
  };
}

function validatePuttInput(input: CourseTwinPuttInput) {
  for (const [label, point] of [
    ["Putt start", input.start],
    ["Hole", input.hole],
  ] as const) {
    if (![point.x, point.y, point.z].every(Number.isFinite)) {
      throw new Error(`${label} must use finite coordinates.`);
    }
  }
  const distance = Math.hypot(input.hole.x - input.start.x, input.hole.z - input.start.z);
  if (distance < 0.05 || distance > 70) {
    throw new Error("Putt distance must be between 0.05 m and 70 m.");
  }
  if (!Number.isFinite(input.aimOffsetDeg) || Math.abs(input.aimOffsetDeg) > 45) {
    throw new Error("Putt aim must be within 45 degrees of the hole.");
  }
  if (!Number.isFinite(input.pacePercent) || input.pacePercent < 25 || input.pacePercent > 200) {
    throw new Error("Putt pace must be between 25% and 200%.");
  }
}

function vectorToPosition(value: CourseTwinPuttVector): [number, number, number] {
  return [value.x, value.y, value.z];
}

function frame(
  timeS: number,
  position: CourseTwinPuttVector,
  velocity: CourseTwinPuttVector,
  phase: CourseTwinPuttFrame["phase"],
  surface: CourseTwinSurface,
): CourseTwinPuttFrame {
  return { timeS, position: { ...position }, velocity: { ...velocity }, phase, surface };
}

function terrainNormal(height: CourseTwinPuttingEnvironment["groundHeight"], x: number, z: number) {
  const epsilon = 0.12;
  return normalise3d({
    x: height(x - epsilon, z) - height(x + epsilon, z),
    y: epsilon * 2,
    z: height(x, z - epsilon) - height(x, z + epsilon),
  });
}

function distanceToSegment2d(
  point: CourseTwinPuttVector,
  start: CourseTwinPuttVector,
  end: CourseTwinPuttVector,
) {
  const deltaX = end.x - start.x;
  const deltaZ = end.z - start.z;
  const lengthSquared = deltaX * deltaX + deltaZ * deltaZ;
  if (lengthSquared <= Number.EPSILON) {
    return Math.hypot(point.x - start.x, point.z - start.z);
  }
  const amount = clamp(
    ((point.x - start.x) * deltaX + (point.z - start.z) * deltaZ) / lengthSquared,
    0,
    1,
  );
  return Math.hypot(point.x - (start.x + deltaX * amount), point.z - (start.z + deltaZ * amount));
}

function normalise2d(x: number, z: number) {
  const length = Math.hypot(x, z) || 1;
  return { x: x / length, z: z / length };
}

function rotate2d(x: number, z: number, radians: number) {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return { x: x * cosine - z * sine, z: x * sine + z * cosine };
}

function normalise3d(value: CourseTwinPuttVector) {
  const length = Math.hypot(value.x, value.y, value.z) || 1;
  return { x: value.x / length, y: value.y / length, z: value.z / length };
}

function add(left: CourseTwinPuttVector, right: CourseTwinPuttVector) {
  return { x: left.x + right.x, y: left.y + right.y, z: left.z + right.z };
}

function subtract(left: CourseTwinPuttVector, right: CourseTwinPuttVector) {
  return { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z };
}

function multiply(value: CourseTwinPuttVector, amount: number) {
  return { x: value.x * amount, y: value.y * amount, z: value.z * amount };
}

function dot(left: CourseTwinPuttVector, right: CourseTwinPuttVector) {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function dot2d(left: CourseTwinPuttVector, right: CourseTwinPuttVector) {
  return left.x * right.x + left.z * right.z;
}

function magnitude2d(value: CourseTwinPuttVector) {
  return Math.hypot(value.x, value.z);
}

function lerpVector(left: CourseTwinPuttVector, right: CourseTwinPuttVector, amount: number) {
  return {
    x: left.x + (right.x - left.x) * amount,
    y: left.y + (right.y - left.y) * amount,
    z: left.z + (right.z - left.z) * amount,
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
