import "server-only";

import { eq, sql } from "drizzle-orm";
import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { userProfiles, users } from "@/db/schema";
import { getDb } from "@/db/client";
import { createSupabaseServerClient, isSupabaseAuthConfigured } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string | null;
  name: string | null;
};

export type CurrentUserPreferences = {
  preferredUnits: "yards" | "metres";
  theme: "light";
  tableDensity: "comfortable" | "compact";
};

const defaultPreferences: CurrentUserPreferences = {
  preferredUnits: "yards",
  theme: "light",
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
    theme: "light",
    tableDensity: profile?.tableDensity === "compact" ? "compact" : "comfortable",
  };
}

export async function ensureUserProfile(user: CurrentUser) {
  const db = getDb();
  const now = new Date();
  const fallbackName = safeDisplayName(user.name) ?? displayNameFromEmail(user.email) ?? "ForeKingHell Player";

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
        name: sql`case when nullif(trim(${users.name}), '') is null or lower(${users.name}) like '%incert%' then ${fallbackName} else ${users.name} end`,
        updatedAt: now,
      },
    });

  const [appUser] = await db
    .select({
      email: users.email,
      name: users.name,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  const canonicalDisplayName = safeDisplayName(appUser?.name) ?? fallbackName;
  const canonicalUsername = await uniqueDefaultUsernameForUser(
    defaultUsernameForProfile(canonicalDisplayName, appUser?.email ?? user.email, user.id),
    user.id,
  );
  const [socialProfile] = await db
    .select({
      userId: userProfiles.userId,
      username: userProfiles.username,
      displayName: userProfiles.displayName,
    })
    .from(userProfiles)
    .where(eq(userProfiles.userId, user.id))
    .limit(1);

  if (!socialProfile) {
    await db.insert(userProfiles).values({
      userId: user.id,
      username: canonicalUsername,
      displayName: canonicalDisplayName,
      updatedAt: now,
    });
    return;
  }

  const needsDisplayRepair = !safeDisplayName(socialProfile.displayName);
  const needsUsernameRepair = shouldRepairStoredUsername(socialProfile.username);

  if (needsDisplayRepair || needsUsernameRepair) {
    await db
      .update(userProfiles)
      .set({
        ...(needsDisplayRepair ? { displayName: canonicalDisplayName } : {}),
        ...(needsUsernameRepair ? { username: canonicalUsername } : {}),
        updatedAt: now,
      })
      .where(eq(userProfiles.userId, user.id));
  }
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

function defaultUsernameForProfile(displayName: string, email: string | null | undefined, userId: string) {
  const base = (safeDisplayName(displayName) ?? email?.split("@")[0] ?? "player")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return `${base || "player"}-${userId.slice(0, 8).toLowerCase()}`;
}

async function uniqueDefaultUsernameForUser(base: string, userId: string) {
  const db = getDb();
  const candidate = normalizeUsername(base) || `player-${userId.slice(0, 8).toLowerCase()}`;

  for (let index = 0; index < 10; index += 1) {
    const username = index === 0 ? candidate : `${candidate.slice(0, 33)}-${index}`;
    const [existing] = await db
      .select({ userId: userProfiles.userId })
      .from(userProfiles)
      .where(eq(userProfiles.username, username))
      .limit(1);

    if (!existing || existing.userId === userId) {
      return username;
    }
  }

  return `${candidate.slice(0, 30)}-${Date.now().toString(36).slice(-6)}`;
}

function normalizeUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function safeDisplayName(value: string | null | undefined) {
  const cleaned = stringMetadata(value);
  return cleaned && !isSharedDatabaseArtifact(cleaned) ? cleaned : null;
}

function displayNameFromEmail(email: string | null | undefined) {
  const localPart = email?.split("@")[0]?.trim();
  return localPart && !isSharedDatabaseArtifact(localPart) ? localPart : null;
}

function shouldRepairStoredUsername(value: string | null | undefined) {
  return !value?.trim() || isSharedDatabaseArtifact(value);
}

function isSharedDatabaseArtifact(value: string) {
  return /\bincert\b/i.test(value);
}
