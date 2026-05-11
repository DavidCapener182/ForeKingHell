"use server";

import { syncAchievementsForDefaultUser } from "@/lib/achievements/service";

export async function syncAchievementsAction() {
  return syncAchievementsForDefaultUser();
}
