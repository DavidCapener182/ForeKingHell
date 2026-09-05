import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/app/(app)/shots/actions", () => ({
  deleteShotsAction: vi.fn(),
  excludeShotAction: vi.fn(),
  restoreShotAction: vi.fn(),
  reviewShotsAction: vi.fn(),
}));
import { ShotReviewButton } from "./shot-review-controls";
describe("mobile review queue intent", () => {
  it("offers exclusion for a suggestion instead of duplicating Keep", () => {
    const html = renderToStaticMarkup(
      <ShotReviewButton shotId="shot" reviewStatus="suggested_exclusion" intent="exclude" />,
    );
    expect(html).toContain("Exclude from stats");
    expect(html).not.toContain("Keep shot");
  });
  it("retains ordinary suggestion dismissal and excluded-shot restoration", () => {
    expect(
      renderToStaticMarkup(<ShotReviewButton shotId="shot" reviewStatus="suggested_exclusion" />),
    ).toContain("Keep shot");
    expect(
      renderToStaticMarkup(<ShotReviewButton shotId="shot" reviewStatus="user_excluded" />),
    ).toContain("Restore shot");
  });
});
