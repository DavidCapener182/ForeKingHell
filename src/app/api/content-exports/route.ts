import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { rateLimitRequest, readBoundedJsonBody } from "@/lib/api-protection";
import { buildFeedItemContentExportSnapshot } from "@/lib/content-exports";
import { getDb } from "@/db/client";
import { contentExports, feedItems, userProfiles } from "@/db/schema";
import { getOptionalCurrentUserId } from "@/lib/current-user";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 8 * 1024;

export async function POST(request: NextRequest) {
  const userId = await getOptionalCurrentUserId();

  if (!userId) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const rateLimitRejection = rateLimitRequest(request, {
    keyPrefix: "content-export",
    limit: 40,
    windowMs: 60 * 60 * 1000,
  });
  if (rateLimitRejection) {
    return rateLimitRejection;
  }

  const bodyResult = await readBoundedJsonBody(request, MAX_REQUEST_BYTES);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.value as {
    sourceId?: unknown;
    sourceType?: unknown;
    templateKey?: unknown;
  } | null;
  const sourceType = stringValue(body?.sourceType, "feed_item");
  const sourceId = stringValue(body?.sourceId);

  if (sourceType !== "feed_item") {
    return NextResponse.json({ message: "Only feed item exports are available." }, { status: 400 });
  }

  if (!sourceId) {
    return NextResponse.json({ message: "Source item is required." }, { status: 400 });
  }

  const db = getDb();
  const [item] = await db
    .select({
      id: feedItems.id,
      userId: feedItems.userId,
      headline: feedItems.headline,
      metricLabel: feedItems.metricLabel,
      metricValue: feedItems.metricValue,
      context: feedItems.context,
      verificationLabel: feedItems.verificationLabel,
      profileUsername: userProfiles.username,
    })
    .from(feedItems)
    .leftJoin(userProfiles, eq(userProfiles.userId, feedItems.userId))
    .where(and(eq(feedItems.id, sourceId), eq(feedItems.userId, userId)))
    .limit(1);

  if (!item) {
    return NextResponse.json({ message: "Source not found." }, { status: 404 });
  }

  const snapshot = buildFeedItemContentExportSnapshot(item);
  const templateKey = stringValue(body?.templateKey, "reel_pb_v1") || "reel_pb_v1";
  const [row] = await db
    .insert(contentExports)
    .values({
      userId,
      sourceType,
      sourceId: item.id,
      templateKey: templateKey.slice(0, 80),
      platform: "reel",
      format: "png_9x16",
      snapshotJson: snapshot,
      renderConfigJson: {
        width: 1080,
        height: 1920,
        version: "v1",
      },
      updatedAt: new Date(),
    })
    .returning({ id: contentExports.id });

  return NextResponse.json({
    exportId: row.id,
    imageUrl: `/api/content-exports/${row.id}/image`,
  });
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim().slice(0, 220) : fallback;
}
