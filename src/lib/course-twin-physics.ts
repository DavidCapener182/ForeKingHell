import type { CourseTwinSurface } from "@/lib/course-twin-surface";

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
