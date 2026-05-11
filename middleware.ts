import { NextRequest, NextResponse } from "next/server";

const PUBLIC_FILE = /\.[\w-]+$/;

export function middleware(request: NextRequest) {
  const password = process.env.FKH_BASIC_AUTH_PASSWORD;

  if (!password) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/assets/") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const authorization = request.headers.get("authorization");
  const expected = `Basic ${btoa(`${process.env.FKH_BASIC_AUTH_USER ?? "forekinghell"}:${password}`)}`;

  if (authorization === expected) {
    return NextResponse.next();
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "www-authenticate": 'Basic realm="ForeKingHell", charset="UTF-8"',
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
