"use server";

import { redirect } from "next/navigation";

import { generateSocialSummary, reportSocialTarget } from "@/lib/social-intelligence";
import { parseVisibility } from "@/lib/social";

export async function generateSocialSummaryAction(formData: FormData) {
  await generateSocialSummary({
    summaryType: parseSummaryType(formString(formData, "summaryType")),
    visibility: parseVisibility(formData.get("visibility"), "private"),
  });
  redirect("/social-intelligence?summary=created");
}

export async function reportSocialTargetAction(formData: FormData) {
  await reportSocialTarget({
    targetType: requiredString(formData, "targetType"),
    targetId: requiredString(formData, "targetId"),
    reason: requiredString(formData, "reason"),
    details: formString(formData, "details"),
    reportedUserId: formString(formData, "reportedUserId"),
  });
  redirect("/social-intelligence?report=created");
}

export async function socialIntelligenceFormAction(
  _previous: { ok: boolean; error?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    switch (requiredString(formData, "operation")) {
      case "generate":
        await generateSocialSummary({
          summaryType: parseSummaryType(formString(formData, "summaryType")),
          visibility: parseVisibility(formData.get("visibility"), "private"),
        });
        break;
      case "report":
        await reportSocialTarget({
          targetType: requiredString(formData, "targetType"),
          targetId: requiredString(formData, "targetId"),
          reason: requiredString(formData, "reason"),
          details: formString(formData, "details"),
          reportedUserId: formString(formData, "reportedUserId"),
        });
        break;
      default:
        throw new Error("Unknown recap or report operation.");
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save. Try again.",
    };
  }
}

function parseSummaryType(value: string | null) {
  if (
    value === "friend_comparison" ||
    value === "challenge_coach" ||
    value === "tournament_recap"
  ) {
    return value;
  }

  return "import_recap";
}

function requiredString(formData: FormData, key: string) {
  const value = formString(formData, key);

  if (!value) {
    throw new Error(`${key} is required.`);
  }

  return value;
}

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
