"use server";

import { redirect } from "next/navigation";

import {
  defaultProfileVisibilitySettings,
  parseVisibility,
  updateCurrentSocialProfile,
} from "@/lib/social";

export async function updateSocialProfileAction(formData: FormData) {
  await updateCurrentSocialProfile({
    username: formString(formData, "username") ?? "",
    displayName: formString(formData, "displayName") ?? "",
    avatarUrl: formString(formData, "avatarUrl"),
    bio: formString(formData, "bio"),
    homeCourse: formString(formData, "homeCourse"),
    primaryLaunchMonitor: formString(formData, "primaryLaunchMonitor"),
    handicapBand: formString(formData, "handicapBand"),
    publicProfile: formData.get("publicProfile") === "on",
    friendProfile: formData.get("friendProfile") === "on",
    feedVisibilityDefault: parseVisibility(formData.get("feedVisibilityDefault"), "private"),
    leaderboardVisibility: parseVisibility(formData.get("leaderboardVisibility"), "private"),
    visibilitySettingsJson: {
      ...defaultProfileVisibilitySettings(),
      rounds: parseVisibility(formData.get("roundsVisibility"), "private"),
      pbs: parseVisibility(formData.get("pbsVisibility"), "friends"),
      bag: parseVisibility(formData.get("bagVisibility"), "private"),
      achievements: parseVisibility(formData.get("achievementsVisibility"), "friends"),
      handicap: parseVisibility(formData.get("handicapVisibility"), "private"),
      practice: parseVisibility(formData.get("practiceVisibility"), "friends"),
      exactShots: parseVisibility(formData.get("exactShotsVisibility"), "private"),
    },
  });

  redirect("/profile?saved=1");
}

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
