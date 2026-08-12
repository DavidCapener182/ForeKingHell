import { existsSync, readFileSync } from "node:fs";

export const LOCAL_AUTH_BYPASS_USER_ID = "c0c02d1e-605a-47c5-a023-83a1c0d18195";

export function extractSupabaseUserId(storageStatePath: string | undefined) {
  if (!storageStatePath || !existsSync(storageStatePath)) {
    return null;
  }

  const state = JSON.parse(readFileSync(storageStatePath, "utf8")) as {
    cookies?: Array<{ name: string; value: string }>;
  };
  const cookie = state.cookies?.find(
    (item) => item.name.startsWith("sb-") && item.name.endsWith("-auth-token"),
  );
  if (!cookie) {
    return null;
  }

  try {
    let value = decodeURIComponent(cookie.value);
    if (value.startsWith("base64-")) {
      value = Buffer.from(value.slice("base64-".length), "base64").toString("utf8");
    }
    const parsed = JSON.parse(value) as { access_token?: string } | [string];
    const token = Array.isArray(parsed) ? parsed[0] : parsed.access_token;
    if (!token) {
      return null;
    }

    const [, payload] = token.split(".");
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      sub?: string;
    };
    return claims.sub ?? null;
  } catch {
    return null;
  }
}

export function isDesignatedMutatingTestUser(
  authenticatedUserId: string | null,
  designatedUserId: string | undefined,
) {
  const designated = designatedUserId?.trim();
  return Boolean(authenticatedUserId && designated && authenticatedUserId === designated);
}
