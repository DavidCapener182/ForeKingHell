import "server-only";

type SiteOriginEnv = Record<string, string | undefined>;

export function getSiteOrigin(env: SiteOriginEnv = process.env) {
  const configured =
    cleanUrl(env.NEXT_PUBLIC_SITE_URL) ??
    cleanVercelUrl(env.VERCEL_PROJECT_PRODUCTION_URL) ??
    cleanVercelUrl(env.VERCEL_URL);

  if (configured) {
    return configured;
  }

  if (env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL or a trusted Vercel deployment URL is required in production.",
    );
  }

  return "http://localhost:3000";
}

function cleanUrl(value: string | undefined) {
  const candidate = value?.trim();

  if (!candidate) {
    return null;
  }

  try {
    const url = new URL(candidate);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

function cleanVercelUrl(value: string | undefined) {
  const candidate = value
    ?.trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "");
  return candidate && /^[a-z0-9.-]+$/i.test(candidate) ? `https://${candidate}` : null;
}
