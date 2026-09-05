import type { SpeedDevelopmentSummary } from "@/lib/speed-development";
type Plan = SpeedDevelopmentSummary["plan"];
export type MobileSpeedBlock = Plan["blocks"][number] & { warmup: boolean };

/** Present the existing prescription in phone-sized stages without adding swings or maximum work. */
export function mobileSpeedBlocks(plan: Plan): MobileSpeedBlock[] {
  return plan.blocks.flatMap((block) => {
    const warmup = block.key === "warmup" || plan.mode !== "speed";
    if (
      plan.mode === "speed" &&
      block.key === "warmup" &&
      block.reps === 6 &&
      block.target === "70 → 80 → 90%"
    ) {
      return [
        {
          ...block,
          reps: 3,
          target: "70 → 80%",
          instruction: "Begin your progressive rehearsals. No maximum effort yet.",
          warmup: true,
        },
        {
          ...block,
          key: "build",
          label: "Build",
          reps: 3,
          target: "Build to 90%",
          instruction: "Continue the progressive swings before maximum effort. Fast, never forced.",
          warmup: true,
        },
      ];
    }
    const label =
      block.key === "speed-1"
        ? "Max intent · Set 1"
        : block.key === "speed-2"
          ? "Max intent · Set 2"
          : block.key === "speed"
            ? "Build speed"
            : block.key === "transfer"
              ? "Transfer to ball"
              : block.key === "finish"
                ? "Cool-down · course rhythm"
                : block.label;
    return [{ ...block, label, warmup }];
  });
}

export function restoreMobileSpeedBlock(
  plan: Plan,
  draft: { block?: unknown; blockKey?: unknown; version?: unknown },
) {
  const blocks = mobileSpeedBlocks(plan);
  const index = typeof draft.block === "number" && Number.isInteger(draft.block) ? draft.block : 0;
  const key = typeof draft.blockKey === "string" ? draft.blockKey : plan.blocks[index]?.key;
  const found = blocks.findIndex((block) => block.key === key);
  return Math.max(0, found);
}

/** An explicitly failed linked corridor test takes priority over a general speed trend. */
export function mobileSpeedPlanForTransfer({
  plan,
  verdict,
}: {
  plan: Plan;
  verdict: { playabilityPassed: boolean | null } | null;
}): Plan {
  if (verdict?.playabilityPassed !== false || plan.mode !== "speed") return plan;
  return {
    ...plan,
    title: "Driver control and transfer",
    mode: "transfer",
    blocks: plan.blocks.filter((block) => block.key === "warmup" || block.balls !== null),
  };
}
