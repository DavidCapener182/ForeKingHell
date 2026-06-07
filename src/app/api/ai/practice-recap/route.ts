import { NextRequest, NextResponse } from "next/server";

import { rejectOversizedRequest, rateLimitRequest } from "@/lib/api-protection";
import { aiErrorPayload, generateAiJson } from "@/lib/ai/client";
import { practiceRecapSchema } from "@/lib/ai/schemas";
import { getOptionalCurrentUserId } from "@/lib/current-user";
import { getTodayPracticeData } from "@/lib/today-session-data";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 24 * 1024;

export async function POST(request: NextRequest) {
  const userId = await getOptionalCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const sizeRejection = rejectOversizedRequest(request, MAX_REQUEST_BYTES);
  if (sizeRejection) {
    return sizeRejection;
  }

  const rateLimitRejection = rateLimitRequest(request, {
    keyPrefix: "ai-practice-recap",
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (rateLimitRejection) {
    return rateLimitRejection;
  }

  const body = (await request.json().catch(() => null)) as {
    date?: unknown;
    sessionId?: unknown;
    club?: unknown;
  } | null;
  const data = await getTodayPracticeData({
    date: stringOrUndefined(body?.date),
    sessionId: stringOrUndefined(body?.sessionId),
    club: stringOrUndefined(body?.club),
  });
  const context = {
    dateKey: data.dateKey,
    filters: data.filters,
    shotCount: data.shots.length,
    sessionCount: data.sessions.length,
    clubs: data.clubComparisons.slice(0, 8).map((club) => ({
      club: club.clubLabel,
      verdict: club.verdict,
      score: club.score,
      summary: club.summary,
      today: club.today,
      carryDeltaYd: club.carryDeltaYd,
      offlineDeltaYd: club.offlineDeltaYd,
      playableRateDelta: club.playableRateDelta,
      consistencyDeltaYd: club.consistencyDeltaYd,
    })),
  };

  try {
    const result = await generateAiJson({
      userId,
      featureKey: "practice_recap",
      schemaName: "practice_recap",
      schema: practiceRecapSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Write a ForeKingHell latest-practice recap from this JSON only.
Keep deterministic metrics untouched. Explain the session like a coach, and do not invent swing causes or saved-data changes.

Data:
${JSON.stringify(context, null, 2)}`,
            },
          ],
        },
      ],
      cachePayload: context,
      metadataJson: {
        shotCount: data.shots.length,
        clubCount: data.clubComparisons.length,
      },
    });

    return NextResponse.json({
      recap: result.output,
      generatedAt: result.generatedAt,
      cached: result.cached,
      creditsCharged: result.creditsCharged,
      creditsRemaining: result.creditsRemaining,
    });
  } catch (error) {
    const { body, status } = aiErrorPayload(error);
    return NextResponse.json(body, { status });
  }
}

function stringOrUndefined(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 120) : undefined;
}
