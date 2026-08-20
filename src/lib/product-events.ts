export const productWorkflowEvents = [
  "shot_review_completed",
  "practice_plan_saved",
  "practice_plan_started",
  "practice_plan_completed",
  "post_round_review_saved",
  "round_created",
  "personal_export_completed",
] as const;

export type ProductWorkflowEvent = (typeof productWorkflowEvents)[number];

type ProductEventValue = string | number | boolean | null;

const safePropertyKeys = new Set([
  "action",
  "count",
  "source",
  "status",
  "surface",
  "durationMinutes",
  "datasets",
  "hasMore",
  "roundStatus",
  "holeCount",
]);

export function recordProductWorkflowEvent(
  event: ProductWorkflowEvent,
  properties: Record<string, ProductEventValue> = {},
) {
  const safeProperties = Object.fromEntries(
    Object.entries(properties)
      .filter(([key]) => safePropertyKeys.has(key))
      .map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 80) : value]),
  );

  console.info(
    JSON.stringify({
      event: "product_workflow_completed",
      workflow: event,
      properties: safeProperties,
    }),
  );
}
