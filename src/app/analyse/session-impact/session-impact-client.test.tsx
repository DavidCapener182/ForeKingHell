import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SessionImpactClient } from "@/app/analyse/session-impact/session-impact-client";

const shots = [
  {
    id: "shot-1",
    shotNumber: 1,
    clubLabel: "7 Iron",
    carryYd: 154,
    totalYd: 160,
    sideYd: -4,
    qualityTag: "good",
    shotCategory: "stock",
    sessionSource: "rapsodo",
  },
  {
    id: "shot-2",
    shotNumber: 2,
    clubLabel: "7 Iron",
    carryYd: 158,
    totalYd: 164,
    sideYd: 3,
    qualityTag: "good",
    shotCategory: "stock",
    sessionSource: "rapsodo",
  },
  {
    id: "shot-3",
    shotNumber: 3,
    clubLabel: "7 Iron",
    carryYd: 151,
    totalYd: 157,
    sideYd: 7,
    qualityTag: "good",
    shotCategory: "stock",
    sessionSource: "rapsodo",
  },
];

describe("Session impact desktop composition", () => {
  it("renders the recommendation before controls and retains the specialist path visualisation", () => {
    const markup = renderToStaticMarkup(<SessionImpactClient shots={shots} />);

    expect(markup.indexOf("What changes next")).toBeLessThan(markup.indexOf("Reversible filter"));
    expect(markup).toContain("Reversible filter");
    expect(markup).toContain("Before and after");
    expect(markup).toContain('aria-label="Top-down summary of 3 shot paths"');
    expect(markup).toContain("Paths are estimated from landing endpoints");
    expect(markup).not.toContain("Change evidence filter");
    expect(markup).not.toContain('aria-label="Before and after metrics"');
  });

  it("keeps the empty state concise and actionable", () => {
    const markup = renderToStaticMarkup(<SessionImpactClient shots={[]} />);

    expect(markup).toContain("No measured shots in this session");
    expect(markup).toContain("Choose another session or import launch-monitor data");
  });
});
