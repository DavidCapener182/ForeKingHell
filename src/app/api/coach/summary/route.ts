import { NextRequest, NextResponse } from "next/server";

import { rejectOversizedRequest, rateLimitRequest } from "@/lib/api-protection";
import { buildCoachPrompt, parseAiCoachSummary, type AiCoachPayload } from "@/lib/ai-coach-summary";
import { BRAND_NAME, LEGACY_BRAND_NAME } from "@/lib/brand";
import { getOptionalCurrentUserId } from "@/lib/current-user";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 128 * 1024;

export async function POST(request: NextRequest) {
  if (!(await getOptionalCurrentUserId())) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const sizeRejection = rejectOversizedRequest(request, MAX_REQUEST_BYTES);
  if (sizeRejection) {
    return sizeRejection;
  }

  const rateLimitRejection = rateLimitRequest(request, {
    keyPrefix: "coach-summary",
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (rateLimitRejection) {
    return rateLimitRejection;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { message: "OPENAI_API_KEY is required for AI coach summaries." },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => null)) as { payload?: unknown } | null;
  const payload = body?.payload;

  if (!isAiCoachPayload(payload)) {
    return NextResponse.json({ message: "Send a valid coach payload." }, { status: 400 });
  }

  const upstream = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_COACH_MODEL ?? "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: buildCoachPrompt(payload) }],
        },
      ],
      max_output_tokens: 900,
    }),
  });
  const responsePayload = (await upstream.json().catch(() => null)) as unknown;

  if (!upstream.ok) {
    return NextResponse.json(
      { message: readOpenAiError(responsePayload) ?? "OpenAI coach summary failed." },
      { status: upstream.status },
    );
  }

  try {
    const text = readResponseText(responsePayload);
    return NextResponse.json({
      summary: parseAiCoachSummary(text),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Could not parse the AI coach response.",
      },
      { status: 422 },
    );
  }
}

function isAiCoachPayload(value: unknown): value is AiCoachPayload {
  if (
    !isRecord(value) ||
    (value.productName !== BRAND_NAME && value.productName !== LEGACY_BRAND_NAME) ||
    !isRecord(value.totals)
  ) {
    return false;
  }

  return (
    typeof value.headline === "string" &&
    typeof value.subhead === "string" &&
    Array.isArray(value.clubs) &&
    Array.isArray(value.signals) &&
    Array.isArray(value.sessionPlan)
  );
}

function readResponseText(payload: unknown) {
  if (isRecord(payload) && typeof payload.output_text === "string") {
    return payload.output_text;
  }

  if (!isRecord(payload) || !Array.isArray(payload.output)) {
    throw new Error("OpenAI response did not include text.");
  }

  const chunks: string[] = [];

  for (const item of payload.output) {
    if (!isRecord(item) || !Array.isArray(item.content)) {
      continue;
    }

    for (const content of item.content) {
      if (isRecord(content) && typeof content.text === "string") {
        chunks.push(content.text);
      }
    }
  }

  const text = chunks.join("\n").trim();

  if (!text) {
    throw new Error("OpenAI response did not include text.");
  }

  return text;
}

function readOpenAiError(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.error)) {
    return null;
  }

  return typeof payload.error.message === "string" ? payload.error.message : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
