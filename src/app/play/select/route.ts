import { NextRequest, NextResponse } from "next/server";

import { listAvailableCourseTwins } from "@/lib/course-twin-data";
import { requireCurrentUserId } from "@/lib/current-user";
import { SELECTED_COURSE_COOKIE } from "@/lib/selected-course";

export async function GET(request: NextRequest) {
  const userId = await requireCurrentUserId();
  const courseId = request.nextUrl.searchParams.get("courseId");
  const destination = request.nextUrl.searchParams.get("destination");
  const courses = await listAvailableCourseTwins(userId);
  const selected = courses.find((course) => course.courseId === courseId) ?? null;

  if (!selected) {
    return NextResponse.redirect(new URL("/play", request.url));
  }

  const pathname = destination === "strategy" ? "/courses/strategy" : "/play";
  const redirectUrl = new URL(pathname, request.url);
  redirectUrl.searchParams.set("courseId", selected.courseId);
  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set(SELECTED_COURSE_COOKIE, selected.courseId, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
