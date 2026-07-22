import { NextResponse, type NextRequest } from "next/server";

import { rateLimitRequest } from "@/lib/api-protection";
import { getOptionalCurrentUserId } from "@/lib/current-user";
import { getLivePlaysLikeSnapshotForCourse } from "@/lib/plays-like-weather";
import { reportServerFailure } from "@/lib/server-observability";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rateLimited = rateLimitRequest(request, {
    keyPrefix: "plays-like",
    limit: 60,
    windowMs: 60_000,
  });

  if (rateLimited) {
    return rateLimited;
  }

  const userId = await getOptionalCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const courseId = request.nextUrl.searchParams.get("courseId");

  if (!courseId) {
    return NextResponse.json({ message: "courseId is required." }, { status: 400 });
  }

  try {
    const snapshot = await getLivePlaysLikeSnapshotForCourse({ userId, courseId });

    if (!snapshot) {
      return NextResponse.json(
        { message: "Course weather is unavailable for this course." },
        { status: 404 },
      );
    }

    return NextResponse.json(snapshot, {
      headers: {
        "cache-control": "private, max-age=60",
      },
    });
  } catch (error) {
    reportServerFailure("plays_like_provider_failed", error, {
      "provider.name": "open_meteo",
    });
    return NextResponse.json(
      { message: "Plays-like weather could not be loaded." },
      { status: 502 },
    );
  }
}
