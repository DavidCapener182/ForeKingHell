import { describe, expect, it } from "vitest";

import {
  buildFeedActivityCsv,
  buildFeedActivityCsvHref,
  feedActivityExportFileName,
} from "@/app/feed/feed-csv-export";
import type { FeedItemView } from "@/lib/social";

function feedItem(overrides: Partial<FeedItemView> = {}): FeedItemView {
  return {
    id: "feed-1",
    userId: "user-1",
    itemType: "new_pb",
    headline: "New carry PB",
    metricLabel: "Carry",
    metricValue: "172 yd",
    context: "7 iron",
    proofUrl: "/sessions/session-1",
    visibility: "friends",
    verificationLabel: "Launch monitor verified",
    createdAt: new Date("2026-08-14T08:30:00.000Z"),
    profile: {
      userId: "user-1",
      username: "davy",
      displayName: "David Capener",
      avatarUrl: null,
      headerImageUrl: null,
      bio: null,
      homeCourse: null,
      primaryLaunchMonitor: null,
      handicapBand: null,
      publicProfile: true,
      friendProfile: true,
      leaderboardVisibility: "friends",
      feedVisibilityDefault: "friends",
      relationship: "self",
      isTourPlayer: false,
      canReceiveFriendRequests: true,
      isFollowing: false,
    },
    reactionCount: 3,
    commentCount: 2,
    viewerReacted: false,
    viewerCanManage: true,
    comments: [],
    ...overrides,
  };
}

describe("feed activity CSV export", () => {
  it("preserves the old ledger fields as one row per filtered timeline item", () => {
    const csv = buildFeedActivityCsv([
      feedItem(),
      feedItem({
        id: "feed-2",
        headline: "Round complete",
        context: null,
        itemType: "round_completed",
        metricLabel: null,
        metricValue: null,
        proofUrl: null,
        visibility: "public",
        reactionCount: 0,
        commentCount: 1,
      }),
    ]);
    const lines = csv.split("\n");

    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(
      '"Activity","Golfer","Type","Metric","Proof","Privacy","Engagement","Date","Action"',
    );
    expect(lines[1]).toContain('"New carry PB 7 iron"');
    expect(lines[1]).toContain('"David Capener @davy"');
    expect(lines[1]).toContain('"New Pb"');
    expect(lines[1]).toContain('"Carry · 172 yd"');
    expect(lines[1]).toContain('"Friends"');
    expect(lines[1]).toContain('"3 kudos · 2 comments"');
    expect(lines[1]).toContain('"/sessions/session-1"');
    expect(lines[2]).toContain('"Round complete"');
    expect(lines[2]).toContain('"Round Completed"');
    expect(lines[2]).toContain('"\'--"');
    expect(lines[2]).toContain('"/profile/davy"');
  });

  it("keeps current order, escapes spreadsheet formulas and creates a downloadable data URL", () => {
    const csv = buildFeedActivityCsv([
      feedItem({ headline: '=HYPERLINK("https://example.com")' }),
      feedItem({ id: "feed-2", headline: "Older update" }),
    ]);

    expect(csv.indexOf("HYPERLINK")).toBeLessThan(csv.indexOf("Older update"));
    expect(csv).toContain("'=HYPERLINK");
    expect(buildFeedActivityCsvHref([feedItem()])).toMatch(/^data:text\/csv;charset=utf-8,/);
    expect(feedActivityExportFileName("PBs & mine")).toBe(
      "forekinghell-feed-activity-pbs-mine.csv",
    );
  });
});
