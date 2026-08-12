"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { importFiles } from "@/db/schema";
import { getDb } from "@/db/client";
import { checkImportDuplicate } from "@/lib/imports/check-import-duplicate";
import {
  type SaveRapsodoImportInput,
  saveRapsodoImport,
  saveRapsodoImportBatch,
} from "@/lib/imports/save-rapsodo-import";
import { setAchievementUnlockFlash } from "@/lib/achievements/notification-flash";
import { requireCurrentUserId } from "@/lib/current-user";

export async function checkImportDuplicateAction(rawCsvText: string) {
  const userId = await requireCurrentUserId();
  return checkImportDuplicate(userId, rawCsvText);
}

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

export async function archiveImportFileAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const importFileId = formString(formData, "importFileId");

  if (!importFileId) {
    return;
  }

  await getDb()
    .update(importFiles)
    .set({
      status: "archived",
      updatedAt: new Date(),
    })
    .where(and(eq(importFiles.id, importFileId), eq(importFiles.userId, userId)));

  revalidatePath("/import");
}

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
