import { createHash } from "node:crypto";
import type { PracticePlan } from "@/lib/practice-planner";
import type { RangeRealityHandicapData, PracticePrescriptionItem } from "@/lib/reality-handicap";
export type SimulatorPracticeSource = {
  prescriptionId: string;
  clubType: string | null;
  shotIds: string[];
  sessionIds: string[];
  sampleSize: number;
  fingerprint: string;
};
const counts: Record<string, number> = { "primary-club": 12, "secondary-club": 15, transfer: 9 };
export function simulatorPracticeFingerprint(
  reality: RangeRealityHandicapData,
  prescriptionId: string,
) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        prescription: reality.prescriptions.find((item) => item.id === prescriptionId),
        evidence: reality.evidence,
        estimate: reality.estimate,
        bagTruth: reality.bagTruth,
      }),
    )
    .digest("hex");
}
export function simulatorPracticePlan(
  base: PracticePlan,
  reality: RangeRealityHandicapData,
  item: PracticePrescriptionItem,
): PracticePlan {
  const evidence = reality.evidence;
  const balls = counts[item.id];
  if (!evidence?.sampleSize || !balls || !reality.prescriptions.some((p) => p.id === item.id))
    throw new Error("Review the range evidence again before saving this prescription.");
  const source: SimulatorPracticeSource = {
    ...evidence,
    prescriptionId: item.id,
    clubType: item.clubType,
    fingerprint: simulatorPracticeFingerprint(reality, item.id),
  };
  const note = `Simulator Lab prescription from ${evidence.sampleSize} usable range shots (${reality.estimate.confidenceLabel} model confidence). Launch-monitor estimate; completion does not prove improvement.`;
  const confidenceLabel =
    reality.estimate.confidence === "high"
      ? "High"
      : reality.estimate.confidence === "medium"
        ? "Medium"
        : "Low";
  return {
    ...base,
    sessionType: "range",
    confidenceLabel,
    intent: "scoring",
    title: item.title,
    summary: item.drill,
    totalBalls: balls,
    estimatedTimeMinutes: 15,
    focusClubs: item.clubType ? [item.clubType] : [],
    why: [item.detail, note],
    blocks: [
      {
        id: "simulator-prescription",
        order: 1,
        type: "scoring",
        title: `Main priority: ${item.title}`,
        clubs: item.clubType ? [item.clubType] : [],
        ballCount: balls,
        timeMinutes: 15,
        purpose: item.detail,
        drill: item.drill,
        successTarget: item.drill,
        recordPrompt:
          "Record the called target, playable carry and reset observations manually. The saved range sample alone cannot judge this drill.",
        scoringRules: {
          metric: "simulator_prescription_observations",
          target: balls,
          evidenceMode: "manual",
        },
      },
    ],
    postSessionRules: [
      "Keep the actual drill observations. Completing the task is not a measured improvement or official handicap result.",
    ],
    generation: {
      ...base.generation,
      label: "Simulator Lab prescription",
      note,
      simulatorHandoff: source,
      prescriptionConfidence: confidenceLabel,
    },
  };
}
export function parseSimulatorPracticeSource(value: unknown): SimulatorPracticeSource | undefined {
  if (!value || typeof value !== "object") return undefined;
  const source = value as Record<string, unknown>;
  const validIds = (ids: unknown): ids is string[] =>
    Array.isArray(ids) &&
    ids.length > 0 &&
    ids.length <= 1000 &&
    new Set(ids).size === ids.length &&
    ids.every(
      (id) => typeof id === "string" && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id),
    );
  if (
    typeof source.prescriptionId !== "string" ||
    !Object.hasOwn(counts, source.prescriptionId) ||
    !(source.clubType === null || typeof source.clubType === "string") ||
    !validIds(source.shotIds) ||
    !validIds(source.sessionIds) ||
    source.sampleSize !== source.shotIds.length ||
    typeof source.fingerprint !== "string" ||
    !/^[a-f0-9]{64}$/.test(source.fingerprint)
  )
    return undefined;
  return {
    prescriptionId: source.prescriptionId,
    clubType: source.clubType,
    shotIds: source.shotIds,
    sessionIds: source.sessionIds,
    sampleSize: source.shotIds.length,
    fingerprint: source.fingerprint,
  };
}
