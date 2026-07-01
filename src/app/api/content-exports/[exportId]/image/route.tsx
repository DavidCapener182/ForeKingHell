import { and, eq } from "drizzle-orm";
import { ImageResponse } from "next/og";

import { getDb } from "@/db/client";
import { contentExports } from "@/db/schema";
import { BRAND_NAME } from "@/lib/brand";
import { readContentExportSnapshot } from "@/lib/content-exports";
import { getOptionalCurrentUserId } from "@/lib/current-user";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    exportId: string;
  }>;
};

const imageSize = {
  width: 1080,
  height: 1920,
};

export async function GET(_request: Request, context: RouteContext) {
  const userId = await getOptionalCurrentUserId();

  if (!userId) {
    return Response.json({ message: "Authentication required." }, { status: 401 });
  }

  const { exportId } = await context.params;
  const db = getDb();
  const [row] = await db
    .select({
      id: contentExports.id,
      snapshotJson: contentExports.snapshotJson,
    })
    .from(contentExports)
    .where(and(eq(contentExports.id, exportId), eq(contentExports.userId, userId)))
    .limit(1);

  if (!row) {
    return Response.json({ message: "Export not found." }, { status: 404 });
  }

  await db
    .update(contentExports)
    .set({
      lastRenderedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(contentExports.id, row.id), eq(contentExports.userId, userId)));

  const snapshot = readContentExportSnapshot(row.snapshotJson);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
          padding: 72,
          background:
            "linear-gradient(154deg, rgba(126,224,163,0.20) 0%, rgba(16,22,18,0.00) 34%), linear-gradient(28deg, rgba(199,151,43,0.22) 0%, rgba(16,22,18,0.00) 28%), #101612",
          color: "#fffdf4",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 42,
            border: "2px solid rgba(255,253,244,0.14)",
            borderRadius: 46,
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -180,
            top: 156,
            width: 520,
            height: 520,
            borderRadius: 999,
            background: "rgba(126,224,163,0.13)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -160,
            bottom: 260,
            width: 460,
            height: 460,
            borderRadius: 999,
            background: "rgba(44,147,212,0.12)",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 1,
          }}
        >
          <div
            style={{
              fontSize: 42,
              letterSpacing: 6,
              fontWeight: 800,
              color: "#7ee0a3",
              textTransform: "uppercase",
            }}
          >
            {BRAND_NAME}
          </div>
          <div
            style={{
              border: "1px solid rgba(255,253,244,0.22)",
              borderRadius: 999,
              padding: "14px 24px",
              fontSize: 26,
              fontWeight: 700,
              color: "#d8e6dc",
            }}
          >
            @{snapshot.username}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            zIndex: 1,
            marginTop: 178,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 132,
              height: 8,
              borderRadius: 999,
              background: "#c7972b",
              marginBottom: 48,
            }}
          />
          <div
            style={{
              display: "flex",
              fontSize: 88,
              lineHeight: 0.98,
              fontWeight: 900,
              letterSpacing: -1,
              color: "#fffdf4",
            }}
          >
            {snapshot.title}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            zIndex: 1,
            marginTop: 112,
            padding: "44px 42px",
            borderRadius: 34,
            border: "1px solid rgba(255,253,244,0.16)",
            background:
              "linear-gradient(135deg, rgba(255,253,244,0.12), rgba(255,253,244,0.04))",
          }}
        >
          <div
            style={{
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: 5,
              color: "#c7972b",
              textTransform: "uppercase",
            }}
          >
            {snapshot.metricLabel}
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 152,
              lineHeight: 0.92,
              fontWeight: 900,
              color: "#7ee0a3",
            }}
          >
            {snapshot.metricValue}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            zIndex: 1,
            marginTop: "auto",
          }}
        >
          <div
            style={{
              fontSize: 38,
              lineHeight: 1.26,
              fontWeight: 700,
              color: "#d8e6dc",
            }}
          >
            {snapshot.context}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 36,
              paddingTop: 32,
              borderTop: "1px solid rgba(255,253,244,0.16)",
              fontSize: 28,
              fontWeight: 700,
              color: "#8fb39d",
            }}
          >
            <div>{snapshot.footer}</div>
            <div>{formatShortDate(snapshot.generatedAt)}</div>
          </div>
        </div>
      </div>
    ),
    {
      ...imageSize,
      headers: {
        "cache-control": "private, max-age=60",
      },
    },
  );
}

function formatShortDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
