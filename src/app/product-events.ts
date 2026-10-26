"use server";
import { recordUsageEvent } from "@/lib/billing";
const events = new Set([
  "import_limit_warning_shown",
  "import_limit_reached",
  "import_upgrade_cta_clicked",
  "pro_trial_offer_shown",
  "pro_trial_offer_dismissed",
  "course_twin_plan_opened",
  "course_twin_plan_hole_viewed",
  "course_twin_plan_upgrade_shown",
]);
/** Client may record only UI impressions; billing activation remains webhook-only. */
export async function recordProductImpression(eventType: string, source: string) {
  if (
    typeof eventType !== "string" ||
    typeof source !== "string" ||
    !events.has(eventType) ||
    source.length > 120
  )
    throw new Error("Unknown product event");
  await recordUsageEvent({ eventType, metadataJson: { source } });
}
