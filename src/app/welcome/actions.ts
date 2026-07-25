"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/current-user";

export async function dismissWelcomeAction() {
  const userId = await requireCurrentUserId();
  if (process.env.DATABASE_URL?.trim()) {
    await getDb()
      .update(users)
      .set({ onboardingCompletedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId));
  }
  redirect("/today");
}
