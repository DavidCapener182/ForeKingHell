import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-observability", () => ({
  reportServerEvent: vi.fn(),
}));

import { reportServerEvent } from "@/lib/server-observability";

import { POST } from "./route";

let requestIndex = 0;

describe("POST /api/security/csp-report", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts a legacy report and logs only sanitized categories", async () => {
    const response = await POST(
      request(
        JSON.stringify({
          "csp-report": {
            "blocked-uri": "https://tracker.example.test/collect?token=secret",
            "document-uri": "https://app.example.test/today?player=private",
            "effective-directive": "script-src-elem",
          },
        }),
      ),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(reportServerEvent).toHaveBeenCalledWith("csp_violation", {
      "app.blocked_category": "cross_origin",
      "app.directive": "script-src-elem",
      "app.disposition": "unknown",
    });
  });

  it("rejects unsupported content types", async () => {
    const response = await POST(request("plain text", "text/plain"));

    expect(response.status).toBe(415);
    expect(reportServerEvent).not.toHaveBeenCalled();
  });

  it("rejects a body over 16 KB before parsing", async () => {
    const response = await POST(request(JSON.stringify({ padding: "x".repeat(17 * 1024) })));

    expect(response.status).toBe(413);
    expect(reportServerEvent).not.toHaveBeenCalled();
  });
});

function request(body: string, contentType = "application/csp-report") {
  requestIndex += 1;
  return new NextRequest("https://app.example.test/api/security/csp-report", {
    method: "POST",
    headers: {
      "content-length": Buffer.byteLength(body).toString(),
      "content-type": contentType,
      "x-forwarded-for": `203.0.113.${requestIndex}`,
    },
    body,
  });
}
