import { NextResponse, type NextRequest } from "next/server";

import {
  DEFAULT_PATTERN_LIMIT,
  type ShotPatternMode,
  type ShotPatternOutlierMode,
} from "@/lib/shot-patterns";
import { getCurrentUser } from "@/lib/current-user";
import { isShotPatternFeatureEnabled } from "@/lib/shot-pattern-feature";
import { getShotPatternOverlayData } from "@/lib/shot-pattern-overlay-data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isShotPatternFeatureEnabled()) {
    return NextResponse.json({ error: "Shot Pattern Overlay is disabled" }, { status: 404 });
  }

  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const courseId = params.get("courseId");

  if (!courseId) {
    return NextResponse.json({ error: "courseId is required" }, { status: 400 });
  }

  const data = await getShotPatternOverlayData({
    userId: user.id,
    courseId,
    teeSetId: params.get("teeSetId"),
    holeNumber: parsePositiveInt(params.get("holeNumber") ?? params.get("hole")),
    clubId: params.get("clubId"),
    clubType: params.get("clubType"),
    mode: parseMode(params.get("mode")),
    outlierMode: parseOutlierMode(params.get("outlier") ?? params.get("outlierMode")),
    limit: parsePositiveInt(params.get("limit")) ?? DEFAULT_PATTERN_LIMIT,
  });

  if (!data) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

function parseMode(value: string | null): ShotPatternMode {
  return value === "carry" ? "carry" : "total";
}

function parseOutlierMode(value: string | null): ShotPatternOutlierMode {
  if (value === "all" || value === "best80" || value === "best90") {
    return value;
  }

  return "best90";
}

function parsePositiveInt(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
