import { createHash } from "node:crypto";
import type { PracticePlan, PracticeSessionType } from "@/lib/practice-planner";
import { summarizeStrokesGained } from "@/lib/strokes-gained";
export type SgPracticeCategory = "tee" | "approach" | "short_game" | "putting";
export type SgPracticeEvent = {
  id: string;
  sessionId: string;
  category: string;
  strokesGained: number | null;
};
export type SgPracticeSource = {
  category: SgPracticeCategory;
  eventIds: string[];
  sessionIds: string[];
  sampleSize: number;
  pendingCount: number;
  total: number | null;
  fingerprint: string;
};
const prescriptions = {
  tee: {
    label: "Tee",
    balls: 10,
    sessionType: "range",
    drill:
      "Hit 10 driver or tee-club shots with a hard fairway boundary. Track start line, side miss, and whether the next shot is playable.",
    target:
      "10 tee shots: record start line, side miss and next-shot playability against the chosen fairway boundary.",
  },
  approach: {
    label: "Approach",
    balls: 9,
    sessionType: "range",
    drill:
      "Build a 9-shot approach ladder from your common yardages. Score each shot by green, safe-side miss, and short-side miss.",
    target:
      "9 approach shots: record green, safe-side miss or short-side miss at your common yardages.",
  },
  short_game: {
    label: "Short game",
    balls: 12,
    sessionType: "short_game",
    drill:
      "Practise 12 chips from one landing spot and one rough lie. Track shots inside 10 feet and the miss that leaves the next shot hardest.",
    target: "12 chips: record finishes inside 10 feet and the hardest next-shot miss.",
  },
  putting: {
    label: "Putting",
    balls: null,
    sessionType: "putting",
    drill:
      "Add first-putt distance and finish distance for each green, then practise 3, 6, and 10 foot start-line gates.",
    target:
      "Record first-putt and finish distances, then practise start-line gates at 3, 6 and 10 feet.",
  },
} satisfies Record<
  SgPracticeCategory,
  {
    label: string;
    balls: number | null;
    sessionType: PracticeSessionType;
    drill: string;
    target: string;
  }
>;
export function sgPracticePrescription(category: string | undefined) {
  if (!category || !Object.hasOwn(prescriptions, category)) return null;
  const key = category as SgPracticeCategory;
  return { category: key, ...prescriptions[key] };
}
export function sgPracticeFingerprint(category: SgPracticeCategory, events: SgPracticeEvent[]) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        prescription: sgPracticePrescription(category),
        events: events
          .map((e) => ({
            id: e.id,
            sessionId: e.sessionId,
            category: e.category,
            strokesGained: e.strokesGained,
          }))
          .sort((a, b) => a.id.localeCompare(b.id)),
      }),
    )
    .digest("hex");
}
export function sgPracticePlan(
  base: PracticePlan,
  category: SgPracticeCategory,
  events: SgPracticeEvent[],
): PracticePlan {
  const prescription = sgPracticePrescription(category)!;
  if (!events.length || events.some((event) => event.category !== category))
    throw new Error("Review the selected category evidence again.");
  const summary = summarizeStrokesGained(events.map((event) => event.strokesGained));
  const source: SgPracticeSource = {
    category,
    eventIds: events.map((e) => e.id),
    sessionIds: [...new Set(events.map((e) => e.sessionId))],
    sampleSize: summary.sampleSize,
    pendingCount: events.length - summary.sampleSize,
    total: summary.total,
    fingerprint: sgPracticeFingerprint(category, events),
  };
  const rationale = `${prescription.label} scope: ${source.sampleSize} calculated mapped events, ${source.pendingCount} pending. ${source.total === null ? "SG is unjudged." : `${source.total} strokes gained across this mapped sample.`} This is not a complete-round SG claim.`;
  return {
    ...base,
    sessionType: prescription.sessionType,
    title: `${prescription.label}: focused scoring practice`,
    summary: prescription.drill,
    totalBalls: prescription.balls,
    estimatedTimeMinutes: 15,
    intent: "scoring",
    focusClubs: [],
    confidenceLabel: "Low",
    why: [rationale],
    blocks: [
      {
        id: "sg-category",
        order: 1,
        type:
          category === "putting" ? "putting" : category === "short_game" ? "short_game" : "scoring",
        title: `Main priority: ${prescription.label}`,
        clubs: [],
        ballCount: prescription.balls,
        timeMinutes: 15,
        purpose: rationale,
        drill: prescription.drill,
        successTarget: prescription.target,
        recordPrompt:
          "Record these observations in your notes. Launch-monitor shots alone cannot judge this category task; completion does not prove improvement.",
        scoringRules: {
          metric: "sg_category_observations",
          target: prescription.balls ?? 1,
          evidenceMode: "manual",
        },
      },
    ],
    postSessionRules: [
      "Retain the observed results and source scope. This task has no automatic measured pass/fail; complete mapped scoring evidence is needed to judge strokes-gained change.",
    ],
    generation: {
      ...base.generation,
      label: "Strokes-gained category",
      prescriptionConfidence: "Low",
      note: rationale,
      sgHandoff: source,
    },
  };
}
export function parseSgPracticeSource(value: unknown): SgPracticeSource | undefined {
  if (!value || typeof value !== "object") return undefined;
  const s = value as Record<string, unknown>;
  if (
    !sgPracticePrescription(String(s.category)) ||
    !Array.isArray(s.eventIds) ||
    !s.eventIds.length ||
    s.eventIds.length > 200 ||
    !s.eventIds.every((id) => typeof id === "string" && /^[a-f0-9-]{36}$/i.test(id)) ||
    !Array.isArray(s.sessionIds) ||
    !s.sessionIds.every((id) => typeof id === "string" && /^[a-f0-9-]{36}$/i.test(id)) ||
    !Number.isInteger(s.sampleSize) ||
    Number(s.sampleSize) < 0 ||
    !Number.isInteger(s.pendingCount) ||
    Number(s.pendingCount) < 0 ||
    Number(s.sampleSize) + Number(s.pendingCount) !== s.eventIds.length ||
    !(s.total === null || (typeof s.total === "number" && Number.isFinite(s.total))) ||
    typeof s.fingerprint !== "string" ||
    !/^[a-f0-9]{64}$/.test(s.fingerprint)
  )
    return undefined;
  return s as SgPracticeSource;
}
