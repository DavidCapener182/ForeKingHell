import { describe, expect, it } from "vitest";

import { sanitizeCspReports } from "./csp-report";

describe("CSP report privacy", () => {
  it("reduces legacy reports to directive and origin categories", () => {
    expect(
      sanitizeCspReports(
        {
          "csp-report": {
            "blocked-uri": "https://tracker.example.test/script.js?token=secret",
            "document-uri": "https://app.example.test/today?private=value",
            "effective-directive": "script-src-elem",
            "source-file": "https://app.example.test/private.js?user=123",
          },
        },
        "https://app.example.test",
      ),
    ).toEqual([
      {
        blockedCategory: "cross_origin",
        directive: "script-src-elem",
        disposition: "unknown",
      },
    ]);
  });

  it("accepts Reporting API envelopes and classifies inline violations", () => {
    expect(
      sanitizeCspReports(
        [
          {
            type: "csp-violation",
            body: {
              blockedURL: "inline",
              disposition: "report",
              effectiveDirective: "style-src-elem",
            },
          },
        ],
        "https://app.example.test",
      ),
    ).toEqual([
      {
        blockedCategory: "inline",
        directive: "style-src-elem",
        disposition: "report",
      },
    ]);
  });

  it("drops malformed directives and caps batch processing", () => {
    const payload = Array.from({ length: 10 }, (_, index) => ({
      body: {
        blockedURL: "/asset.js",
        effectiveDirective: index === 0 ? "not a directive" : "script-src",
      },
    }));

    expect(sanitizeCspReports(payload, "https://app.example.test")).toHaveLength(4);
  });
});
