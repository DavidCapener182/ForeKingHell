import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ChallengeGridSection } from "@/app/challenges/challenge-grid-section";
import { Card } from "@/components/ui/card";

describe("challenge grid Card composition", () => {
  it("renders challenge Cards directly inside a semantic section", () => {
    const markup = renderToStaticMarkup(
      <ChallengeGridSection
        title="My active entries"
        description="Challenges you have joined or created."
      >
        <Card data-challenge-card>Measured fairways</Card>
      </ChallengeGridSection>,
    );

    expect(markup).toContain("data-challenge-grid-section");
    expect(markup.match(/data-slot="card"/g)).toHaveLength(1);
    expect(markup.match(/data-challenge-card/g)).toHaveLength(1);
    expect(markup).not.toContain("desktop-data-panel");
  });
});
