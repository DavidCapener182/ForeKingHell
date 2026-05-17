import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

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
          "www-authenticate": 'Basic realm="ForeKingHell", charset="UTF-8"',
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
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey || isPublicPath(pathname)) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const hasSession = Boolean(data?.claims?.sub && !error);

  if (!hasSession) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    PUBLIC_FILE.test(pathname)
  );
}
