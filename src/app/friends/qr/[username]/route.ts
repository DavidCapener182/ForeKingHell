import QRCode from "qrcode";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    username: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { username } = await context.params;
  const url = new URL(`/profile/${encodeURIComponent(username)}`, request.nextUrl.origin);
  const svg = await QRCode.toString(url.toString(), {
    type: "svg",
    margin: 1,
    width: 512,
    color: {
      dark: "#111827",
      light: "#ffffff",
    },
  });

  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
