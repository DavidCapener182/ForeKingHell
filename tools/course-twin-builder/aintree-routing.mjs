// Routing is matched by physical green, never by the unnumbered OSM way order.
// Evidence: official /hole_1 ... /hole_9 photos and descriptions, plus David's
// supplied 3292-yard/par-36 scorecard (2026-09-13). Coordinates are local metres.
const COURSE_ID = "4de11156-16fd-4a36-84e0-fadda53456b0";
export const AINTREE_ROUTING = [
  [1, 9, 549, 5, 3, 80.5108, 94.2212],
  [2, 5, 199, 3, 6, -20.0217, -61.4598],
  [3, 8, 449, 4, 2, 385.1692, -47.6561],
  [4, 4, 146, 3, 8, 406.7412, 86.106],
  [5, 6, 255, 4, 9, 241.1283, 28.4089],
  [6, 2, 206, 3, 5, 368.957, 64.4988],
  [7, 7, 454, 4, 1, 5.1346, -181.4739],
  [8, 3, 428, 5, 7, 211.2216, 146.8311],
  [9, 1, 552, 5, 4, -372.4883, 188.8432],
];
export function correctAintreeRouting(source) {
  if (source.course.id !== COURSE_ID) return source;
  const manifest = structuredClone(source);
  const renumber = new Map();
  const used = new Set();
  manifest.holes = AINTREE_ROUTING.map(([holeNumber, , yards, par, strokeIndex, x, z]) => {
    const hole = source.holes.find((h) => Math.hypot(h.green[0] - x, h.green[2] - z) < 1);
    if (!hole || used.has(hole.holeNumber)) {
      throw new Error(
        `Aintree hole ${holeNumber}: changed source geometry needs a new routing review.`,
      );
    }
    used.add(hole.holeNumber);
    renumber.set(hole.holeNumber, holeNumber);
    const corrected = { ...structuredClone(hole), holeNumber, yards, par, strokeIndex };
    // The old route starts at the alternate par-4 tee. Its next surveyed map
    // vertex lies on OSM tee 1279395014, the par-3 tee visible in the hole-2 photo.
    if (holeNumber === 2 && corrected.centerline.length === 3) {
      corrected.centerline = corrected.centerline.slice(1);
      corrected.tee = corrected.centerline[0];
    }
    return corrected;
  });
  manifest.features = manifest.features.map((feature) => ({
    ...feature,
    holeNumber:
      feature.holeNumber == null ? null : (renumber.get(feature.holeNumber) ?? feature.holeNumber),
  }));
  manifest.puttingSurfaces = manifest.puttingSurfaces.map((surface) => ({
    ...surface,
    holeNumber: renumber.get(surface.holeNumber) ?? surface.holeNumber,
  }));
  manifest.packageVersion = Math.max(2, manifest.packageVersion);
  const note =
    "Aintree routing and scorecard matched to official hole tour and user-supplied card on 2026-09-13. Tee positions remain mapped estimates; card yardages are not surveyed geometry distances.";
  manifest.quality.warnings = [...manifest.quality.warnings.filter((w) => w !== note), note];
  const discrepancy =
    "Supplied Aintree card lists hole 8 as 428 yd: individual yardages total 3238 yd, versus printed 3292 yd. The 54 yd discrepancy requires scorecard verification.";
  manifest.quality.warnings = [
    ...manifest.quality.warnings.filter((w) => w !== discrepancy),
    discrepancy,
  ];
  return manifest;
}
