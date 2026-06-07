import { NextRequest, NextResponse } from "next/server";

import {
  rejectOversizedDataUrl,
  rejectOversizedRequest,
  rateLimitRequest,
} from "@/lib/api-protection";
import { aiErrorPayload, generateAiJson } from "@/lib/ai/client";
import { scorecardExtractionSchema } from "@/lib/ai/schemas";
import { getOptionalCurrentUserId } from "@/lib/current-user";
import { normalizeExtractedScorecard } from "@/lib/scorecard-extraction";
import { createScorecardProofToken } from "@/lib/scorecard-proof-token";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 7 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

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
  const userId = await getOptionalCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const sizeRejection = rejectOversizedRequest(request, MAX_REQUEST_BYTES);
  if (sizeRejection) {
    return sizeRejection;
  }

  const rateLimitRejection = rateLimitRequest(request, {
    keyPrefix: "scorecard-extract",
    limit: 6,
    windowMs: 60 * 60 * 1000,
  });
  if (rateLimitRejection) {
    return rateLimitRejection;
  }

  const body = (await request.json().catch(() => null)) as { imageDataUrl?: unknown } | null;
  const imageDataUrl = typeof body?.imageDataUrl === "string" ? body.imageDataUrl : "";

  if (!imageDataUrl.startsWith("data:image/")) {
    return NextResponse.json({ message: "Send a scorecard image data URL." }, { status: 400 });
  }

  const imageSizeRejection = rejectOversizedDataUrl(imageDataUrl, MAX_IMAGE_BYTES);
  if (imageSizeRejection) {
    return imageSizeRejection;
  }

  try {
    const result = await generateAiJson({
      userId,
      featureKey: "scorecard_extract",
      schemaName: "scorecard_extraction",
      schema: scorecardExtractionSchema,
      messages: [
        {
          role: "user",
          content: [
            { type: "input_text", text: EXTRACTION_PROMPT },
            { type: "input_image", image_url: imageDataUrl, detail: "high" },
          ],
        },
      ],
      metadataJson: {
        estimatedImageBytes: estimateDataUrlBytes(imageDataUrl),
      },
    });
    const scorecard = normalizeExtractedScorecard(result.output);

    if (scorecard.holes.length === 0) {
      return NextResponse.json(
        { message: "The image was read, but no hole rows were detected." },
        { status: 422 },
      );
    }

    const proofToken = createScorecardProofToken({
      userId,
      totalScore: scorecard.totalScore,
      courseName: scorecard.courseName,
      teeName: scorecard.teeName,
      dateIso: scorecard.dateIso,
    });

    return NextResponse.json({
      scorecard,
      proofToken,
      confidence:
        typeof result.output.confidence === "string" ? result.output.confidence : "medium",
      generatedAt: result.generatedAt,
      creditsCharged: result.creditsCharged,
      creditsRemaining: result.creditsRemaining,
    });
  } catch (error) {
    const { body, status } = aiErrorPayload(error);
    return NextResponse.json(body, { status });
  }
}

function estimateDataUrlBytes(dataUrl: string) {
  const base64 = dataUrl.split(",", 2)[1] ?? "";
  return Math.ceil((base64.length * 3) / 4);
}
