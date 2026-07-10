import { NextRequest, NextResponse } from "next/server";

import { rateLimitRequest, readBoundedJsonBody } from "@/lib/api-protection";
import { buildCoachPrompt, parseAiCoachPayload, parseAiCoachSummary } from "@/lib/ai-coach-summary";
import { aiErrorPayload, generateAiJson } from "@/lib/ai/client";
import { aiCoachSummarySchema } from "@/lib/ai/schemas";
import { getOptionalCurrentUserId } from "@/lib/current-user";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 128 * 1024;

export async function POST(request: NextRequest) {
  const userId = await getOptionalCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const rateLimitRejection = rateLimitRequest(request, {
    keyPrefix: "coach-summary",
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (rateLimitRejection) {
    return rateLimitRejection;
  }

  const bodyResult = await readBoundedJsonBody(request, MAX_REQUEST_BYTES);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.value as { payload?: unknown } | null;
  const payload = parseAiCoachPayload(body?.payload);

  if (!payload) {
    return NextResponse.json({ message: "Send a valid coach payload." }, { status: 400 });
  }

  try {
    const result = await generateAiJson({
      userId,
      featureKey: "coach_summary",
      schemaName: "coach_summary",
      schema: aiCoachSummarySchema,
      messages: [
        {
          role: "user",
          content: [{ type: "input_text", text: buildCoachPrompt(payload) }],
        },
      ],
      cachePayload: payload,
      metadataJson: {
        clubCount: payload.clubs.length,
        signalCount: payload.signals.length,
      },
    });
    const text = JSON.stringify(result.output);

    return NextResponse.json({
      summary: parseAiCoachSummary(text),
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
