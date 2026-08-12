import { NextRequest, NextResponse } from "next/server";
import { and, eq, or } from "drizzle-orm";

import { getDb } from "@/db/client";
import { courses, teeSets } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/current-user";
import { SELECTED_COURSE_COOKIE, SELECTED_TEE_COOKIE } from "@/lib/selected-course";

export async function GET(request: NextRequest) {
  const userId = await requireCurrentUserId();
  const courseId = request.nextUrl.searchParams.get("courseId");
  const teeSetId = request.nextUrl.searchParams.get("teeSetId");
  const destination = request.nextUrl.searchParams.get("destination");
  const [selected] = courseId
    ? await getDb()
        .select({ id: courses.id })
        .from(courses)
        .where(
          and(
            eq(courses.id, courseId),
            or(eq(courses.visibility, "shared"), eq(courses.createdByUserId, userId)),
          ),
        )
        .limit(1)
    : [];

  if (!selected) return NextResponse.redirect(new URL("/play", request.url));

  const [selectedTee] = teeSetId
    ? await getDb()
        .select({ id: teeSets.id })
        .from(teeSets)
        .where(and(eq(teeSets.id, teeSetId), eq(teeSets.courseId, selected.id)))
        .limit(1)
    : [];
  const pathname = destination === "strategy" ? "/courses/strategy" : "/play";
  const redirectUrl = new URL(pathname, request.url);
  redirectUrl.searchParams.set("courseId", selected.id);
  if (selectedTee) redirectUrl.searchParams.set("teeSetId", selectedTee.id);
  const response = NextResponse.redirect(redirectUrl);
  const cookieOptions = {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax" as const,
    secure: request.nextUrl.protocol === "https:",
  };
  response.cookies.set(SELECTED_COURSE_COOKIE, selected.id, cookieOptions);
  if (selectedTee) response.cookies.set(SELECTED_TEE_COOKIE, selectedTee.id, cookieOptions);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
