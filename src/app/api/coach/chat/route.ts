import { NextRequest, NextResponse } from "next/server";

import { rateLimitRequest, readBoundedJsonBody } from "@/lib/api-protection";
import { aiErrorPayload, generateAiJson } from "@/lib/ai/client";
import { coachChatAnswerSchema } from "@/lib/ai/schemas";
import { getOptionalCurrentUserId } from "@/lib/current-user";
import { buildCoachSqlContext } from "@/lib/coach-sql-context";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 16 * 1024;

export async function POST(request: NextRequest) {
  const userId = await getOptionalCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const rateLimitRejection = rateLimitRequest(request, {
    keyPrefix: "coach-chat",
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (rateLimitRejection) {
    return rateLimitRejection;
  }

  const bodyResult = await readBoundedJsonBody(request, MAX_REQUEST_BYTES);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.value as { message?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 600) : "";

  if (!message) {
    return NextResponse.json({ message: "Send a coach question." }, { status: 400 });
  }

  const context = await buildCoachSqlContext(userId, message);

  try {
    const result = await generateAiJson<{ answer: string }>({
      userId,
      featureKey: "coach_chat",
      schemaName: "coach_chat_answer",
      schema: coachChatAnswerSchema,
      messages: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "You are a direct golf coach. Answer in 90-150 words, cite concrete LM World Tour facts, and avoid pretending data exists.",
            },
          ],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: context.contextText }],
        },
      ],
      metadataJson: {
        citationCount: context.citations.length,
      },
    });

    return NextResponse.json({
      answer: result.output.answer,
      citations: context.citations,
      generatedAt: result.generatedAt,
      creditsCharged: result.creditsCharged,
      creditsRemaining: result.creditsRemaining,
    });
  } catch (error) {
    const { body, status } = aiErrorPayload(error);
    return NextResponse.json(body, { status });
  }
}
