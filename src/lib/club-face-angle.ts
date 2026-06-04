type FaceAngleInput = {
  faceAngleDeg?: number | null;
  launchDirectionDeg?: number | null;
  clubPathDeg?: number | null;
};

const FACE_DIRECTION_WEIGHT = 0.8;
const CLUB_PATH_WEIGHT = 0.2;

export function calculateClubFaceAngleDeg(
  launchDirectionDeg: number | null | undefined,
  clubPathDeg: number | null | undefined,
) {
  if (!isFiniteNumber(launchDirectionDeg) || !isFiniteNumber(clubPathDeg)) {
    return null;
  }

  // Standard wood-impact approximation: launch direction ~= face * 0.8 + path * 0.2.
  return roundOne((launchDirectionDeg - clubPathDeg * CLUB_PATH_WEIGHT) / FACE_DIRECTION_WEIGHT);
}

export function resolveClubFaceAngleDeg(input: FaceAngleInput) {
  if (isFiniteNumber(input.faceAngleDeg)) {
    return input.faceAngleDeg;
  }

  return calculateClubFaceAngleDeg(input.launchDirectionDeg, input.clubPathDeg);
}

export function calculateFaceToPathDeg(input: FaceAngleInput) {
  const faceAngleDeg = resolveClubFaceAngleDeg(input);

  if (!isFiniteNumber(faceAngleDeg) || !isFiniteNumber(input.clubPathDeg)) {
    return null;
  }

  return roundOne(faceAngleDeg - input.clubPathDeg);
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function roundOne(value: number) {
  return Math.round((value + 1e-9) * 10) / 10;
}
