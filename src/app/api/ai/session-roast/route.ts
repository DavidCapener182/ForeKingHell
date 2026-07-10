import { NextRequest, NextResponse } from "next/server";

import { rateLimitRequest, readBoundedJsonBody } from "@/lib/api-protection";
import { aiErrorPayload, generateAiJson } from "@/lib/ai/client";
import { sessionRoastSchema } from "@/lib/ai/schemas";
import { getOptionalCurrentUserId } from "@/lib/current-user";
import { getSessionRoastContext } from "@/lib/simulator-lab";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 8 * 1024;

export async function POST(request: NextRequest) {
  const userId = await getOptionalCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const rateLimitRejection = rateLimitRequest(request, {
    keyPrefix: "ai-session-roast",
    limit: 12,
    windowMs: 60 * 60 * 1000,
  });
  if (rateLimitRejection) {
    return rateLimitRejection;
  }

  const bodyResult = await readBoundedJsonBody(request, MAX_REQUEST_BYTES);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.value as Record<string, unknown> | null;
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId.slice(0, 80) : null;
  const context = await getSessionRoastContext(userId, sessionId);

  if (!context) {
    return NextResponse.json({ message: "No simulator session is available." }, { status: 404 });
  }

  try {
    const result = await generateAiJson<{
      headline: string;
      roast: string;
      shortCaption: string;
      safetyNote: string;
    }>({
      userId,
      featureKey: "session_roast",
      schemaName: "session_roast",
      schema: sessionRoastSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Write a short golf-only roast draft for ForeKingHell from this JSON only.
Keep it banter, not abuse. Do not mention protected traits, bodies, identity, health, or anything outside the supplied golf facts.
Do not auto-post. The golfer will review before sharing.

Data:
${JSON.stringify(
  {
    session: {
      id: context.session.id,
      source: context.session.source,
      type: context.session.type,
      date: context.session.date,
      fileName: context.session.fileName,
    },
    facts: context.facts,
  },
  null,
  2,
)}`,
            },
          ],
        },
      ],
      cachePayload: {
        sessionId: context.session.id,
        facts: context.facts,
      },
      metadataJson: {
        sessionId: context.session.id,
        factCount: context.facts.length,
      },
    });

    return NextResponse.json({
      roast: result.output,
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
