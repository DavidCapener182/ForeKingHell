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
    avatarUrl: formMediaString(formData, "avatarUrl"),
    headerImageUrl: formMediaString(formData, "headerImageUrl"),
    bio: formString(formData, "bio"),
    homeCourse: formString(formData, "homeCourse"),
    primaryLaunchMonitor: formString(formData, "primaryLaunchMonitor"),
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

function formMediaString(formData: FormData, key: string) {
  const value = formString(formData, key);

  if (!value) {
    return null;
  }

  if (value.length > 700_000) {
    throw new Error("Selected profile photo is too large.");
  }

  if (value.startsWith("/")) {
    return value;
  }

  if (/^data:image\/(jpeg|jpg|png|webp);base64,[a-z0-9+/=]+$/i.test(value)) {
    return value;
  }

  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") {
      return value;
    }
  } catch {
    throw new Error("Profile photos must be selected from an image file or use a valid image URL.");
  }

  throw new Error("Profile photos must be selected from an image file or use a valid image URL.");
}
