import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SpeedReadinessPanel } from "./speed-readiness-panel";
describe("training context presentation", () => {
  it("renders the qualitative recommendation and reasons when no validated score exists", () => {
    const html = renderToStaticMarkup(
      <SpeedReadinessPanel
        development={{
          readiness: {
            score: null,
            status: "build",
            label: "Build a baseline",
            tone: "sky",
            recommendation: "Record a comparable speed session.",
            nextRecommendedDateIso: null,
            reasons: [{ label: "Evidence", detail: "No recorded session yet.", state: "missing" }],
          },
        }}
      />,
    );
    expect(html).toContain("Build a baseline");
    expect(html).toContain("Record a comparable speed session.");
    expect(html).toContain("No recorded session yet.");
    expect(html).toContain('href="/speed"');
    expect(html).not.toContain("/100");
    expect(html).not.toContain("Readiness score");
  });
});
