"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db/client";
import { shots } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/current-user";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function deleteShotAction(shotId: string) {
  const userId = await requireCurrentUserId();

  if (!uuidPattern.test(shotId)) {
    throw new Error("Invalid shot.");
  }

  const [deletedShot] = await getDb()
    .delete(shots)
    .where(and(eq(shots.id, shotId), eq(shots.userId, userId)))
    .returning({ id: shots.id });

  if (!deletedShot) {
    throw new Error("That shot was not found. Refresh and try again.");
  }

  revalidatePath("/shots");
  revalidatePath("/today");
  revalidatePath("/", "layout");

  return { deletedShotId: deletedShot.id };
}
