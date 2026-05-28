export type DispersionCorridorTone = "left" | "target" | "right";

export type DispersionCorridorBucket = {
  id: "far-left" | "left" | "target" | "right" | "far-right";
  label: string;
  tone: DispersionCorridorTone;
  minYd: number;
  maxYd: number;
  count: number;
  percent: number;
  total: number;
};

type BucketDefinition = Omit<DispersionCorridorBucket, "count" | "percent" | "total">;

export function buildDispersionCorridorBuckets(
  sideValues: Array<number | null | undefined>,
  {
    maxSideYd,
    targetSideYd,
  }: {
    maxSideYd: number;
    targetSideYd: number;
  },
): DispersionCorridorBucket[] {
  const values = sideValues.filter(isFiniteNumber);
  const maxSide = Number.isFinite(maxSideYd) ? Math.max(0, maxSideYd) : 0;
  const requestedTargetSide = Number.isFinite(targetSideYd) ? targetSideYd : 0;
  const targetSide = Math.max(0, Math.min(requestedTargetSide, maxSide));
  const middleSide = maxSide / 2;

  if (values.length === 0 || maxSide === 0) {
    return [];
  }

  const definitions =
    middleSide > targetSide
      ? fiveBucketDefinitions(maxSide, middleSide, targetSide)
      : threeBucketDefinitions(maxSide, targetSide);

  const counts = new Map(definitions.map((definition) => [definition.id, 0]));

  for (const value of values) {
    const id = bucketIdForValue(value, middleSide, targetSide);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return definitions.map((definition) => {
    const count = counts.get(definition.id) ?? 0;

    return {
      ...definition,
      count,
      percent: Math.round((count / values.length) * 1000) / 10,
      total: values.length,
    };
  });
}

function fiveBucketDefinitions(
  maxSide: number,
  middleSide: number,
  targetSide: number,
): BucketDefinition[] {
  return [
    {
      id: "far-left",
      label: "Far left",
      tone: "left",
      minYd: -maxSide,
      maxYd: -middleSide,
    },
    {
      id: "left",
      label: "Left edge",
      tone: "left",
      minYd: -middleSide,
      maxYd: -targetSide,
    },
    {
      id: "target",
      label: "Target",
      tone: "target",
      minYd: -targetSide,
      maxYd: targetSide,
    },
    {
      id: "right",
      label: "Right edge",
      tone: "right",
      minYd: targetSide,
      maxYd: middleSide,
    },
    {
      id: "far-right",
      label: "Far right",
      tone: "right",
      minYd: middleSide,
      maxYd: maxSide,
    },
  ];
}

function threeBucketDefinitions(maxSide: number, targetSide: number): BucketDefinition[] {
  return [
    {
      id: "left",
      label: "Left miss",
      tone: "left",
      minYd: -maxSide,
      maxYd: -targetSide,
    },
    {
      id: "target",
      label: "Target",
      tone: "target",
      minYd: -targetSide,
      maxYd: targetSide,
    },
    {
      id: "right",
      label: "Right miss",
      tone: "right",
      minYd: targetSide,
      maxYd: maxSide,
    },
  ];
}

function bucketIdForValue(
  value: number,
  middleSide: number,
  targetSide: number,
): DispersionCorridorBucket["id"] {
  if (middleSide > targetSide) {
    if (value <= -middleSide) return "far-left";
    if (value < -targetSide) return "left";
    if (value <= targetSide) return "target";
    if (value < middleSide) return "right";
    return "far-right";
  }

  if (value < -targetSide) return "left";
  if (value <= targetSide) return "target";
  return "right";
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
