import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_FILE = /\.[\w-]+$/;
const PUBLIC_PATH_PREFIXES = ["/_next/", "/icons/", "/assets/", "/auth/", "/share/", "/api/cron/"];
const PUBLIC_PATHS = new Set([
  "/favicon.ico",
  "/login",
  "/manifest.webmanifest",
  "/offline",
  "/privacy",
  "/sw.js",
]);

export async function proxy(request: NextRequest) {
  const password = process.env.FKH_BASIC_AUTH_PASSWORD;
  const { pathname } = request.nextUrl;

  if (password && !isPublicPath(pathname)) {
    const authorization = request.headers.get("authorization");
    const expected = `Basic ${btoa(`${process.env.FKH_BASIC_AUTH_USER ?? "forekinghell"}:${password}`)}`;

    if (authorization !== expected) {
      return new NextResponse("Authentication required.", {
        status: 401,
        headers: {
          "cache-control": "no-store",
          "www-authenticate": 'Basic realm="LM World Tour", charset="UTF-8"',
        },
      });
    }
  }

  return refreshSessionAndProtect(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};

async function refreshSessionAndProtect(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next({ request });
  }

  if (hasPlaywrightBypassSession(request)) {
    return noStore(NextResponse.next({ request }));
  }

  const supabaseConfig = getSupabasePublicConfig();
  if (!supabaseConfig) {
    return unauthenticatedResponse(request);
  }

  let supabaseResponse = noStore(NextResponse.next({ request }));
  const supabase = createServerClient(supabaseConfig.url, supabaseConfig.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = noStore(NextResponse.next({ request }));
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
        Object.entries(headers ?? {}).forEach(([key, value]) =>
          supabaseResponse.headers.set(key, value),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return copySupabaseResponseState(supabaseResponse, unauthenticatedResponse(request));
  }

  return supabaseResponse;
}

function unauthenticatedResponse(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    return noStore(NextResponse.json({ message: "Authentication required." }, { status: 401 }));
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", pathname);
  return noStore(NextResponse.redirect(loginUrl));
}

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

function copySupabaseResponseState(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));

  for (const key of ["cache-control", "expires", "pragma"]) {
    const value = source.headers.get(key);
    if (value) {
      target.headers.set(key, value);
    }
  }

  return target;
}

function getSupabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return url && publishableKey ? { url, publishableKey } : null;
}

function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    PUBLIC_FILE.test(pathname)
  );
}

function hasPlaywrightBypassSession(request: NextRequest) {
  return (
    process.env.PLAYWRIGHT_E2E_AUTH_BYPASS === "1" &&
    process.env.NODE_ENV !== "production" &&
    hasSupabaseSessionCookie(request.cookies.getAll())
  );
}

function hasSupabaseSessionCookie(cookies: { name: string; value: string }[]) {
  return Boolean(accessTokenFromSupabaseCookie(supabaseAuthCookieValue(cookies)));
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
      decoded = decodeBase64Url(decoded.slice("base64-".length));
    }

    const parsed = JSON.parse(decoded) as { access_token?: string } | [string];
    const token = Array.isArray(parsed) ? parsed[0] : parsed.access_token;
    return typeof token === "string" && token ? token : null;
  } catch {
    return null;
  }
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return atob(padded);
}
