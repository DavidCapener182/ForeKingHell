import { NextRequest, NextResponse } from "next/server";

import { rateLimitRequest, readBoundedJsonBody } from "@/lib/api-protection";
import { aiErrorPayload, generateAiJson } from "@/lib/ai/client";
import { socialCaptionSchema } from "@/lib/ai/schemas";
import { getOptionalCurrentUserId } from "@/lib/current-user";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 24 * 1024;

export async function POST(request: NextRequest) {
  const userId = await getOptionalCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const rateLimitRejection = rateLimitRequest(request, {
    keyPrefix: "ai-social-caption",
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (rateLimitRejection) {
    return rateLimitRejection;
  }

  const bodyResult = await readBoundedJsonBody(request, MAX_REQUEST_BYTES);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.value as Record<string, unknown> | null;
  const context = {
    subjectType: stringValue(body?.subjectType, "golf_update").slice(0, 80),
    tone: stringValue(body?.tone, "confident and natural").slice(0, 120),
    facts: sanitizeFacts(body?.facts),
  };

  try {
    const result = await generateAiJson({
      userId,
      featureKey: "social_caption",
      schemaName: "social_caption",
      schema: socialCaptionSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Write optional ForeKingHell social/share copy from this JSON only.
Do not auto-post, do not make unverifiable handicap or record claims, and keep it suitable for a golfer reviewing before sharing.

Data:
${JSON.stringify(context, null, 2)}`,
            },
          ],
        },
      ],
      cachePayload: context,
      metadataJson: {
        subjectType: context.subjectType,
      },
    });

    return NextResponse.json({
      caption: result.output,
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

function sanitizeFacts(value: unknown) {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 20)
      .map(([key, raw]) => [key.slice(0, 60), typeof raw === "string" ? raw.slice(0, 300) : raw]),
  );
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
