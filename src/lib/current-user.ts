import "server-only";

import { eq, sql } from "drizzle-orm";
import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { users } from "@/db/schema";
import { getDb } from "@/db/client";
import { createSupabaseServerClient, isSupabaseAuthConfigured } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string | null;
  name: string | null;
};

export type CurrentUserPreferences = {
  preferredUnits: "yards" | "metres";
  theme: "system" | "light" | "dark";
  tableDensity: "comfortable" | "compact";
};

const defaultPreferences: CurrentUserPreferences = {
  preferredUnits: "yards",
  theme: "system",
  tableDensity: "comfortable",
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!isSupabaseAuthConfigured()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return normalizeAuthUser(user);
}

export async function getOptionalCurrentUserId() {
  return (await getCurrentUser())?.id ?? null;
}

export async function requireCurrentUserId() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  await ensureUserProfile(user);
  return user.id;
}

export async function getCurrentUserPreferences(): Promise<CurrentUserPreferences> {
  const user = await getCurrentUser();

  if (!user) {
    return defaultPreferences;
  }

  await ensureUserProfile(user);

  const [profile] = await getDb()
    .select({
      preferredUnits: users.preferredUnits,
      theme: users.theme,
      tableDensity: users.tableDensity,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  return {
    preferredUnits: profile?.preferredUnits === "metres" ? "metres" : "yards",
    theme: profile?.theme === "light" || profile?.theme === "dark" ? profile.theme : "system",
    tableDensity: profile?.tableDensity === "compact" ? "compact" : "comfortable",
  };
}

export async function ensureUserProfile(user: CurrentUser) {
  const db = getDb();
  const now = new Date();
  const fallbackName = user.name ?? user.email?.split("@")[0] ?? "ForeKingHell Player";

  await db
    .insert(users)
    .values({
      id: user.id,
      email: user.email,
      name: fallbackName,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: user.email,
        name: sql`coalesce(nullif(${users.name}, ''), ${fallbackName})`,
        updatedAt: now,
      },
    });
}

function normalizeAuthUser(user: User): CurrentUser {
  const metadata = user.user_metadata ?? {};
  const name =
    stringMetadata(metadata.name) ??
    stringMetadata(metadata.full_name) ??
    stringMetadata(metadata.display_name);

  return {
    id: user.id,
    email: user.email ?? null,
    name,
  };
}

function stringMetadata(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
