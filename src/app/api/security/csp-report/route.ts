import { NextRequest, NextResponse } from "next/server";

import { rateLimitRequest, readBoundedJsonBody } from "@/lib/api-protection";
import { sanitizeCspReports } from "@/lib/csp-report";
import { reportServerEvent } from "@/lib/server-observability";

const MAX_CSP_REPORT_BYTES = 16 * 1024;

export async function POST(request: NextRequest) {
  const rateLimit = rateLimitRequest(request, {
    keyPrefix: "csp-report",
    limit: 60,
    windowMs: 60_000,
  });
  if (rateLimit) return rateLimit;

  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim();
  if (
    contentType !== "application/csp-report" &&
    contentType !== "application/reports+json" &&
    contentType !== "application/json"
  ) {
    return NextResponse.json({ message: "Unsupported report type." }, { status: 415 });
  }

  const body = await readBoundedJsonBody(request, MAX_CSP_REPORT_BYTES);
  if (!body.ok) return body.response;

  for (const report of sanitizeCspReports(body.value, request.nextUrl.origin)) {
    reportServerEvent("csp_violation", {
      "app.blocked_category": report.blockedCategory,
      "app.directive": report.directive,
      "app.disposition": report.disposition,
    });
  }

  return new NextResponse(null, {
    status: 204,
    headers: { "cache-control": "no-store" },
  });
}
