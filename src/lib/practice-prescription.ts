export type PracticeWeakness = "direction" | "distance" | "strike" | "speed" | "baseline";

export function buildPracticePrescription(input: {
  clubLabel: string;
  weakness: PracticeWeakness;
  evidence: string;
  sampleSize: number;
}) {
  const plan = prescriptionFor(input.weakness);
  return {
    goal: `${plan.goal} with ${input.clubLabel}`,
    clubs: [input.clubLabel],
    shots: input.sampleSize < 10 ? 12 : 20,
    targetWindow: plan.targetWindow,
    resetCadence: "Step away and reset after every five shots.",
    successThreshold: plan.successThreshold,
    stopCondition: plan.stopCondition,
    metricsToReview: plan.metrics,
    evidence: input.evidence,
    confidence:
      input.sampleSize < 10 ? "early signal" : input.sampleSize < 30 ? "developing" : "reliable",
  };
}

function prescriptionFor(weakness: PracticeWeakness) {
  if (weakness === "direction")
    return {
      goal: "Tighten the start-line and landing-side pattern",
      targetWindow: "A 20-yard-wide landing corridor centred on the target line.",
      successThreshold:
        "At least 7 of the final 10 shots finish inside the corridor without a two-way miss.",
      stopCondition:
        "Stop if three consecutive shots miss the same boundary by more than 15 yards.",
      metrics: ["offline bias", "offline IQR", "two-way miss"],
    };
  if (weakness === "distance")
    return {
      goal: "Build a dependable carry window",
      targetWindow: "A 12-yard carry window around the current personal median.",
      successThreshold: "At least 7 of the final 10 trusted shots finish inside the carry window.",
      stopCondition: "Stop if strike quality drops for three consecutive shots.",
      metrics: ["carry median", "carry IQR", "strike quality"],
    };
  if (weakness === "strike")
    return {
      goal: "Stabilise strike before adding speed",
      targetWindow: "Maintain the current carry median while narrowing smash-factor variation.",
      successThreshold: "Finish a 10-shot block with no more than two low-strike outliers.",
      stopCondition: "Stop after three consecutive low-strike results and reset on another day.",
      metrics: ["smash factor", "ball speed", "carry IQR"],
    };
  if (weakness === "speed")
    return {
      goal: "Add speed without losing strike or direction",
      targetWindow: "Beat current median speed while keeping the normal carry and offline windows.",
      successThreshold:
        "Five of the final eight swings beat median speed without leaving either window.",
      stopCondition: "Stop when speed falls on three swings or the miss becomes two-way.",
      metrics: ["ball speed", "smash factor", "offline IQR"],
    };
  return {
    goal: "Record a clean personal baseline",
    targetWindow: "Use one target, one stock intention and the same reset routine.",
    successThreshold: "Complete at least 12 trusted, comparable shots.",
    stopCondition: "Stop if conditions or intent change enough to make the sample incomparable.",
    metrics: ["sample size", "carry median", "offline median"],
  };
}
