export const personalDataExportSchemaVersion = "2026-07-10";

type ExportRow = Record<string, unknown>;

type PersonalDataExportInput = {
  userId: string;
  exportedAt?: Date;
  profile: ExportRow | null;
  data: Record<string, unknown>;
};

const requesterFieldByDataset: Record<string, string> = {
  achievementProgress: "userId",
  achievementSyncState: "userId",
  aiGenerationCache: "userId",
  aiSocialSummaries: "userId",
  aiUsageEvents: "userId",
  ballModels: "userId",
  billingCustomers: "userId",
  challengeAttempts: "userId",
  challengeComments: "userId",
  challengeEntries: "userId",
  challengeResults: "userId",
  clubEquipmentHistory: "userId",
  clubs: "userId",
  contentExports: "userId",
  entitlements: "userId",
  equipmentSnapshots: "userId",
  feedCommentReactions: "userId",
  feedComments: "userId",
  feedItems: "userId",
  feedReactions: "userId",
  groupMemberships: "userId",
  groupPosts: "userId",
  importFiles: "userId",
  importJobs: "userId",
  importMappings: "userId",
  importRows: "userId",
  importSourceFiles: "userId",
  offerClicks: "userId",
  providerAccounts: "userId",
  providerSessions: "userId",
  rapsodoSyncSessions: "userId",
  sessions: "userId",
  shareLinks: "userId",
  shots: "userId",
  socialReports: "reporterUserId",
  stockYardages: "userId",
  strokesGainedShotEvents: "userId",
  subscriptions: "userId",
  usageEvents: "userId",
  userAchievements: "userId",
  userBlocks: "blockerUserId",
  userFollows: "followerUserId",
  xpLedger: "userId",
  accountMemberships: "memberUserId",
  challenges: "creatorUserId",
  courses: "createdByUserId",
  groupChallengeLinks: "createdByUserId",
  groups: "ownerUserId",
  sponsors: "ownerUserId",
};

const requesterPartyFieldsByDataset: Record<string, string[]> = {
  challengeInvites: ["inviterUserId", "inviteeUserId"],
  friendRequests: ["requesterUserId", "recipientUserId"],
  friendships: ["userAId", "userBId"],
  groupInvites: ["inviterUserId", "inviteeUserId"],
};

const excludedDatasets = new Set([
  "accountInvitations",
  "leaderboardSnapshots",
  "moderationEvents",
  "rivalryPairings",
  "rivalryWindows",
]);

const redactedFieldsByDataset: Record<string, string[]> = {
  billingCustomers: ["stripeCustomerId"],
  contentExports: ["storagePath"],
  importSourceFiles: ["storagePath", "metadataJson"],
  providerAccounts: ["providerAccountId", "metadataJson"],
  providerSessions: ["providerAccountId", "providerSessionId", "rawMetadataJson"],
  shareLinks: ["tokenHash"],
  subscriptions: ["billingCustomerId", "stripeSubscriptionId", "metadataJson"],
};

export function createPersonalDataExport({
  userId,
  exportedAt = new Date(),
  profile,
  data,
}: PersonalDataExportInput) {
  const scopedData = Object.fromEntries(
    Object.entries(data).map(([dataset, value]) => [
      dataset,
      scopeAndRedactDataset(dataset, value, userId),
    ]),
  );

  return {
    schemaVersion: personalDataExportSchemaVersion,
    scope: "personal" as const,
    exportedAt: exportedAt.toISOString(),
    userId,
    profile,
    data: scopedData,
  };
}

function scopeAndRedactDataset(dataset: string, value: unknown, userId: string) {
  if (excludedDatasets.has(dataset)) {
    return [];
  }

  if (!Array.isArray(value)) {
    return value;
  }

  const requesterField = requesterFieldByDataset[dataset];
  const partyFields = requesterPartyFieldsByDataset[dataset];
  const redactedFields = redactedFieldsByDataset[dataset] ?? [];

  return value
    .filter((row): row is ExportRow => {
      if (!isExportRow(row)) {
        return false;
      }

      if (requesterField) {
        return row[requesterField] === userId;
      }

      if (partyFields) {
        return partyFields.some((field) => row[field] === userId);
      }

      return true;
    })
    .map((row) => omitFields(row, redactedFields));
}

function omitFields(row: ExportRow, fields: string[]) {
  if (fields.length === 0) {
    return row;
  }

  const redacted = { ...row };
  for (const field of fields) {
    delete redacted[field];
  }

  return redacted;
}

function isExportRow(value: unknown): value is ExportRow {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
