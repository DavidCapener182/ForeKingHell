import type { CourseTwinManifest } from "./course-twin-contract";
import { buildCourseTwinStrategy, type CourseTwinBagProfile } from "./course-twin-strategy";
import {
  mobileCourseTwinPlanOptions,
  mobilePlanHasMappedSurfaces,
  modelledHazardChance,
  type MobilePlanIntent,
} from "./course-twin-mobile-plan";
import type { RoundPlanHole } from "./course-twin-round-plan-model";

/** Uses only existing simulated options; missing geometry and options stay unavailable. */
export function assembleRoundPlan(
  manifest: CourseTwinManifest,
  bag: CourseTwinBagProfile[],
  intent: MobilePlanIntent,
): RoundPlanHole[] {
  return Array.from({ length: 18 }, (_, i) => {
    const holeNumber = i + 1;
    const hole = manifest.holes.find((h) => h.holeNumber === holeNumber);
    const valid =
      hole &&
      [...hole.tee, ...hole.green, ...hole.centerline.flat()].every(Number.isFinite) &&
      hole.centerline.length >= 2;
    const document = valid ? buildCourseTwinStrategy({ manifest, bag, holeNumber }) : null;
    const selected = document ? mobileCourseTwinPlanOptions(document)[intent] : null;
    return {
      holeNumber,
      intent,
      status: selected ? "ready" : "unavailable",
      clubId: selected?.clubId ?? null,
      clubType: selected?.clubType ?? null,
      carryMedianYd: selected?.carryMedianYd ?? null,
      confidence: selected?.confidence ?? null,
      hazardChance: selected ? modelledHazardChance(selected) : null,
      modelVersion: "dispersion-monte-carlo-v1",
      disclosure: [
        document?.disclosure ?? "Hole geometry unavailable.",
        mobilePlanHasMappedSurfaces(manifest, holeNumber)
          ? ""
          : "Estimated outline — treat hazards cautiously.",
      ]
        .filter(Boolean)
        .join(" "),
      reason: selected
        ? null
        : valid
          ? "No measured option for this intent."
          : "Hole geometry unavailable.",
    };
  });
}
