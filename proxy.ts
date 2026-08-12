import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse, userAgent } from "next/server";

import {
  isDesktopOnlyCompanionPath,
  isSummaryOnlyCompanionPath,
} from "@/lib/app-route-capabilities";
import { APP_SURFACE_COOKIE, resolveAppSurface } from "@/lib/app-surface";

const PUBLIC_PATH_PREFIXES = [
  "/_next/static/",
  "/_next/image/",
  "/icons/",
  "/assets/",
  "/brand/",
  "/share/",
  "/course-twins/common/",
];
const PUBLIC_PATHS = new Set([
  "/",
  "/.well-known/security.txt",
  "/favicon.ico",
  "/login",
  "/manifest.webmanifest",
  "/offline",
  "/privacy",
  "/auth/callback",
  "/api/cron/tour-leaderboards",
  "/api/cron/course-twin-builds",
  "/api/cron/course-twin-catalog",
  "/api/security/csp-report",
  "/api/stripe/webhook",
  "/sw.js",
]);

const INVALID_SESSION_ERROR_CODES = new Set([
  "invalid_refresh_token",
  "refresh_token_already_used",
  "refresh_token_not_found",
  "session_expired",
  "session_not_found",
]);
const INVALID_SESSION_MESSAGE_PARTS = [
  "invalid refresh token",
  "jwt expired",
  "refresh token already used",
  "refresh token has already been used",
  "refresh token not found",
  "session expired",
];

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
    return noStore(protectedAppResponse(request));
  }

  const supabaseConfig = getSupabasePublicConfig();
  if (!supabaseConfig) {
    return unauthenticatedResponse(request);
  }

  let supabaseResponse = noStore(protectedAppResponse(request));
  const supabase = createServerClient(supabaseConfig.url, supabaseConfig.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = noStore(protectedAppResponse(request));
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
        Object.entries(headers ?? {}).forEach(([key, value]) =>
          supabaseResponse.headers.set(key, value),
        );
      },
    },
  });

  let authResult: Awaited<ReturnType<typeof supabase.auth.getUser>>;

  try {
    authResult = await supabase.auth.getUser();
  } catch (error) {
    if (!isInvalidSessionError(error)) {
      throw error;
    }

    return expiredSessionResponse(request, supabaseResponse);
  }

  if (isInvalidSessionError(authResult.error)) {
    return expiredSessionResponse(request, supabaseResponse);
  }

  if (!authResult.data.user) {
    return copySupabaseResponseState(supabaseResponse, unauthenticatedResponse(request));
  }

  return supabaseResponse;
}

function protectedAppResponse(request: NextRequest) {
  const deviceType = userAgent(request).device.type;

  if (deviceType === "mobile" && request.nextUrl.pathname === "/dashboard") {
    return mobileDashboardCompanionResponse(request);
  }

  const surface = resolveAppSurface({
    storedPreference: request.cookies.get(APP_SURFACE_COOKIE)?.value,
    deviceType,
  });

  if (surface !== "companion") {
    return NextResponse.next({ request });
  }

  const companionRuntimePath = companionRuntimePathFor(request.nextUrl.pathname);
  if (companionRuntimePath) {
    const runtimeUrl = request.nextUrl.clone();
    runtimeUrl.pathname = companionRuntimePath;
    return NextResponse.rewrite(runtimeUrl, { request });
  }

  if (isDesktopOnlyCompanionPath(request.nextUrl.pathname)) {
    const handoffUrl = request.nextUrl.clone();
    handoffUrl.pathname = "/companion/handoff";
    handoffUrl.search = "";
    handoffUrl.searchParams.set("from", localReturnTarget(request));
    return NextResponse.rewrite(handoffUrl, { request });
  }

  if (isSummaryOnlyCompanionPath(request.nextUrl.pathname)) {
    const summaryUrl = request.nextUrl.clone();
    summaryUrl.pathname = "/companion/summary";
    summaryUrl.search = "";
    summaryUrl.searchParams.set("from", localReturnTarget(request));
    return NextResponse.rewrite(summaryUrl, { request });
  }

  return NextResponse.next({ request });
}

function companionRuntimePathFor(pathname: string) {
  if (pathname === "/import/result") return "/companion-runtime/import/result";
  if (pathname === "/import") return "/companion-runtime/import";
  if (pathname === "/rapsodo") return "/companion-runtime/rapsodo";
  return null;
}

function mobileDashboardCompanionResponse(request: NextRequest) {
  const todayUrl = request.nextUrl.clone();
  todayUrl.pathname = "/today";
  todayUrl.search = "";

  const response = noStore(NextResponse.redirect(todayUrl));
  response.cookies.set(APP_SURFACE_COOKIE, "companion", {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
  });
  return response;
}

function unauthenticatedResponse(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    return noStore(
      NextResponse.json(
        { code: "authentication_required", message: "Authentication required." },
        { status: 401 },
      ),
    );
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set("next", localReturnTarget(request));
  return noStore(NextResponse.redirect(loginUrl));
}

function expiredSessionResponse(request: NextRequest, supabaseResponse: NextResponse) {
  const target = request.nextUrl.pathname.startsWith("/api/")
    ? NextResponse.json(
        {
          code: "session_expired",
          message: "Your session has expired. Please sign in again.",
        },
        { status: 401 },
      )
    : sessionExpiredRedirect(request);
  const response = copySupabaseResponseState(supabaseResponse, noStore(target));

  clearSupabaseAuthCookiesFromResponse(request, supabaseResponse, response);
  return response;
}

function sessionExpiredRedirect(request: NextRequest) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set("reason", "session_expired");
  loginUrl.searchParams.set("next", localReturnTarget(request));
  return NextResponse.redirect(loginUrl);
}

function localReturnTarget(request: NextRequest) {
  const target = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  return target.startsWith("/") && !target.startsWith("//") ? target : "/today";
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
    PUBLIC_PATHS.has(pathname) || PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

function isInvalidSessionError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate.code === "string" ? candidate.code.toLowerCase() : "";
  const message = typeof candidate.message === "string" ? candidate.message.toLowerCase() : "";

  return (
    INVALID_SESSION_ERROR_CODES.has(code) ||
    INVALID_SESSION_MESSAGE_PARTS.some((part) => message.includes(part))
  );
}

function clearSupabaseAuthCookiesFromResponse(
  request: NextRequest,
  supabaseResponse: NextResponse,
  response: NextResponse,
) {
  const cookieNames = new Set(
    [...request.cookies.getAll(), ...supabaseResponse.cookies.getAll()]
      .map((cookie) => cookie.name)
      .filter(isSupabaseAuthCookieName),
  );

  for (const name of cookieNames) {
    response.cookies.set(name, "", {
      expires: new Date(0),
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
    });
  }
}

function isSupabaseAuthCookieName(name: string) {
  return /^sb-.+-auth-token(?:-code-verifier)?(?:\.\d+)?$/.test(name);
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
