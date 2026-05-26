import { NextRequest, NextResponse } from "next/server";

import { rejectOversizedRequest, rateLimitRequest } from "@/lib/api-protection";
import { getOptionalCurrentUserId } from "@/lib/current-user";
import { buildCoachSqlContext } from "@/lib/coach-sql-context";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 16 * 1024;

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
    keyPrefix: "coach-chat",
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (rateLimitRejection) {
    return rateLimitRejection;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { message: "OPENAI_API_KEY is required for AI coach chat." },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => null)) as { message?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 600) : "";

  if (!message) {
    return NextResponse.json({ message: "Send a coach question." }, { status: 400 });
  }

  const context = await buildCoachSqlContext(userId, message);
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
      max_output_tokens: 700,
    }),
  });
  const payload = (await upstream.json().catch(() => null)) as unknown;

  if (!upstream.ok) {
    return NextResponse.json(
      { message: readOpenAiError(payload) ?? "OpenAI coach chat failed." },
      { status: upstream.status },
    );
  }

  return NextResponse.json({
    answer: readResponseText(payload),
    citations: context.citations,
    generatedAt: new Date().toISOString(),
  });
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

  return chunks.join("\n").trim();
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
