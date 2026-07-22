export type DataGovernanceCategory =
  | "account"
  | "administrative"
  | "ai"
  | "analysis"
  | "billing"
  | "competition"
  | "golf"
  | "import"
  | "reference"
  | "social"
  | "system";

export type DataGovernanceEntry = {
  dataset: string;
  table: string;
  category: DataGovernanceCategory;
  ownerFields: string[];
  export: boolean;
  deletion: "cascade" | "explicit" | "retain" | "anonymize";
  retention: "account-lifetime" | "user-controlled" | "legal" | "operational" | "permanent";
  containsSensitiveData: boolean;
  redactedFields: string[];
  exportRules?: DataGovernanceExportRule[];
};

export type DataGovernanceExportRule = {
  ownerField: string;
  requiredField?: string;
  allowedValues?: string[];
};

const directUserOwned = [
  "userProfiles",
  "feedItems",
  "feedReactions",
  "feedComments",
  "feedCommentReactions",
  "challengeEntries",
  "challengeAttempts",
  "challengeResults",
  "challengeComments",
  "groupMemberships",
  "groupPosts",
  "billingCustomers",
  "subscriptions",
  "entitlements",
  "usageEvents",
  "aiUsageEvents",
  "aiGenerationCache",
  "offerClicks",
  "providerAccounts",
  "providerSessions",
  "importJobs",
  "importSourceFiles",
  "importMappings",
  "aiSocialSummaries",
  "shareLinks",
  "contentExports",
  "clubs",
  "weatherSnapshots",
  "sessions",
  "importRows",
  "importFiles",
  "shots",
  "stockYardages",
  "ballModels",
  "clubEquipmentHistory",
  "equipmentSnapshots",
  "analysisAnnotations",
  "analysisSnapshots",
  "strokesGainedShotEvents",
  "userAchievements",
  "xpLedger",
  "achievementProgress",
  "achievementSyncState",
  "rapsodoSyncSessions",
  "speedTrainingSessions",
  "speedTrainingSwings",
  "speedTrainingGoals",
  "golfTrainingSessions",
  "courseRecordAttempts",
  "courseRecordResults",
  "scorecardProofConsumptions",
  "tournamentEntries",
  "tournamentSubmissions",
  "tournamentStandings",
  "tournamentComments",
  "shotSavedViews",
  "practiceSessions",
  "practiceTemplates",
  "practicePlans",
  "practiceBlocks",
  "practiceResults",
  "practicePlanMatches",
  "practiceBlockResults",
  "courseRecordGoals",
  "courseFollows",
  "userFeaturePreferences",
  "weeklyRecaps",
  "offlineOperations",
] as const;

const directUserOwnedSet = new Set<string>(directUserOwned);

const specialEntries: Array<Omit<DataGovernanceEntry, "table" | "redactedFields">> = [
  owned("users", "account", ["id"], "explicit", true),
  owned("userIdentityLinks", "account", ["linkedUserId", "canonicalUserId"], "explicit", true),
  owned("friendRequests", "social", ["requesterUserId", "recipientUserId"], "explicit", true),
  owned("friendships", "social", ["userAId", "userBId"], "explicit", true),
  owned("userBlocks", "social", ["blockerUserId"], "explicit", true),
  owned("userFollows", "social", ["followerUserId"], "explicit", true),
  owned("challenges", "competition", ["creatorUserId"], "explicit", true),
  owned("challengeInvites", "competition", ["inviterUserId", "inviteeUserId"], "explicit", true),
  owned("groups", "social", ["ownerUserId"], "explicit", true),
  owned("groupInvites", "social", ["inviterUserId", "inviteeUserId"], "explicit", true),
  owned("groupChallengeLinks", "social", ["createdByUserId"], "explicit", true),
  owned("sponsors", "billing", ["ownerUserId"], "explicit", true),
  owned("socialReports", "administrative", ["reporterUserId"], "retain", true),
  owned("accountMemberships", "account", ["ownerUserId", "memberUserId"], "explicit", true),
  {
    ...owned("coachPlayerInteractions", "golf", ["playerUserId", "coachUserId"], "cascade", true),
    exportRules: [
      { ownerField: "coachUserId" },
      {
        ownerField: "playerUserId",
        requiredField: "visibility",
        allowedValues: ["player_visible"],
      },
    ],
  },
  owned("accountInvitations", "account", ["ownerUserId"], "explicit", false),
  owned("courses", "golf", ["createdByUserId"], "explicit", true),
  owned("courseRecords", "competition", ["createdByUserId"], "explicit", true),
  owned("courseRecordFlags", "administrative", ["reporterUserId"], "retain", true),
  owned("tournaments", "competition", ["createdByUserId"], "explicit", true),
  owned("tournamentInvites", "competition", ["inviterUserId", "inviteeUserId"], "explicit", true),
];

const retainedDatasets = new Set([
  "adminUsers",
  "adminAuditLog",
  "challengeTemplates",
  "challengeRewards",
  "rivalryWindows",
  "rivalryPairings",
  "leaderboardSnapshots",
  "stripeWebhookEvents",
  "planLimits",
  "moderationEvents",
  "teeSets",
  "holes",
  "courseFeatures",
  "strokesGainedBaselines",
  "golfTrainingDailyLoad",
  "courseProviderAliases",
  "courseRecordCategories",
  "courseRecordEvidence",
  "tournamentRounds",
  "tournamentEvidence",
  "tournamentPrizes",
  "partnerOffers",
]);

const allSchemaDatasets = [
  "users",
  "adminUsers",
  "adminAuditLog",
  "userProfiles",
  "userIdentityLinks",
  "friendRequests",
  "friendships",
  "userBlocks",
  "userFollows",
  "feedItems",
  "feedReactions",
  "feedComments",
  "feedCommentReactions",
  "challengeTemplates",
  "challenges",
  "challengeEntries",
  "challengeAttempts",
  "challengeResults",
  "challengeComments",
  "challengeInvites",
  "groups",
  "groupMemberships",
  "groupInvites",
  "groupPosts",
  "groupChallengeLinks",
  "rivalryWindows",
  "rivalryPairings",
  "leaderboardSnapshots",
  "billingCustomers",
  "subscriptions",
  "stripeWebhookEvents",
  "entitlements",
  "usageEvents",
  "planLimits",
  "aiUsageEvents",
  "aiGenerationCache",
  "sponsors",
  "challengeRewards",
  "partnerOffers",
  "offerClicks",
  "providerAccounts",
  "providerSessions",
  "importJobs",
  "importSourceFiles",
  "importMappings",
  "aiSocialSummaries",
  "socialReports",
  "moderationEvents",
  "accountMemberships",
  "accountInvitations",
  "shareLinks",
  "contentExports",
  "clubs",
  "courses",
  "teeSets",
  "holes",
  "courseFeatures",
  "weatherSnapshots",
  "sessions",
  "importRows",
  "importFiles",
  "shots",
  "stockYardages",
  "ballModels",
  "clubEquipmentHistory",
  "equipmentSnapshots",
  "analysisAnnotations",
  "analysisSnapshots",
  "strokesGainedBaselines",
  "strokesGainedShotEvents",
  "userAchievements",
  "xpLedger",
  "achievementProgress",
  "achievementSyncState",
  "rapsodoSyncSessions",
  "speedTrainingSessions",
  "speedTrainingSwings",
  "speedTrainingGoals",
  "golfTrainingSessions",
  "golfTrainingDailyLoad",
  "courseProviderAliases",
  "courseRecordCategories",
  "courseRecords",
  "courseRecordAttempts",
  "courseRecordResults",
  "courseRecordEvidence",
  "scorecardProofConsumptions",
  "courseRecordFlags",
  "tournaments",
  "tournamentRounds",
  "tournamentEntries",
  "tournamentSubmissions",
  "tournamentEvidence",
  "tournamentStandings",
  "tournamentComments",
  "tournamentInvites",
  "tournamentPrizes",
  "shotSavedViews",
  "practiceSessions",
  "practiceTemplates",
  "practicePlans",
  "practiceBlocks",
  "practiceResults",
  "practicePlanMatches",
  "practiceBlockResults",
  "coachPlayerInteractions",
  "courseRecordGoals",
  "courseFollows",
  "userFeaturePreferences",
  "weeklyRecaps",
  "offlineOperations",
] as const;

const redactions: Record<string, string[]> = {
  billingCustomers: ["stripeCustomerId"],
  contentExports: ["storagePath"],
  importSourceFiles: ["storagePath", "metadataJson"],
  offlineOperations: ["requestHash", "responseJson"],
  providerAccounts: ["providerAccountId", "metadataJson"],
  providerSessions: ["providerAccountId", "providerSessionId", "rawMetadataJson"],
  shareLinks: ["tokenHash"],
  subscriptions: ["billingCustomerId", "stripeSubscriptionId", "metadataJson"],
};

const specialByDataset = new Map(specialEntries.map((entry) => [entry.dataset, entry]));

export const dataGovernanceManifest: DataGovernanceEntry[] = allSchemaDatasets.map((dataset) => {
  const special = specialByDataset.get(dataset);
  if (special) return withPhysicalTable(special);

  if (directUserOwnedSet.has(dataset)) {
    return withPhysicalTable(owned(dataset, categoryFor(dataset), ["userId"], "cascade", true));
  }

  if (!retainedDatasets.has(dataset)) {
    throw new Error(`Data governance classification missing for ${dataset}.`);
  }

  return withPhysicalTable({
    dataset,
    category: categoryFor(dataset),
    ownerFields: [],
    export: false,
    deletion: "retain",
    retention:
      dataset.includes("Audit") || dataset.includes("moderation") ? "legal" : "operational",
    containsSensitiveData: categoryFor(dataset) !== "reference",
  });
});

export const dataGovernanceByDataset = new Map(
  dataGovernanceManifest.map((entry) => [entry.dataset, entry]),
);

export function governanceForDataset(dataset: string) {
  return (
    dataGovernanceByDataset.get(dataset === "socialProfile" ? "userProfiles" : dataset) ?? null
  );
}

export function exportRulesForGovernance(
  governance: DataGovernanceEntry,
): DataGovernanceExportRule[] {
  return governance.exportRules ?? governance.ownerFields.map((ownerField) => ({ ownerField }));
}

function owned(
  dataset: string,
  category: DataGovernanceCategory,
  ownerFields: string[],
  deletion: DataGovernanceEntry["deletion"],
  exportable: boolean,
): Omit<DataGovernanceEntry, "table" | "redactedFields"> {
  return {
    dataset,
    category,
    ownerFields,
    export: exportable,
    deletion,
    retention: "user-controlled",
    containsSensitiveData: true,
  };
}

function withPhysicalTable(
  entry: Omit<DataGovernanceEntry, "table" | "redactedFields">,
): DataGovernanceEntry {
  return {
    ...entry,
    table: `fkh_${entry.dataset.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}`,
    redactedFields: redactions[entry.dataset] ?? [],
  };
}

function categoryFor(dataset: string): DataGovernanceCategory {
  if (/^(admin|moderation|socialReports|courseRecordFlags)/.test(dataset)) return "administrative";
  if (/^(ai)/.test(dataset)) return "ai";
  if (/^(analysis|shotSavedViews)/.test(dataset)) return "analysis";
  if (
    /^(billing|subscriptions|stripe|entitlements|usageEvents|planLimits|sponsors|partner|offer)/.test(
      dataset,
    )
  )
    return "billing";
  if (/^(challenge|courseRecord|scorecardProof|tournament|rivalry|leaderboard)/.test(dataset))
    return "competition";
  if (/^(friend|userBlocks|userFollows|feed|group)/.test(dataset)) return "social";
  if (/^(provider|import|rapsodo)/.test(dataset)) return "import";
  if (/^(users|userProfiles|userIdentity|account|userFeature|offline)/.test(dataset))
    return "account";
  if (
    /^(strokesGainedBaselines|challengeTemplates|courseProviderAliases|courseRecordCategories|teeSets|holes|courseFeatures)/.test(
      dataset,
    )
  )
    return "reference";
  if (
    /^(clubs|courses|weather|sessions|shots|stock|ball|clubEquipment|equipment|strokes|speed|golfTraining|practice|weekly|achievement|xp)/.test(
      dataset,
    )
  )
    return "golf";
  return "system";
}
