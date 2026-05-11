"use server";

import { revalidatePath } from "next/cache";

import { evaluateCoachDrillAchievementsForDefaultUser } from "@/lib/coach-drill-awards";

export async function syncCoachDrillsAction() {
  const result = await evaluateCoachDrillAchievementsForDefaultUser();

  revalidatePath("/coach");
  revalidatePath("/achievements");

  return {
    notifications: result.notifications,
  };
}
