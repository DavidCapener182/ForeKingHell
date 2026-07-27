import type {
  CourseTwinFeature,
  CourseTwinManifest,
  CourseTwinPoint,
} from "@/lib/course-twin-contract";

export type CourseTwinCorrectionInput = {
  id: string;
  correctionType: "feature_upsert" | "feature_delete" | "hole_tee" | "hole_green";
  targetReference: string;
  correctionJson: Record<string, unknown>;
};

export function applyCourseTwinCorrections(
  source: CourseTwinManifest,
  corrections: CourseTwinCorrectionInput[],
) {
  const manifest = structuredClone(source);
  const appliedCorrectionIds: string[] = [];
  for (const correction of corrections) {
    if (correction.correctionType === "feature_delete") {
      const before = manifest.features.length;
      manifest.features = manifest.features.filter(
        (feature) => feature.id !== correction.targetReference,
      );
      if (manifest.features.length === before) {
        throw new Error(`Correction target feature ${correction.targetReference} was not found.`);
      }
    } else if (correction.correctionType === "feature_upsert") {
      const feature = parseFeatureCorrection(correction);
      const index = manifest.features.findIndex(
        (candidate) => candidate.id === correction.targetReference,
      );
      if (index >= 0) manifest.features[index] = feature;
      else manifest.features.push(feature);
    } else {
      const holeNumber = parseHoleTarget(correction.targetReference);
      const hole = manifest.holes.find((candidate) => candidate.holeNumber === holeNumber);
      if (!hole) throw new Error(`Correction target hole ${holeNumber} was not found.`);
      const point = parsePoint(correction.correctionJson.point, "point");
      if (correction.correctionType === "hole_tee") {
        hole.tee = point;
        hole.centerline[0] = point;
      } else {
        hole.green = point;
        hole.centerline[hole.centerline.length - 1] = point;
      }
    }
    appliedCorrectionIds.push(correction.id);
  }
  manifest.quality = {
    ...manifest.quality,
    verified: false,
    mappedFeatures: manifest.features.length,
    warnings: [
      ...manifest.quality.warnings.filter(
        (warning) => !warning.startsWith("Manual QA corrections applied:"),
      ),
      `Manual QA corrections applied: ${appliedCorrectionIds.length}. Rebuild requires reviewer validation before publication.`,
    ],
  };
  return { manifest, appliedCorrectionIds };
}

export function validateCourseTwinCorrectionBody(value: unknown) {
  if (!isRecord(value)) throw new Error("Correction body must be an object.");
  const correctionType = value.correctionType;
  if (
    !(["feature_upsert", "feature_delete", "hole_tee", "hole_green"] as unknown[]).includes(
      correctionType,
    )
  ) {
    throw new Error("Correction type is unsupported.");
  }
  if (
    typeof value.targetReference !== "string" ||
    value.targetReference.length < 1 ||
    value.targetReference.length > 160
  ) {
    throw new Error("Correction target is invalid.");
  }
  if (
    typeof value.reason !== "string" ||
    value.reason.trim().length < 5 ||
    value.reason.length > 2_000
  ) {
    throw new Error("Correction reason must be between 5 and 2,000 characters.");
  }
  if (!isRecord(value.correctionJson)) throw new Error("Correction payload must be an object.");
  const correction = {
    correctionType: correctionType as CourseTwinCorrectionInput["correctionType"],
    targetReference: value.targetReference,
    reason: value.reason.trim(),
    correctionJson: value.correctionJson,
  };
  if (correction.correctionType === "feature_upsert") {
    parseFeatureCorrection({ id: "validation", ...correction });
  }
  if (correction.correctionType === "hole_tee" || correction.correctionType === "hole_green") {
    parseHoleTarget(correction.targetReference);
    parsePoint(correction.correctionJson.point, "point");
  }
  return correction;
}

function parseFeatureCorrection(correction: CourseTwinCorrectionInput): CourseTwinFeature {
  const payload = correction.correctionJson;
  const allowedTypes: CourseTwinFeature["type"][] = [
    "tee",
    "fairway",
    "green",
    "bunker",
    "water",
    "rough",
    "trees",
    "course_boundary",
  ];
  if (!allowedTypes.includes(payload.type as CourseTwinFeature["type"])) {
    throw new Error("Corrected feature type is invalid.");
  }
  if (!Array.isArray(payload.rings) || payload.rings.length === 0) {
    throw new Error("Corrected feature requires at least one polygon ring.");
  }
  const rings = payload.rings.map((ring, ringIndex) => {
    if (!Array.isArray(ring) || ring.length < 4 || ring.length > 20_000) {
      throw new Error(`Corrected feature ring ${ringIndex} is invalid.`);
    }
    const points = ring.map((point, pointIndex) =>
      parsePoint(point, `rings.${ringIndex}.${pointIndex}`),
    );
    const first = points[0];
    const last = points.at(-1);
    if (!last || first[0] !== last[0] || first[2] !== last[2]) {
      throw new Error(`Corrected feature ring ${ringIndex} must be closed.`);
    }
    return points;
  });
  const holeNumber = payload.holeNumber;
  if (
    holeNumber !== null &&
    holeNumber !== undefined &&
    (!Number.isInteger(holeNumber) || Number(holeNumber) < 1 || Number(holeNumber) > 54)
  ) {
    throw new Error("Corrected feature hole number is invalid.");
  }
  return {
    id: correction.targetReference,
    holeNumber: holeNumber == null ? null : Number(holeNumber),
    type: payload.type as CourseTwinFeature["type"],
    rings,
    source: "manual_qa_correction",
  };
}

function parsePoint(value: unknown, field: string): CourseTwinPoint {
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    value.some((coordinate) => typeof coordinate !== "number" || !Number.isFinite(coordinate))
  ) {
    throw new Error(`Correction ${field} must be a finite local [x, elevation, z] point.`);
  }
  const [x, elevation, z] = value;
  if (Math.abs(x) > 50_000 || Math.abs(z) > 50_000 || Math.abs(elevation) > 10_000) {
    throw new Error(`Correction ${field} is outside supported local bounds.`);
  }
  return [x, elevation, z];
}

function parseHoleTarget(value: string) {
  const match = /^hole:(\d{1,2})$/.exec(value);
  const holeNumber = match ? Number(match[1]) : 0;
  if (holeNumber < 1 || holeNumber > 54)
    throw new Error("Hole correction target must use hole:<number>.");
  return holeNumber;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
