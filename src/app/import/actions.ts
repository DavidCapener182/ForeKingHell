"use server";

import {
  type SaveRapsodoImportInput,
  saveRapsodoImport,
  saveRapsodoImportBatch,
} from "@/lib/imports/save-rapsodo-import";
import { setAchievementUnlockFlash } from "@/lib/achievements/notification-flash";

export async function saveRapsodoImportAction(input: SaveRapsodoImportInput) {
  const result = await saveRapsodoImport(input);

  if (result.ok) {
    await setAchievementUnlockFlash(result.achievementUnlockNotifications);
  }

  return result;
}

export async function saveRapsodoImportBatchAction(inputs: SaveRapsodoImportInput[]) {
  const result = await saveRapsodoImportBatch(inputs);

  if (result.ok) {
    await setAchievementUnlockFlash(result.achievementUnlockNotifications);
  }

  return result;
}
