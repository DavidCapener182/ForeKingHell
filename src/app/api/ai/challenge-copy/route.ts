import { NextRequest, NextResponse } from "next/server";

import { rejectOversizedRequest, rateLimitRequest } from "@/lib/api-protection";
import { aiErrorPayload, generateAiJson } from "@/lib/ai/client";
import { challengeCopySchema } from "@/lib/ai/schemas";
import { getOptionalCurrentUserId } from "@/lib/current-user";

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
    keyPrefix: "ai-challenge-copy",
    limit: 25,
    windowMs: 60 * 60 * 1000,
  });
  if (rateLimitRejection) {
    return rateLimitRejection;
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const context = {
    focusArea: stringValue(body?.focusArea, "practice").slice(0, 80),
    club: stringValue(body?.club, "mixed bag").slice(0, 80),
    deterministicRule: stringValue(
      body?.deterministicRule,
      "Use the existing ForeKingHell challenge scoring rule.",
    ).slice(0, 300),
    target: stringValue(body?.target, "12 measured shots").slice(0, 160),
    measuredIssue: stringValue(body?.measuredIssue, "current coach priority").slice(0, 220),
  };

  try {
    const result = await generateAiJson({
      userId,
      featureKey: "challenge_copy",
      schemaName: "challenge_copy",
      schema: challengeCopySchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Write ForeKingHell challenge copy from this JSON only.
Do not change the deterministic win condition, scoring, target, record verification, or saved shot data.
Only write title, description, encouragement, and session framing.

Data:
${JSON.stringify(context, null, 2)}`,
            },
          ],
        },
      ],
      cachePayload: context,
      metadataJson: {
        focusArea: context.focusArea,
      },
    });

    return NextResponse.json({
      challenge: result.output,
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

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
