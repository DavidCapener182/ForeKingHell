import "server-only";

import { eq, sql } from "drizzle-orm";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { userProfiles, users } from "@/db/schema";
import { getDb } from "@/db/client";
import { createSupabaseServerClient, isSupabaseAuthConfigured } from "@/lib/supabase/server";
import type { ThemePreference } from "@/lib/user-settings";

export type CurrentUser = {
  id: string;
  email: string | null;
  name: string | null;
};

export type CurrentUserPreferences = {
  preferredUnits: "yards" | "metres";
  theme: ThemePreference;
  tableDensity: "comfortable" | "compact";
};

const defaultPreferences: CurrentUserPreferences = {
  preferredUnits: "yards",
  theme: "system",
  tableDensity: "comfortable",
};

export const getCurrentUser = cache(async function getCurrentUser(): Promise<CurrentUser | null> {
  const playwrightUser = await getPlaywrightCookieUser();
  if (playwrightUser) {
    return playwrightUser;
  }

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
});

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
    theme: normalizeTheme(profile?.theme),
    tableDensity: profile?.tableDensity === "compact" ? "compact" : "comfortable",
  };
}

function normalizeTheme(value: string | null | undefined): ThemePreference {
  return value === "dark" || value === "light" ? value : "system";
}

export async function ensureUserProfile(user: CurrentUser) {
  return ensureUserProfileByIdentity(user.id, user.email, user.name);
}

const ensureUserProfileByIdentity = cache(async function ensureUserProfileByIdentity(
  userId: string,
  email: string | null,
  name: string | null,
) {
  const db = getDb();
  const now = new Date();
  const fallbackName =
    safeDisplayName(name) ?? displayNameFromEmail(email) ?? "LM World Tour Player";

  await db
    .insert(users)
    .values({
      id: userId,
      email,
      name: fallbackName,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email,
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
    .where(eq(users.id, userId))
    .limit(1);
  const canonicalDisplayName = safeDisplayName(appUser?.name) ?? fallbackName;
  const canonicalUsername = await uniqueDefaultUsernameForUser(
    defaultUsernameForProfile(canonicalDisplayName, appUser?.email ?? email, userId),
    userId,
  );
  const [socialProfile] = await db
    .select({
      userId: userProfiles.userId,
      username: userProfiles.username,
      displayName: userProfiles.displayName,
    })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  if (!socialProfile) {
    await db.insert(userProfiles).values({
      userId,
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
      .where(eq(userProfiles.userId, userId));
  }
});

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

async function getPlaywrightCookieUser(): Promise<CurrentUser | null> {
  if (process.env.PLAYWRIGHT_E2E_AUTH_BYPASS !== "1" || process.env.NODE_ENV === "production") {
    return null;
  }

  const cookieStore = await cookies();
  const token = accessTokenFromSupabaseCookie(supabaseAuthCookieValue(cookieStore.getAll()));

  if (!token) {
    return null;
  }

  try {
    const [, payload] = token.split(".");
    if (!payload) {
      return null;
    }

    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      sub?: string;
      email?: string;
      user_metadata?: Record<string, unknown>;
    };

    if (!claims.sub) {
      return null;
    }

    return {
      id: claims.sub,
      email: typeof claims.email === "string" ? claims.email : null,
      name:
        stringMetadata(claims.user_metadata?.name) ??
        stringMetadata(claims.user_metadata?.full_name) ??
        stringMetadata(claims.user_metadata?.display_name),
    };
  } catch {
    return null;
  }
}

function supabaseAuthCookieValue(cookies: { name: string; value: string }[]) {
  const authCookie = cookies.find((cookie) => /^sb-.+-auth-token$/.test(cookie.name));
  if (authCookie) {
    return authCookie.value;
  }

  const chunkedAuthCookie = cookies
    .map((cookie) => {
      const match = cookie.name.match(/^(sb-.+-auth-token)\.(\d+)$/);
      return match ? { baseName: match[1], index: Number(match[2]), value: cookie.value } : null;
    })
    .filter((cookie): cookie is { baseName: string; index: number; value: string } =>
      Boolean(cookie),
    )
    .sort((a, b) => a.index - b.index);

  if (chunkedAuthCookie.length === 0 || chunkedAuthCookie[0].index !== 0) {
    return null;
  }

  const baseName = chunkedAuthCookie[0].baseName;
  const chunks = [];
  for (const cookie of chunkedAuthCookie) {
    if (cookie.baseName !== baseName || cookie.index !== chunks.length) {
      break;
    }
    chunks.push(cookie.value);
  }

  return chunks.length > 0 ? chunks.join("") : null;
}

function accessTokenFromSupabaseCookie(value: string | undefined | null) {
  if (!value) {
    return null;
  }

  try {
    let decoded = decodeURIComponent(value);
    if (decoded.startsWith("base64-")) {
      decoded = Buffer.from(decoded.slice("base64-".length), "base64url").toString("utf8");
    }

    const parsed = JSON.parse(decoded) as { access_token?: string } | [string];
    const token = Array.isArray(parsed) ? parsed[0] : parsed.access_token;
    return typeof token === "string" && token ? token : null;
  } catch {
    return null;
  }
}

function stringMetadata(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function defaultUsernameForProfile(
  displayName: string,
  email: string | null | undefined,
  userId: string,
) {
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
