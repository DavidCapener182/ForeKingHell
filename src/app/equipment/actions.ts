"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ballModels, clubEquipmentHistory, clubs } from "@/db/schema";
import { getDb } from "@/db/client";
import { normalizeEquipmentHistory } from "@/lib/equipment-history";
import { requireCurrentUserId } from "@/lib/current-user";

export async function createBallModelAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const brand = nullableString(formData, "brand");
  const model = requiredString(formData, "model");
  const db = getDb();

  await db
    .insert(ballModels)
    .values({
      userId,
      brand,
      model,
      active: true,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [ballModels.userId, ballModels.brand, ballModels.model],
      set: {
        active: true,
        updatedAt: new Date(),
      },
    });

  revalidatePath("/equipment");
  redirect("/equipment?saved=ball");
}

export async function saveEquipmentHistoryAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const clubId = requiredString(formData, "clubId");
  const db = getDb();
  const [club] = await db
    .select({ id: clubs.id })
    .from(clubs)
    .where(and(eq(clubs.id, clubId), eq(clubs.userId, userId)))
    .limit(1);

  if (!club) {
    throw new Error("Club not found for this account.");
  }

  const normalized = normalizeEquipmentHistory({
    effectiveFrom: nullableString(formData, "effectiveFrom"),
    effectiveTo: nullableString(formData, "effectiveTo"),
    loftDeg: nullableNumber(formData, "loftDeg"),
    lieDeg: nullableNumber(formData, "lieDeg"),
    shaft: nullableString(formData, "shaft"),
    swingWeight: nullableString(formData, "swingWeight"),
    notes: nullableString(formData, "notes"),
  });
  const ballModelId = nullableString(formData, "ballModelId");
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(clubEquipmentHistory)
      .set({
        effectiveTo: normalized.effectiveFrom,
        updatedAt: now,
      })
      .where(
        and(
          eq(clubEquipmentHistory.userId, userId),
          eq(clubEquipmentHistory.clubId, clubId),
          isNull(clubEquipmentHistory.effectiveTo),
        ),
      );

    await tx.insert(clubEquipmentHistory).values({
      userId,
      clubId,
      ballModelId,
      ...normalized,
      updatedAt: now,
    });
  });

  revalidatePath("/equipment");
  revalidatePath("/bag");
  redirect("/equipment?saved=spec");
}

function requiredString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} is required.`);
  }

  return value.trim();
}

function nullableString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nullableNumber(formData: FormData, key: string) {
  const value = nullableString(formData, key);

  if (value === null) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
