import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { clubs, stockYardages } from "@/db/schema";
import { getDb } from "@/db/client";
import { rateLimitRequest, readBoundedJsonBody } from "@/lib/api-protection";
import { aiErrorPayload, generateAiJson } from "@/lib/ai/client";
import { courseStrategySchema } from "@/lib/ai/schemas";
import { formatClubType } from "@/lib/club-format";
import { getOptionalCurrentUserId } from "@/lib/current-user";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 32 * 1024;

export async function POST(request: NextRequest) {
  const userId = await getOptionalCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const rateLimitRejection = rateLimitRequest(request, {
    keyPrefix: "ai-course-strategy",
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (rateLimitRejection) {
    return rateLimitRejection;
  }

  const bodyResult = await readBoundedJsonBody(request, MAX_REQUEST_BYTES);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.value as {
    hole?: unknown;
    goal?: unknown;
  } | null;
  const hole = normalizeHole(body?.hole);
  const bag = await buildBagContext(userId);

  if (bag.length === 0) {
    return NextResponse.json(
      { message: "Add trusted stock yardages before asking for AI course strategy." },
      { status: 422 },
    );
  }

  const context = {
    hole,
    goal: stringOrNull(body?.goal)?.slice(0, 180) ?? "avoid double",
    bag,
  };

  try {
    const result = await generateAiJson({
      userId,
      featureKey: "course_strategy",
      schemaName: "course_strategy",
      schema: courseStrategySchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `You are a golf course-strategy assistant.
Use only the supplied bag and hole JSON. Do not invent club distances, course features, handicaps, or records.
Recommend a club or route, explain the risk, and include one alternative.

Data:
${JSON.stringify(context, null, 2)}`,
            },
          ],
        },
      ],
      cachePayload: context,
      metadataJson: {
        bagClubCount: bag.length,
        holeNumber: hole.holeNumber,
      },
    });

    return NextResponse.json({
      strategy: result.output,
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

async function buildBagContext(userId: string) {
  const [clubRows, stockRows] = await Promise.all([
    getDb()
      .select({
        id: clubs.id,
        type: clubs.type,
        brand: clubs.brand,
        model: clubs.model,
      })
      .from(clubs)
      .where(and(eq(clubs.userId, userId), eq(clubs.active, true))),
    getDb()
      .select({
        clubId: stockYardages.clubId,
        sampleSize: stockYardages.sampleSize,
        carryMedianYd: stockYardages.carryMedianYd,
        recommendedPlayNumberYd: stockYardages.recommendedPlayNumberYd,
        dispersionLeftYd: stockYardages.dispersionLeftYd,
        dispersionRightYd: stockYardages.dispersionRightYd,
        confidenceScore: stockYardages.confidenceScore,
        calculatedAt: stockYardages.calculatedAt,
      })
      .from(stockYardages)
      .where(eq(stockYardages.userId, userId))
      .orderBy(desc(stockYardages.calculatedAt))
      .limit(60),
  ]);
  const latestStockByClubId = new Map<string, (typeof stockRows)[number]>();

  for (const row of stockRows) {
    if (!latestStockByClubId.has(row.clubId)) {
      latestStockByClubId.set(row.clubId, row);
    }
  }

  return clubRows
    .map((club) => {
      const stock = latestStockByClubId.get(club.id);

      if (!stock || stock.recommendedPlayNumberYd === null) {
        return null;
      }

      return {
        clubId: club.id,
        club: formatClubType(club.type),
        brandModel: [club.brand, club.model].filter(Boolean).join(" ") || null,
        playNumberYd: stock.recommendedPlayNumberYd,
        carryMedianYd: stock.carryMedianYd,
        sampleSize: stock.sampleSize,
        confidenceScore: stock.confidenceScore,
        dispersionLeftYd: stock.dispersionLeftYd,
        dispersionRightYd: stock.dispersionRightYd,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .slice(0, 18);
}

function normalizeHole(value: unknown) {
  const record = isRecord(value) ? value : {};

  return {
    holeNumber: numberOrNull(record.holeNumber),
    par: numberOrNull(record.par),
    distanceYd: numberOrNull(record.distanceYd ?? record.distance),
    hazards: stringList(record.hazards).slice(0, 8),
    notes: stringOrNull(record.notes)?.slice(0, 300) ?? null,
  };
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
