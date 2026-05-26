import { NextRequest, NextResponse } from "next/server";

const PUBLIC_FILE = /\.[\w-]+$/;
const PUBLIC_PATH_PREFIXES = ["/_next/", "/icons/", "/assets/", "/auth/", "/share/", "/api/cron/"];
const PUBLIC_PATHS = new Set([
  "/favicon.ico",
  "/login",
  "/manifest.webmanifest",
  "/privacy",
  "/sw.js",
]);

export async function middleware(request: NextRequest) {
  const password = process.env.FKH_BASIC_AUTH_PASSWORD;
  const { pathname } = request.nextUrl;

  if (!password) {
    return refreshSessionAndProtect(request);
  }

  if (!isPublicPath(pathname)) {
    const authorization = request.headers.get("authorization");
    const expected = `Basic ${btoa(`${process.env.FKH_BASIC_AUTH_USER ?? "forekinghell"}:${password}`)}`;

    if (authorization !== expected) {
      return new NextResponse("Authentication required.", {
        status: 401,
        headers: {
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

  if (!hasSupabaseSessionCookie(request.cookies.getAll())) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next({ request });
}

function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    PUBLIC_FILE.test(pathname)
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
