"use server";

import { eq } from "drizzle-orm";
import { redirect, unstable_rethrow } from "next/navigation";

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

export async function dismissWelcomeStateAction(
  _previous: { error?: string },
  _data: FormData,
): Promise<{ error?: string }> {
  void _previous;
  void _data;
  try {
    await dismissWelcomeAction();
    return {};
  } catch (error) {
    unstable_rethrow(error);
    return { error: "Your choice could not be saved. Try again." };
  }
}
