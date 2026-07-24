import type { CourseTwinSurface } from "@/lib/course-twin-surface";
import type { CourseTwinReplayShot } from "@/lib/course-twin-contract";

export type CourseTwinVector3 = { x: number; y: number; z: number };
export type CourseTwinShotPhase = "flight" | "bounce" | "roll" | "stopped";

export type CourseTwinPhysicsEnvironment = {
  groundHeight: (x: number, z: number) => number;
  surfaceAt: (x: number, z: number) => CourseTwinSurface;
};

export type CourseTwinShotInput = {
  position: CourseTwinVector3;
  direction: { x: number; z: number };
  ballSpeedMps: number;
  launchAngleDeg: number;
  launchAzimuthDeg?: number;
  backSpinRpm: number;
  sideSpinRpm?: number;
  windMps?: CourseTwinVector3;
};

export type CourseTwinSimulationFrame = {
  timeS: number;
  position: CourseTwinVector3;
  velocity: CourseTwinVector3;
  phase: CourseTwinShotPhase;
  surface: CourseTwinSurface;
};

export type CourseTwinSimulationResult = {
  frames: CourseTwinSimulationFrame[];
  carryPosition: CourseTwinVector3;
  finalPosition: CourseTwinVector3;
  carryDistanceM: number;
  totalDistanceM: number;
  apexM: number;
  flightTimeS: number;
  totalTimeS: number;
  bounceCount: number;
  landingSurface: CourseTwinSurface;
  finalSurface: CourseTwinSurface;
  penalty: "water" | "out_of_bounds" | null;
};

export type CourseTwinReplaySimulation = CourseTwinSimulationResult & {
  input: CourseTwinShotInput;
  provenance: "physics-reconstructed" | "putting-contour-model";
};

const GRAVITY = 9.80665;
const BALL_RADIUS_M = 0.02135;
const BALL_MASS_KG = 0.04593;
const AIR_DENSITY = 1.225;
const BALL_AREA_M2 = Math.PI * BALL_RADIUS_M * BALL_RADIUS_M;
const DRAG_COEFFICIENT = 0.22;
const MAGNUS_COEFFICIENT = 0.000_45;
const SPIN_DECAY_PER_SECOND = 0.035;

const surfacePhysics: Record<
  CourseTwinSurface,
  { restitution: number; tangentRetention: number; rollingFriction: number }
> = {
  tee: { restitution: 0.31, tangentRetention: 0.8, rollingFriction: 0.065 },
  fairway: { restitution: 0.27, tangentRetention: 0.76, rollingFriction: 0.078 },
  green: { restitution: 0.2, tangentRetention: 0.83, rollingFriction: 0.032 },
  rough: { restitution: 0.16, tangentRetention: 0.5, rollingFriction: 0.2 },
  bunker: { restitution: 0.055, tangentRetention: 0.22, rollingFriction: 0.48 },
  water: { restitution: 0, tangentRetention: 0, rollingFriction: 1 },
  trees: { restitution: 0.1, tangentRetention: 0.36, rollingFriction: 0.29 },
  out_of_bounds: { restitution: 0.15, tangentRetention: 0.48, rollingFriction: 0.22 },
};

export function simulateCourseTwinShot(
  input: CourseTwinShotInput,
  environment: CourseTwinPhysicsEnvironment,
  options: { stepS?: number; maxTimeS?: number; frameIntervalS?: number } = {},
): CourseTwinSimulationResult {
  validateShotInput(input);
  const stepS = clamp(options.stepS ?? 1 / 120, 1 / 500, 1 / 30);
  const maxTimeS = clamp(options.maxTimeS ?? 35, 1, 90);
  const frameIntervalS = Math.max(stepS, options.frameIntervalS ?? 1 / 30);
  const start = { ...input.position };
  const groundAtStart = environment.groundHeight(start.x, start.z);
  start.y = Math.max(start.y, groundAtStart + BALL_RADIUS_M);

  const baseDirection = normalize2d(input.direction.x, input.direction.z);
  const launchDirection = rotate2d(
    baseDirection.x,
    baseDirection.z,
    degreesToRadians(input.launchAzimuthDeg ?? 0),
  );
  const launchAngle = degreesToRadians(input.launchAngleDeg);
  const horizontalSpeed = input.ballSpeedMps * Math.cos(launchAngle);
  let velocity: CourseTwinVector3 = {
    x: launchDirection.x * horizontalSpeed,
    y: input.ballSpeedMps * Math.sin(launchAngle),
    z: launchDirection.z * horizontalSpeed,
  };
  let position = { ...start };
  let spin = initialSpinVector(launchDirection, input.backSpinRpm, input.sideSpinRpm ?? 0);
  const wind = input.windMps ?? { x: 0, y: 0, z: 0 };
  const frames: CourseTwinSimulationFrame[] = [];
  let phase: CourseTwinShotPhase = "flight";
  let timeS = 0;
  let nextFrameTimeS = 0;
  let bounceCount = 0;
  let carryPosition: CourseTwinVector3 | null = null;
  let flightTimeS = 0;
  let landingSurface: CourseTwinSurface | null = null;
  let penalty: CourseTwinSimulationResult["penalty"] = null;
  let apexM = position.y - groundAtStart;

  while (timeS < maxTimeS && phase !== "stopped") {
    const surface = environment.surfaceAt(position.x, position.z);
    if (timeS + Number.EPSILON >= nextFrameTimeS) {
      frames.push(frame(timeS, position, velocity, phase, surface));
      nextFrameTimeS += frameIntervalS;
    }

    if (phase === "flight" || phase === "bounce") {
      const relativeVelocity = subtract(velocity, wind);
      const relativeSpeed = magnitude(relativeVelocity);
      const dragScale =
        relativeSpeed > 0
          ? (-0.5 * AIR_DENSITY * DRAG_COEFFICIENT * BALL_AREA_M2 * relativeSpeed) / BALL_MASS_KG
          : 0;
      const drag = multiply(relativeVelocity, dragScale);
      const magnus = multiply(cross(spin, relativeVelocity), MAGNUS_COEFFICIENT);
      const acceleration = add(add(drag, magnus), { x: 0, y: -GRAVITY, z: 0 });
      velocity = add(velocity, multiply(acceleration, stepS));
      position = add(position, multiply(velocity, stepS));
      spin = multiply(spin, Math.exp(-SPIN_DECAY_PER_SECOND * stepS));
      apexM = Math.max(apexM, position.y - environment.groundHeight(position.x, position.z));

      const ground = environment.groundHeight(position.x, position.z) + BALL_RADIUS_M;
      if (position.y <= ground && velocity.y < 0) {
        position.y = ground;
        const impactSurface = environment.surfaceAt(position.x, position.z);
        carryPosition ??= { ...position };
        landingSurface ??= impactSurface;
        flightTimeS ||= timeS;
        if (impactSurface === "water" || impactSurface === "out_of_bounds") {
          penalty = impactSurface === "water" ? "water" : "out_of_bounds";
          velocity = { x: 0, y: 0, z: 0 };
          phase = "stopped";
        } else {
          const normal = terrainNormal(environment.groundHeight, position.x, position.z);
          const normalSpeed = dot(velocity, normal);
          const physics = surfacePhysics[impactSurface];
          velocity = subtract(velocity, multiply(normal, (1 + physics.restitution) * normalSpeed));
          const bouncedNormalSpeed = dot(velocity, normal);
          const normalVelocity = multiply(normal, bouncedNormalSpeed);
          const tangentVelocity = subtract(velocity, normalVelocity);
          velocity = add(normalVelocity, multiply(tangentVelocity, physics.tangentRetention));
          bounceCount += 1;
          if (Math.abs(bouncedNormalSpeed) < 1.15 || bounceCount >= 5) {
            phase = "roll";
            velocity = { x: velocity.x * 0.46, y: 0, z: velocity.z * 0.46 };
          } else {
            phase = "bounce";
          }
        }
      }
    } else if (phase === "roll") {
      const rollingSurface = environment.surfaceAt(position.x, position.z);
      if (rollingSurface === "water" || rollingSurface === "out_of_bounds") {
        penalty = rollingSurface === "water" ? "water" : "out_of_bounds";
        velocity = { x: 0, y: 0, z: 0 };
        phase = "stopped";
      } else {
        const normal = terrainNormal(environment.groundHeight, position.x, position.z);
        const gravity = { x: 0, y: -GRAVITY, z: 0 };
        const downhill = subtract(gravity, multiply(normal, dot(gravity, normal)));
        const horizontalVelocity = { x: velocity.x, y: 0, z: velocity.z };
        const speed = magnitude(horizontalVelocity);
        const friction = surfacePhysics[rollingSurface].rollingFriction * GRAVITY;
        const frictionAcceleration =
          speed > 0.001 ? multiply(horizontalVelocity, -friction / speed) : { x: 0, y: 0, z: 0 };
        const acceleration = add(downhill, frictionAcceleration);
        const nextVelocity = add(horizontalVelocity, multiply(acceleration, stepS));
        if (
          speed > 0 &&
          dot(horizontalVelocity, nextVelocity) <= 0 &&
          magnitude(downhill) < friction
        ) {
          velocity = { x: 0, y: 0, z: 0 };
          phase = "stopped";
        } else {
          velocity = { x: nextVelocity.x, y: 0, z: nextVelocity.z };
          position = add(position, multiply(velocity, stepS));
          position.y = environment.groundHeight(position.x, position.z) + BALL_RADIUS_M;
          if (magnitude(velocity) < 0.12 && magnitude(downhill) < friction) {
            velocity = { x: 0, y: 0, z: 0 };
            phase = "stopped";
          }
        }
      }
    }
    timeS += stepS;
  }

  carryPosition ??= { ...position };
  landingSurface ??= environment.surfaceAt(carryPosition.x, carryPosition.z);
  flightTimeS ||= timeS;
  const finalSurface = environment.surfaceAt(position.x, position.z);
  frames.push(frame(timeS, position, velocity, "stopped", finalSurface));

  return {
    frames,
    carryPosition,
    finalPosition: { ...position },
    carryDistanceM: horizontalDistance(start, carryPosition),
    totalDistanceM: horizontalDistance(start, position),
    apexM,
    flightTimeS,
    totalTimeS: timeS,
    bounceCount,
    landingSurface,
    finalSurface,
    penalty,
  };
}

export function simulateCourseTwinReplayShot(
  shot: CourseTwinReplayShot,
  environment: CourseTwinPhysicsEnvironment,
  options: { windMps?: CourseTwinVector3 } = {},
): CourseTwinReplaySimulation {
  const start = terrainPosition(shot.start, environment);
  const carryTarget = terrainPosition(shot.carryEnd, environment);
  const totalTarget = terrainPosition(shot.totalEnd, environment);
  const carryVector = { x: carryTarget.x - start.x, z: carryTarget.z - start.z };
  const totalVector = { x: totalTarget.x - start.x, z: totalTarget.z - start.z };
  const targetVector = Math.hypot(carryVector.x, carryVector.z) > 0.05 ? carryVector : totalVector;
  const targetDirection =
    Math.hypot(targetVector.x, targetVector.z) > 0.05
      ? normalize2d(targetVector.x, targetVector.z)
      : { x: 1, z: 0 };
  const carryDistanceM = horizontalDistance(start, carryTarget);
  const launchAngleDeg = replayLaunchAngle(shot, carryDistanceM);
  const spinRate = shot.metrics.spinRate.value ?? fallbackSpinRate(shot.clubType);
  const spinAxisRadians = degreesToRadians(shot.metrics.spinAxis.value ?? 0);
  const input: CourseTwinShotInput = {
    position: start,
    direction: targetDirection,
    ballSpeedMps:
      shot.metrics.ballSpeedMph.value !== null
        ? clamp(shot.metrics.ballSpeedMph.value * 0.44704, 4, 110)
        : fallbackBallSpeed(carryDistanceM, launchAngleDeg),
    launchAngleDeg,
    launchAzimuthDeg: replayLaunchDirectionDeg(shot),
    backSpinRpm: clamp(Math.abs(spinRate * Math.cos(spinAxisRadians)), 150, 12_000),
    sideSpinRpm: clamp(spinRate * Math.sin(spinAxisRadians), -5_000, 5_000),
    windMps: options.windMps,
  };
  const raw = simulateCourseTwinShot(input, environment);
  const launchDirection = rotate2d(
    targetDirection.x,
    targetDirection.z,
    degreesToRadians(input.launchAzimuthDeg ?? 0),
  );
  let frames = raw.frames.map((simulationFrame) =>
    mapReplayFrame(
      simulationFrame,
      raw,
      start,
      carryTarget,
      totalTarget,
      launchDirection,
      environment,
    ),
  );

  frames.push({
    timeS: raw.flightTimeS,
    position: { ...carryTarget },
    velocity: nearestFrameVelocity(raw.frames, raw.flightTimeS),
    phase: raw.bounceCount > 0 ? "bounce" : "roll",
    surface: environment.surfaceAt(carryTarget.x, carryTarget.z),
  });
  frames.push({
    timeS: raw.totalTimeS,
    position: { ...totalTarget },
    velocity: { x: 0, y: 0, z: 0 },
    phase: "stopped",
    surface: environment.surfaceAt(totalTarget.x, totalTarget.z),
  });
  frames = frames.sort((left, right) => left.timeS - right.timeS);

  const hazardIndex = frames.findIndex(
    (simulationFrame) =>
      simulationFrame.timeS + Number.EPSILON >= raw.flightTimeS &&
      isPenaltySurface(simulationFrame.surface),
  );
  const penalty =
    hazardIndex >= 0 ? (frames[hazardIndex].surface === "water" ? "water" : "out_of_bounds") : null;
  if (hazardIndex >= 0) {
    const stopped = frames[hazardIndex];
    frames = frames.slice(0, hazardIndex + 1);
    frames[frames.length - 1] = {
      ...stopped,
      velocity: { x: 0, y: 0, z: 0 },
      phase: "stopped",
    };
  }

  const finalFrame = frames.at(-1) ?? {
    timeS: 0,
    position: start,
    velocity: { x: 0, y: 0, z: 0 },
    phase: "stopped" as const,
    surface: environment.surfaceAt(start.x, start.z),
  };
  const apexM = frames.reduce(
    (highest, simulationFrame) =>
      Math.max(
        highest,
        simulationFrame.position.y -
          environment.groundHeight(simulationFrame.position.x, simulationFrame.position.z),
      ),
    0,
  );

  return {
    ...raw,
    frames,
    carryPosition: carryTarget,
    finalPosition: finalFrame.position,
    carryDistanceM,
    totalDistanceM: horizontalDistance(start, finalFrame.position),
    apexM,
    totalTimeS: finalFrame.timeS,
    landingSurface: environment.surfaceAt(carryTarget.x, carryTarget.z),
    finalSurface: finalFrame.surface,
    penalty,
    input,
    provenance: "physics-reconstructed",
  };
}

export function sampleCourseTwinSimulation(
  simulation: Pick<CourseTwinSimulationResult, "frames" | "totalTimeS">,
  progress: number,
) {
  const frames = simulation.frames;
  if (frames.length === 0) return null;
  const timeS = clamp(progress, 0, 1) * simulation.totalTimeS;
  const rightIndex = frames.findIndex((simulationFrame) => simulationFrame.timeS >= timeS);
  if (rightIndex <= 0) return frames[0];
  if (rightIndex < 0) return frames[frames.length - 1];
  const left = frames[rightIndex - 1];
  const right = frames[rightIndex];
  const duration = Math.max(Number.EPSILON, right.timeS - left.timeS);
  const ratio = clamp((timeS - left.timeS) / duration, 0, 1);
  return {
    timeS,
    position: lerpVector(left.position, right.position, ratio),
    velocity: lerpVector(left.velocity, right.velocity, ratio),
    phase: ratio < 0.5 ? left.phase : right.phase,
    surface: ratio < 0.5 ? left.surface : right.surface,
  } satisfies CourseTwinSimulationFrame;
}

function mapReplayFrame(
  simulationFrame: CourseTwinSimulationFrame,
  raw: CourseTwinSimulationResult,
  targetStart: CourseTwinVector3,
  targetCarry: CourseTwinVector3,
  targetTotal: CourseTwinVector3,
  launchDirection: { x: number; z: number },
  environment: CourseTwinPhysicsEnvironment,
): CourseTwinSimulationFrame {
  const inFlight = simulationFrame.timeS <= raw.flightTimeS + Number.EPSILON;
  const progress = inFlight
    ? clamp(simulationFrame.timeS / Math.max(0.01, raw.flightTimeS), 0, 1)
    : clamp(
        (simulationFrame.timeS - raw.flightTimeS) /
          Math.max(0.01, raw.totalTimeS - raw.flightTimeS),
        0,
        1,
      );
  const mapped = inFlight
    ? mapFlightCurve(targetStart, targetCarry, launchDirection, progress)
    : mapGroundSegment(targetCarry, targetTotal, progress);
  const sourceGround = environment.groundHeight(
    simulationFrame.position.x,
    simulationFrame.position.z,
  );
  const heightAboveGround = Math.max(BALL_RADIUS_M, simulationFrame.position.y - sourceGround);
  const position = {
    x: mapped.x,
    y: environment.groundHeight(mapped.x, mapped.z) + heightAboveGround,
    z: mapped.z,
  };
  return {
    ...simulationFrame,
    position,
    surface: environment.surfaceAt(position.x, position.z),
  };
}

function mapFlightCurve(
  start: CourseTwinVector3,
  end: CourseTwinVector3,
  launchDirection: { x: number; z: number },
  progress: number,
) {
  const length = horizontalDistance(start, end);
  if (length < 0.05) return { x: start.x, z: start.z };
  const finishDirection = normalize2d(end.x - start.x, end.z - start.z);
  const firstControlDistance = length * 0.34;
  const secondControlDistance = length * 0.28;
  const first = {
    x: start.x + launchDirection.x * firstControlDistance,
    z: start.z + launchDirection.z * firstControlDistance,
  };
  const second = {
    x: end.x - finishDirection.x * secondControlDistance,
    z: end.z - finishDirection.z * secondControlDistance,
  };
  const inverse = 1 - progress;
  return {
    x:
      inverse * inverse * inverse * start.x +
      3 * inverse * inverse * progress * first.x +
      3 * inverse * progress * progress * second.x +
      progress * progress * progress * end.x,
    z:
      inverse * inverse * inverse * start.z +
      3 * inverse * inverse * progress * first.z +
      3 * inverse * progress * progress * second.z +
      progress * progress * progress * end.z,
  };
}

function mapGroundSegment(start: CourseTwinVector3, end: CourseTwinVector3, progress: number) {
  const eased = progress * progress * (3 - 2 * progress);
  return {
    x: start.x + (end.x - start.x) * eased,
    z: start.z + (end.z - start.z) * eased,
  };
}

function terrainPosition(
  point: readonly [number, number, number],
  environment: CourseTwinPhysicsEnvironment,
): CourseTwinVector3 {
  return {
    x: point[0],
    y: environment.groundHeight(point[0], point[2]) + BALL_RADIUS_M,
    z: point[2],
  };
}

function replayLaunchAngle(shot: CourseTwinReplayShot, carryDistanceM: number) {
  if (shot.metrics.launchAngleDeg.value !== null) {
    return clamp(shot.metrics.launchAngleDeg.value, -5, 60);
  }
  const apexM = Math.max(1, (shot.metrics.apexFt.value ?? 45) * 0.3048);
  return clamp((Math.atan((4 * apexM) / Math.max(1, carryDistanceM)) * 180) / Math.PI, 4, 45);
}

function replayLaunchDirectionDeg(shot: CourseTwinReplayShot) {
  const measured = shot.metrics.launchDirectionDeg?.value;
  if (measured !== null && measured !== undefined) return clamp(measured, -35, 35);
  return clamp(-(shot.metrics.spinAxis.value ?? 0) * 0.32, -6, 6);
}

function fallbackBallSpeed(carryDistanceM: number, launchAngleDeg: number) {
  const launchAngle = degreesToRadians(launchAngleDeg);
  const ballisticSpeed = Math.sqrt(
    (Math.max(1, carryDistanceM) * GRAVITY) / Math.max(0.12, Math.sin(2 * launchAngle)),
  );
  return clamp(ballisticSpeed * 1.12, 7, 92);
}

function fallbackSpinRate(clubType: string) {
  const club = clubType.toLowerCase();
  if (club.includes("driver")) return 2_400;
  if (club.includes("wood") || club.includes("hybrid")) return 3_400;
  if (club.includes("wedge")) return 8_200;
  if (club.includes("iron")) return 5_400;
  if (club.includes("putter")) return 150;
  return 4_200;
}

function nearestFrameVelocity(frames: CourseTwinSimulationFrame[], timeS: number) {
  if (frames.length === 0) return { x: 0, y: 0, z: 0 };
  return frames.reduce((nearest, candidate) =>
    Math.abs(candidate.timeS - timeS) < Math.abs(nearest.timeS - timeS) ? candidate : nearest,
  ).velocity;
}

function isPenaltySurface(surface: CourseTwinSurface) {
  return surface === "water" || surface === "out_of_bounds";
}

function lerpVector(
  left: CourseTwinVector3,
  right: CourseTwinVector3,
  ratio: number,
): CourseTwinVector3 {
  return {
    x: left.x + (right.x - left.x) * ratio,
    y: left.y + (right.y - left.y) * ratio,
    z: left.z + (right.z - left.z) * ratio,
  };
}

function frame(
  timeS: number,
  position: CourseTwinVector3,
  velocity: CourseTwinVector3,
  phase: CourseTwinShotPhase,
  surface: CourseTwinSurface,
): CourseTwinSimulationFrame {
  return { timeS, position: { ...position }, velocity: { ...velocity }, phase, surface };
}

function initialSpinVector(
  direction: { x: number; z: number },
  backSpinRpm: number,
  sideSpinRpm: number,
) {
  const rpmToRadiansPerSecond = (2 * Math.PI) / 60;
  const backSpin = backSpinRpm * rpmToRadiansPerSecond;
  const sideSpin = sideSpinRpm * rpmToRadiansPerSecond;
  return {
    x: -direction.z * backSpin,
    y: sideSpin,
    z: direction.x * backSpin,
  };
}

function terrainNormal(groundHeight: (x: number, z: number) => number, x: number, z: number) {
  const sampleDistance = 0.5;
  const gradientX =
    (groundHeight(x + sampleDistance, z) - groundHeight(x - sampleDistance, z)) /
    (2 * sampleDistance);
  const gradientZ =
    (groundHeight(x, z + sampleDistance) - groundHeight(x, z - sampleDistance)) /
    (2 * sampleDistance);
  return normalize({ x: -gradientX, y: 1, z: -gradientZ });
}

function validateShotInput(input: CourseTwinShotInput) {
  const values = [
    input.position.x,
    input.position.y,
    input.position.z,
    input.direction.x,
    input.direction.z,
    input.ballSpeedMps,
    input.launchAngleDeg,
    input.backSpinRpm,
    input.sideSpinRpm ?? 0,
  ];
  if (!values.every(Number.isFinite)) throw new Error("Course Twin shot input must be finite.");
  if (input.ballSpeedMps <= 0 || input.ballSpeedMps > 110) {
    throw new Error("Ball speed must be between 0 and 110 m/s.");
  }
  if (input.launchAngleDeg < -10 || input.launchAngleDeg > 70) {
    throw new Error("Launch angle is outside the supported range.");
  }
  if (Math.hypot(input.direction.x, input.direction.z) < 0.0001) {
    throw new Error("Shot direction must have a horizontal magnitude.");
  }
}

function horizontalDistance(left: CourseTwinVector3, right: CourseTwinVector3) {
  return Math.hypot(right.x - left.x, right.z - left.z);
}

function rotate2d(x: number, z: number, radians: number) {
  return {
    x: x * Math.cos(radians) - z * Math.sin(radians),
    z: x * Math.sin(radians) + z * Math.cos(radians),
  };
}

function normalize2d(x: number, z: number) {
  const length = Math.hypot(x, z);
  return { x: x / length, z: z / length };
}

function add(left: CourseTwinVector3, right: CourseTwinVector3): CourseTwinVector3 {
  return { x: left.x + right.x, y: left.y + right.y, z: left.z + right.z };
}

function subtract(left: CourseTwinVector3, right: CourseTwinVector3): CourseTwinVector3 {
  return { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z };
}

function multiply(vector: CourseTwinVector3, scalar: number): CourseTwinVector3 {
  return { x: vector.x * scalar, y: vector.y * scalar, z: vector.z * scalar };
}

function dot(left: CourseTwinVector3, right: CourseTwinVector3) {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function cross(left: CourseTwinVector3, right: CourseTwinVector3): CourseTwinVector3 {
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x,
  };
}

function magnitude(vector: CourseTwinVector3) {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function normalize(vector: CourseTwinVector3) {
  const length = magnitude(vector) || 1;
  return multiply(vector, 1 / length);
}

function degreesToRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
