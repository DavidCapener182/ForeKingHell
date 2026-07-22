import "server-only";

import { and, eq, sql } from "drizzle-orm";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { userIdentityLinks, userProfiles, users } from "@/db/schema";
import { getDb } from "@/db/client";
import {
  cleanProfileLabel,
  isSharedDatabaseArtifact,
  profileLabelFromIdentity,
} from "@/lib/profile-label";
import { createSupabaseServerClient, isSupabaseAuthConfigured } from "@/lib/supabase/server";
import { parseTheme, type ThemePreference } from "@/lib/user-settings";

export type CurrentUser = {
  id: string;
  email: string | null;
  name: string | null;
  authUserId?: string;
  lastSignInAt?: string;
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

const getCurrentAuthUser = cache(async function getCurrentAuthUser(): Promise<CurrentUser | null> {
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

export const getCurrentUser = cache(async function getCurrentUser(): Promise<CurrentUser | null> {
  const authUser = await getCurrentAuthUser();

  if (!authUser) {
    return null;
  }

  if (!process.env.DATABASE_URL?.trim()) {
    return authUser;
  }

  await ensureUserProfile(authUser);
  return resolveLinkedCurrentUser(authUser);
});

export async function getOptionalCurrentUserId() {
  return (await getCurrentUser())?.id ?? null;
}

export async function requireCurrentUserId() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user.id;
}

export async function getCurrentUserPreferences(): Promise<CurrentUserPreferences> {
  const user = await getCurrentUser();

  if (!user) {
    return defaultPreferences;
  }

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
    theme: parseTheme(profile?.theme ?? null),
    tableDensity: profile?.tableDensity === "compact" ? "compact" : "comfortable",
  };
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
  const fallbackName = profileLabelFromIdentity(name, email, "LM World Tour Player");
  let [appUser] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!appUser) {
    const [insertedUser] = await db
      .insert(users)
      .values({
        id: userId,
        email,
        name: fallbackName,
        updatedAt: now,
      })
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
      });

    appUser = insertedUser;
  } else {
    const repairedName =
      !safeDisplayName(appUser.name) || isSharedDatabaseArtifact(appUser.name)
        ? fallbackName
        : appUser.name;
    const needsUserRepair = appUser.email !== email || repairedName !== appUser.name;

    if (needsUserRepair) {
      const [updatedUser] = await db
        .update(users)
        .set({
          email,
          name: repairedName,
          updatedAt: now,
        })
        .where(eq(users.id, userId))
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
        });

      appUser = updatedUser ?? appUser;
    }
  }

  const canonicalDisplayName = safeDisplayName(appUser?.name) ?? fallbackName;
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
    const canonicalUsername = await uniqueDefaultUsernameForUser(
      defaultUsernameForProfile(canonicalDisplayName, appUser?.email ?? email, userId),
      userId,
    );

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
    const canonicalUsername = needsUsernameRepair
      ? await uniqueDefaultUsernameForUser(
          defaultUsernameForProfile(canonicalDisplayName, appUser?.email ?? email, userId),
          userId,
        )
      : socialProfile.username;

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

async function resolveLinkedCurrentUser(authUser: CurrentUser): Promise<CurrentUser> {
  if (!authUser.email) {
    return authUser;
  }

  const [linkedUser] = await getDb()
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
    })
    .from(userIdentityLinks)
    .innerJoin(users, eq(users.id, userIdentityLinks.canonicalUserId))
    .where(
      and(
        eq(userIdentityLinks.linkedUserId, authUser.id),
        eq(userIdentityLinks.status, "active"),
        sql`lower(coalesce(${users.email}, '')) = lower(${authUser.email})`,
      ),
    )
    .limit(1);

  if (!linkedUser || linkedUser.id === authUser.id) {
    return authUser;
  }

  return {
    id: linkedUser.id,
    email: linkedUser.email ?? authUser.email,
    name: cleanProfileLabel(linkedUser.name) ?? authUser.name,
    authUserId: authUser.id,
    lastSignInAt: authUser.lastSignInAt,
  };
}

function normalizeAuthUser(user: User): CurrentUser {
  const metadata = user.user_metadata ?? {};
  const email = user.email ?? null;
  const metadataName =
    stringMetadata(metadata.name) ??
    stringMetadata(metadata.full_name) ??
    stringMetadata(metadata.display_name);

  return {
    id: user.id,
    email,
    name: profileLabelFromIdentity(metadataName, email, null),
    lastSignInAt: user.last_sign_in_at,
  };
}

async function getPlaywrightCookieUser(): Promise<CurrentUser | null> {
  if (!isPlaywrightE2eAuthBypassEnabled()) {
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

    const email = typeof claims.email === "string" ? claims.email : null;
    const metadataName =
      stringMetadata(claims.user_metadata?.name) ??
      stringMetadata(claims.user_metadata?.full_name) ??
      stringMetadata(claims.user_metadata?.display_name);

    return {
      id: claims.sub,
      email,
      name: profileLabelFromIdentity(metadataName, email, null),
    };
  } catch {
    return null;
  }
}

export function isPlaywrightE2eAuthBypassEnabled() {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  return process.env.PLAYWRIGHT_E2E_AUTH_BYPASS === "1";
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
  return cleanProfileLabel(value);
}

function shouldRepairStoredUsername(value: string | null | undefined) {
  return !value?.trim() || isSharedDatabaseArtifact(value);
}
