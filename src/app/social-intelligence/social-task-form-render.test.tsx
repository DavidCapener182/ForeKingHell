import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SocialTaskForm } from "./social-task-form";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/hooks/use-client-ready", () => ({ useClientReady: () => true }));
vi.mock("@/app/social-intelligence/actions", () => ({ socialIntelligenceFormAction: vi.fn() }));
vi.mock("@/components/app/responsive-detail-panel", () => ({ ResponsiveDetailPanel: () => null }));
describe("recap source readiness", () => {
  it("prevents generation without activity and explains how to unlock it", () => {
    const markup = renderToStaticMarkup(
      <SocialTaskForm task="generate" sourceCount={0} sourcePeriod="No source activity" />,
    );
    expect(markup).toMatch(/<button[^>]*disabled=""/);
    expect(markup).toContain("before generating an activity recap");
  });
  it("keeps source-backed generation and content reporting available", () => {
    for (const props of [
      { task: "generate" as const, sourceCount: 2 },
      { task: "report" as const, sourceCount: 0 },
    ]) {
      const markup = renderToStaticMarkup(
        <SocialTaskForm {...props} sourcePeriod="Synthetic test period" />,
      );
      expect(markup).not.toMatch(/<button[^>]*disabled=""/);
    }
  });
});
