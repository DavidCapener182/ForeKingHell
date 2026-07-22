"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCurrentUserId } from "@/lib/current-user";
import {
  notificationCategories,
  parseProductPreferences,
  updateProductPreferences,
} from "@/lib/product-preferences";

export async function saveNotificationPreferencesAction(formData: FormData) {
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
  revalidatePath("/settings/notifications");
  revalidatePath("/api/desktop-workbench/notifications");
  redirect("/settings/notifications?saved=1");
}
