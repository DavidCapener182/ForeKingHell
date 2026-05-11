import { NextRequest, NextResponse } from "next/server";

import { normalizeExtractedScorecard } from "@/lib/scorecard-extraction";

export const runtime = "nodejs";

const EXTRACTION_PROMPT = `Extract this golf scorecard image into JSON only.

Return this exact object shape:
{
  "courseName": string | null,
  "dateIso": "YYYY-MM-DD" | null,
  "teeName": string | null,
  "totalYards": number | null,
  "courseRating": number | null,
  "slopeRating": number | null,
  "totalScore": number | null,
  "totalPutts": number | null,
  "fairwaysHitTotal": number | null,
  "girTotal": number | null,
  "holes": [
    {
      "holeNumber": number,
      "par": number | null,
      "yards": number | null,
      "strokeIndex": number | null,
      "score": number | null,
      "netScore": number | null,
      "fairwayHit": boolean | null,
      "gir": boolean | null,
      "putts": number | null
    }
  ]
}

Important:
- This is often an 18Birdies scorecard.
- Check marks mean true, X marks mean false, dashes mean null.
- Par-3 holes usually have null fairwayHit.
- If the image says something like "White 6086 yds (138.0/70.8)", teeName is White, totalYards is 6086, slopeRating is 138, and courseRating is 70.8.
- If per-hole yards are not visible, use null for yards.
- Do not include markdown, explanation, or code fences.`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { message: "OPENAI_API_KEY is required for scorecard image extraction." },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => null)) as { imageDataUrl?: unknown } | null;
  const imageDataUrl = typeof body?.imageDataUrl === "string" ? body.imageDataUrl : "";

  if (!imageDataUrl.startsWith("data:image/")) {
    return NextResponse.json({ message: "Send a scorecard image data URL." }, { status: 400 });
  }

  const upstream = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_SCORECARD_MODEL ?? "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: EXTRACTION_PROMPT },
            { type: "input_image", image_url: imageDataUrl, detail: "high" },
          ],
        },
      ],
      max_output_tokens: 2200,
    }),
  });

  const payload = (await upstream.json().catch(() => null)) as unknown;

  if (!upstream.ok) {
    return NextResponse.json(
      { message: readOpenAiError(payload) ?? "OpenAI scorecard extraction failed." },
      { status: upstream.status },
    );
  }

  try {
    const text = readResponseText(payload);
    const parsed = parseJsonObject(text);
    const scorecard = normalizeExtractedScorecard(parsed);

    if (scorecard.holes.length === 0) {
      return NextResponse.json(
        { message: "The image was read, but no hole rows were detected." },
        { status: 422 },
      );
    }

    return NextResponse.json({ scorecard });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Could not parse the extracted scorecard JSON.",
      },
      { status: 422 },
    );
  }
}

function readResponseText(payload: unknown) {
  if (isRecord(payload) && typeof payload.output_text === "string") {
    return payload.output_text;
  }

  if (!isRecord(payload) || !Array.isArray(payload.output)) {
    throw new Error("OpenAI response did not include extracted text.");
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
    throw new Error("OpenAI response did not include extracted text.");
  }

  return text;
}

function parseJsonObject(text: string) {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "");
  const jsonText = trimmed.startsWith("{") ? trimmed : trimmed.match(/\{[\s\S]*\}/)?.[0];

  if (!jsonText) {
    throw new Error("Scorecard extraction did not return JSON.");
  }

  return JSON.parse(jsonText) as unknown;
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
