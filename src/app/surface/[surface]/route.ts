import { NextRequest, NextResponse } from "next/server";

import { APP_SURFACE_COOKIE, parseAppSurface } from "@/lib/app-surface";

export function GET(request: NextRequest, context: RouteContext<"/surface/[surface]">) {
  return setSurface(request, context);
}

async function setSurface(request: NextRequest, context: RouteContext<"/surface/[surface]">) {
  const { surface: requestedSurface } = await context.params;
  const surface = parseAppSurface(requestedSurface);

  if (!surface) {
    return NextResponse.json({ error: "Unknown application surface." }, { status: 404 });
  }

  const destination = safeDestination(request.nextUrl.searchParams.get("next"));
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.cookies.set(APP_SURFACE_COOKIE, surface, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

function safeDestination(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/today";
  return value;
}
