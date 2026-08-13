"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ballModels, clubEquipmentHistory, clubs, equipmentSnapshots } from "@/db/schema";
import { getDb } from "@/db/client";
import { normalizeEquipmentHistory } from "@/lib/equipment-history";
import { requireCurrentUserId } from "@/lib/current-user";
import { buildEquipmentSnapshotPayload } from "@/lib/witb-snapshots";

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
    const [club] = await tx
      .select({ id: clubs.id })
      .from(clubs)
      .where(and(eq(clubs.id, clubId), eq(clubs.userId, userId)))
      .limit(1);

    if (!club) {
      throw new Error("Club not found for this account.");
    }

    if (ballModelId) {
      const [ball] = await tx
        .select({ id: ballModels.id })
        .from(ballModels)
        .where(and(eq(ballModels.id, ballModelId), eq(ballModels.userId, userId)))
        .limit(1);

      if (!ball) {
        throw new Error("Ball model not found for this account.");
      }
    }

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

export async function retireClubAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const clubId = requiredString(formData, "clubId");
  const db = getDb();
  const now = new Date();

  await db.transaction(async (tx) => {
    const [club] = await tx
      .select({ id: clubs.id, active: clubs.active })
      .from(clubs)
      .where(and(eq(clubs.id, clubId), eq(clubs.userId, userId)))
      .limit(1);

    if (!club) {
      throw new Error("Club not found for this account.");
    }

    if (!club.active) {
      return;
    }

    await tx
      .update(clubs)
      .set({
        active: false,
        updatedAt: now,
      })
      .where(and(eq(clubs.id, clubId), eq(clubs.userId, userId)));

    await tx
      .update(clubEquipmentHistory)
      .set({
        effectiveTo: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(clubEquipmentHistory.userId, userId),
          eq(clubEquipmentHistory.clubId, clubId),
          isNull(clubEquipmentHistory.effectiveTo),
        ),
      );
  });

  revalidatePath("/equipment");
  revalidatePath("/bag");
  revalidatePath("/dashboard");
  revalidatePath("/progress");
  revalidatePath("/rapsodo");
  redirect("/equipment?saved=retired");
}

export async function saveBagOrderAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const clubIds = formData
    .getAll("clubId")
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim());

  if (clubIds.length === 0) {
    throw new Error("No clubs supplied for bag order.");
  }

  const db = getDb();
  const ownedClubs = await db.select({ id: clubs.id }).from(clubs).where(eq(clubs.userId, userId));
  const ownedClubIds = new Set(ownedClubs.map((club) => club.id));
  const uniqueClubIds = [...new Set(clubIds)];

  if (uniqueClubIds.some((clubId) => !ownedClubIds.has(clubId))) {
    throw new Error("Club not found for this account.");
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    for (const clubId of uniqueClubIds) {
      await tx
        .update(clubs)
        .set({
          bagSection: cleanBagSection(formData.get(`bagSection:${clubId}`)),
          bagPosition: cleanBagPosition(formData.get(`bagPosition:${clubId}`)),
          updatedAt: now,
        })
        .where(and(eq(clubs.id, clubId), eq(clubs.userId, userId)));
    }
  });

  revalidateEquipmentSurfaces();
  redirect("/equipment?saved=bag-order");
}

export async function captureEquipmentSnapshotAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const label = nullableString(formData, "label") ?? "Bag snapshot";
  const db = getDb();
  const activeClubs = await db
    .select({
      id: clubs.id,
      type: clubs.type,
      brand: clubs.brand,
      model: clubs.model,
      bagSection: clubs.bagSection,
      bagPosition: clubs.bagPosition,
    })
    .from(clubs)
    .where(and(eq(clubs.userId, userId), eq(clubs.active, true)));

  await db.insert(equipmentSnapshots).values({
    userId,
    label,
    snapshotJson: buildEquipmentSnapshotPayload(activeClubs),
    capturedAt: new Date(),
  });

  revalidateEquipmentSurfaces();
  redirect("/equipment?saved=snapshot");
}

function revalidateEquipmentSurfaces() {
  revalidatePath("/equipment");
  revalidatePath("/bag");
  revalidatePath("/dashboard");
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
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  return normalized && normalized !== "__none__" ? normalized : null;
}

function nullableNumber(formData: FormData, key: string) {
  const value = nullableString(formData, key);

  if (value === null) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanBagSection(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return "main";
  }

  const section = value.trim().toLowerCase();
  return ["driver", "woods", "irons", "wedges", "putter", "main"].includes(section)
    ? section
    : "main";
}

function cleanBagPosition(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return 100;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(999, Math.round(parsed))) : 100;
}
