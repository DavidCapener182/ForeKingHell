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
