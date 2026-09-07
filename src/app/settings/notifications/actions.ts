"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCurrentUserId } from "@/lib/current-user";
import {
  notificationCategories,
  parseProductPreferences,
  updateProductPreferences,
} from "@/lib/product-preferences";

async function persistNotificationPreferences(formData: FormData) {
  const userId = await requireCurrentUserId();
  const parsed = parseProductPreferences({
    notifications: {
      social: formData.get("legacy_social") === "on",
      challenges: formData.get("legacy_challenges") === "on",
      dataQuality: formData.get("legacy_dataQuality") === "on",
      achievements: formData.get("legacy_achievements") === "on",
      weeklyReview: formData.get("legacy_weeklyReview") === "on",
      delivery: Object.fromEntries(
        notificationCategories.map((category) => [category, formData.get(category)]),
      ),
    },
  });

  await updateProductPreferences(userId, { notifications: parsed.notifications });
  revalidatePath("/settings");
  revalidatePath("/settings/notifications");
  revalidatePath("/api/desktop-workbench/notifications");
}

export async function saveNotificationPreferencesAction(formData: FormData) {
  await persistNotificationPreferences(formData);
  const returnToSettingsSection = formData.get("settingsReturnTo") === "section";
  redirect(
    returnToSettingsSection
      ? "/settings?section=notifications&saved=1"
      : "/settings/notifications?saved=1",
  );
}

export async function saveNotificationPreferencesFormAction(
  _previous: { ok: boolean; error?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await persistNotificationPreferences(formData);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save notifications. Try again.",
    };
  }
}
