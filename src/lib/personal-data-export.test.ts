import { describe, expect, it } from "vitest";

import { createPersonalDataExport } from "@/lib/personal-data-export";

describe("createPersonalDataExport", () => {
  it("keeps only requester-owned or requester-authored relationship rows", () => {
    const payload = createPersonalDataExport({
      userId: "user-1",
      exportedAt: new Date("2026-07-10T08:00:00.000Z"),
      profile: { id: "user-1", email: "golfer@example.com" },
      data: {
        clubs: [
          { id: "club-1", userId: "user-1" },
          { id: "club-2", userId: "user-2" },
        ],
        accountMemberships: [
          { id: "membership-for-me", ownerUserId: "user-2", memberUserId: "user-1" },
          { id: "membership-for-other", ownerUserId: "user-1", memberUserId: "user-2" },
        ],
        userBlocks: [
          { id: "i-blocked", blockerUserId: "user-1", blockedUserId: "user-2" },
          { id: "blocked-me", blockerUserId: "user-2", blockedUserId: "user-1" },
        ],
        socialReports: [
          { id: "i-reported", reporterUserId: "user-1", reportedUserId: "user-2" },
          { id: "reported-me", reporterUserId: "user-2", reportedUserId: "user-1" },
        ],
        groupMemberships: [
          { id: "my-group-row", userId: "user-1", groupId: "group-1" },
          { id: "other-group-row", userId: "user-2", groupId: "group-1" },
        ],
        coachPlayerInteractions: [
          {
            id: "player-visible",
            playerUserId: "user-1",
            coachUserId: "user-2",
            visibility: "player_visible",
          },
          {
            id: "coach-private",
            playerUserId: "user-1",
            coachUserId: "user-2",
            visibility: "coach_only",
          },
          {
            id: "authored-by-me",
            playerUserId: "user-2",
            coachUserId: "user-1",
            visibility: "coach_only",
          },
        ],
        moderationEvents: [{ id: "internal-event", targetId: "user-1" }],
        leaderboardSnapshots: [{ id: "group-standings", groupId: "group-1" }],
      },
    });

    expect(payload).toMatchObject({
      schemaVersion: "2026-07-21",
      scope: "personal",
      exportedAt: "2026-07-10T08:00:00.000Z",
      userId: "user-1",
    });
    expect(payload.data.clubs).toEqual([{ id: "club-1", userId: "user-1" }]);
    expect(payload.data.accountMemberships).toEqual([
      { id: "membership-for-me", ownerUserId: "user-2", memberUserId: "user-1" },
      { id: "membership-for-other", ownerUserId: "user-1", memberUserId: "user-2" },
    ]);
    expect(payload.data.userBlocks).toEqual([
      { id: "i-blocked", blockerUserId: "user-1", blockedUserId: "user-2" },
    ]);
    expect(payload.data.socialReports).toEqual([
      { id: "i-reported", reporterUserId: "user-1", reportedUserId: "user-2" },
    ]);
    expect(payload.data.groupMemberships).toEqual([
      { id: "my-group-row", userId: "user-1", groupId: "group-1" },
    ]);
    expect(payload.data.coachPlayerInteractions).toEqual([
      {
        id: "player-visible",
        playerUserId: "user-1",
        coachUserId: "user-2",
        visibility: "player_visible",
      },
      {
        id: "authored-by-me",
        playerUserId: "user-2",
        coachUserId: "user-1",
        visibility: "coach_only",
      },
    ]);
    expect(payload.data.moderationEvents).toEqual([]);
    expect(payload.data.leaderboardSnapshots).toEqual([]);
    expect(payload.manifest).toContainEqual({
      dataset: "clubs",
      rowCount: 1,
      containsSensitiveData: true,
    });
    expect(payload.checksum).toMatchObject({ algorithm: "sha256" });
    expect(payload.checksum.value).toMatch(/^[a-f0-9]{64}$/);
  });

  it("redacts tokens, provider payloads and internal storage metadata", () => {
    const payload = createPersonalDataExport({
      userId: "user-1",
      exportedAt: new Date("2026-07-10T08:00:00.000Z"),
      profile: { id: "user-1" },
      data: {
        shareLinks: [
          {
            id: "share-1",
            userId: "user-1",
            tokenHash: "secret-hash",
            resourceId: "round-1",
          },
        ],
        providerAccounts: [
          {
            id: "provider-1",
            userId: "user-1",
            providerAccountId: "remote-account-id",
            metadataJson: { credentialHint: "private" },
            displayName: "My Rapsodo",
          },
        ],
        providerSessions: [
          {
            id: "provider-session-1",
            userId: "user-1",
            providerSessionId: "remote-session-id",
            rawMetadataJson: { signedUrl: "private" },
            title: "Range work",
          },
        ],
        importSourceFiles: [
          {
            id: "source-1",
            userId: "user-1",
            storagePath: "private/user-1/file.csv",
            fileName: "session.csv",
          },
        ],
        contentExports: [
          {
            id: "export-1",
            userId: "user-1",
            storagePath: "private/user-1/card.png",
            snapshotJson: { title: "PB" },
          },
        ],
        subscriptions: [
          {
            id: "subscription-1",
            userId: "user-1",
            stripeSubscriptionId: "sub_secret",
            metadataJson: { checkout: "internal" },
            planKey: "full",
          },
        ],
      },
    });

    expect(payload.data.shareLinks).toEqual([
      { id: "share-1", userId: "user-1", resourceId: "round-1" },
    ]);
    expect(payload.data.providerAccounts).toEqual([
      { id: "provider-1", userId: "user-1", displayName: "My Rapsodo" },
    ]);
    expect(payload.data.providerSessions).toEqual([
      { id: "provider-session-1", userId: "user-1", title: "Range work" },
    ]);
    expect(payload.data.importSourceFiles).toEqual([
      { id: "source-1", userId: "user-1", fileName: "session.csv" },
    ]);
    expect(payload.data.contentExports).toEqual([
      { id: "export-1", userId: "user-1", snapshotJson: { title: "PB" } },
    ]);
    expect(payload.data.subscriptions).toEqual([
      { id: "subscription-1", userId: "user-1", planKey: "full" },
    ]);
  });
});
