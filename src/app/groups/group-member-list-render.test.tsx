import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { GroupMemberList } from "./group-member-list";
vi.mock("@/hooks/use-client-ready", () => ({ useClientReady: () => true }));
vi.mock("@/components/app/responsive-detail-panel", () => ({ ResponsiveDetailPanel: () => null }));
describe("group member mobile results", () => {
  it("preserves zero weekly points as a recorded result", () => {
    const markup = renderToStaticMarkup(
      <GroupMemberList
        members={[
          {
            userId: "synthetic-player",
            username: "fixture",
            displayName: "Synthetic golfer",
            avatarUrl: null,
            role: "member",
            points: 0,
            summary: "Recorded round",
          },
        ]}
      />,
    );
    expect(markup).toContain("Weekly points: 0");
    expect(markup).not.toContain("Weekly points: Not recorded");
  });
  it("does not invent zero points for unavailable results", () => {
    const markup = renderToStaticMarkup(
      <GroupMemberList
        members={[
          {
            userId: "synthetic-player",
            username: "fixture",
            displayName: "Synthetic golfer",
            avatarUrl: null,
            role: "member",
          },
        ]}
      />,
    );
    expect(markup).toContain("Weekly points: Not recorded");
  });
});
