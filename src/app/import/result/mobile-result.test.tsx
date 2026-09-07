import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// This suite verifies receipt navigation; the async saved-shot panel is covered separately.
vi.mock("@/app/import/import-result-shot-review", () => ({ ImportResultShotReview: () => null }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useSearchParams: () => new URLSearchParams(),
}));

const service = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("@/lib/companion-import-result", () => ({ getCompanionImportResult: service.load }));
vi.mock("@/app/sessions/mobile-session-story", () => ({ MobileSessionPattern: () => null }));
import ImportResultCompanionPage from "@/app/(app)/import/result/result-companion-page";

const receipt = {
  session: {
    id: "11111111-1111-4111-8111-111111111111",
    fileName: "session.csv",
    source: "rapsodo",
  },
  shotCount: 4,
  clubCount: 1,
  sessionVerdict: "Another session will help establish a baseline.",
  triage: { confirmationCount: 0, stockQualityCount: 3, confirmedExcludedCount: 1 },
  triagePath: "4 saved shots",
  fieldIssueCount: 0,
  rawRowCount: 4,
  rawUnknownRowCount: 0,
  reviewHref: "/sessions/11111111-1111-4111-8111-111111111111",
  suggestionReviewHref: "/shots/review?sessionId=11111111-1111-4111-8111-111111111111",
  isRound: false,
  improved: null,
  needsWork: null,
  practiceReview: null,
  patternPoints: [],
  preferredClub: null,
  clubs: ["7i"],
  sourceStatus: "saved",
  parseVersion: "v1",
  verdict: {
    today: {
      carryAverageYd: 140,
      offlineAverageYd: null,
      playableRate: null,
      carryRobustStdDevYd: null,
    },
  },
};

async function render() {
  return renderToStaticMarkup(
    await ImportResultCompanionPage({
      searchParams: Promise.resolve({ sessionId: "11111111-1111-4111-8111-111111111111" }),
    }),
  );
}
beforeEach(() => service.load.mockResolvedValue(receipt));

describe("mobile import next action", () => {
  it("prioritises reversible review when shots need confirmation", async () => {
    service.load.mockResolvedValue({
      ...receipt,
      triage: { ...receipt.triage, confirmationCount: 2 },
    });
    const html = await render();
    expect(html).toMatch(
      /href="\/shots\/review\?sessionId=11111111-1111-4111-8111-111111111111"[^>]*>Confirm flagged shots/,
    );
    expect(html).toContain("2 shots to confirm");
    expect(html).toContain("Open session");
    expect(html).not.toContain("shots ready for trusted analysis");
    expect(html.match(/<h1\b/g)).toHaveLength(1);
  });

  it("opens the saved round instead of starting another practice flow", async () => {
    service.load.mockResolvedValue({
      ...receipt,
      isRound: true,
      reviewHref: "/rounds/11111111-1111-4111-8111-111111111111",
    });
    const html = await render();
    expect(html).toMatch(
      /href="\/rounds\/11111111-1111-4111-8111-111111111111"[^>]*>Review this round/,
    );
    expect(html).toContain("Round saved");
    expect(html).toContain("Your round is ready to review.");
    expect(html).not.toContain(receipt.sessionVerdict);
    expect(html).not.toContain("Build next plan");
    expect(html).not.toContain("<table");
  });

  it("keeps baseline wording and missing evidence honest", async () => {
    const html = await render();
    expect(html).toContain("Baseline building");
    expect(html).toContain("Next measurement");
    expect(html).not.toContain("What improved");
    expect(html).toContain("Session saved");
    expect(html).toContain("All sessions");
  });
});
