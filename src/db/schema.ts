import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("fkh_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 320 }),
  name: varchar("name", { length: 160 }),
  preferredUnits: varchar("preferred_units", { length: 16 }).notNull().default("yards"),
  theme: varchar("theme", { length: 16 }).notNull().default("system"),
  tableDensity: varchar("table_density", { length: 16 }).notNull().default("comfortable"),
  dashboardPins: jsonb("dashboard_pins").$type<string[]>().notNull().default([]),
  privacySettingsJson: jsonb("privacy_settings_json")
    .$type<{
      allowCoachAccess?: boolean;
      allowLeaderboard?: boolean;
      publicProfile?: boolean;
    }>()
    .notNull()
    .default({}),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminUsers = pgTable(
  "fkh_admin_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 24 }).notNull().default("operator"),
    status: varchar("status", { length: 24 }).notNull().default("active"),
    permissionsJson: jsonb("permissions_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_admin_users_user_idx").on(table.userId),
    index("fkh_admin_users_status_role_idx").on(table.status, table.role),
  ],
);

export const adminAuditLog = pgTable(
  "fkh_admin_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    targetUserId: uuid("target_user_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 80 }).notNull(),
    targetType: varchar("target_type", { length: 60 }),
    targetId: varchar("target_id", { length: 220 }),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("fkh_admin_audit_actor_created_idx").on(table.actorUserId, table.createdAt),
    index("fkh_admin_audit_target_idx").on(table.targetType, table.targetId),
  ],
);

export const userProfiles = pgTable(
  "fkh_user_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    username: varchar("username", { length: 40 }).notNull(),
    displayName: varchar("display_name", { length: 160 }).notNull(),
    avatarUrl: text("avatar_url"),
    headerImageUrl: text("header_image_url"),
    bio: text("bio"),
    homeCourse: varchar("home_course", { length: 180 }),
    primaryLaunchMonitor: varchar("primary_launch_monitor", { length: 80 }),
    handicapBand: varchar("handicap_band", { length: 40 }),
    publicProfile: boolean("public_profile").notNull().default(false),
    friendProfile: boolean("friend_profile").notNull().default(false),
    feedVisibilityDefault: varchar("feed_visibility_default", { length: 24 })
      .notNull()
      .default("private"),
    leaderboardVisibility: varchar("leaderboard_visibility", { length: 24 })
      .notNull()
      .default("private"),
    visibilitySettingsJson: jsonb("visibility_settings_json")
      .$type<{
        rounds?: "private" | "friends" | "public";
        pbs?: "private" | "friends" | "public";
        bag?: "private" | "friends" | "public";
        achievements?: "private" | "friends" | "public";
        handicap?: "private" | "friends" | "public";
        practice?: "private" | "friends" | "public";
        exactShots?: "private" | "friends" | "public";
        hiddenFeedTypes?: string[];
        profileKind?: "player" | "tour-player";
        tourPlayer?: boolean;
        managedProfile?: boolean;
        allowFriendRequests?: boolean;
        allowCompare?: boolean;
        cbsId?: string | null;
      }>()
      .notNull()
      .default({}),
    achievementShowcaseJson: jsonb("achievement_showcase_json")
      .$type<string[]>()
      .notNull()
      .default([]),
    pbShowcaseJson: jsonb("pb_showcase_json")
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_user_profiles_username_idx").on(table.username),
    index("fkh_user_profiles_public_idx").on(table.publicProfile),
    index("fkh_user_profiles_leaderboard_idx").on(table.leaderboardVisibility),
  ],
);

export const friendRequests = pgTable(
  "fkh_friend_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requesterUserId: uuid("requester_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipientUserId: uuid("recipient_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 24 }).notNull().default("pending"),
    message: text("message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_friend_requests_requester_recipient_idx").on(
      table.requesterUserId,
      table.recipientUserId,
    ),
    index("fkh_friend_requests_recipient_status_idx").on(table.recipientUserId, table.status),
    index("fkh_friend_requests_requester_status_idx").on(table.requesterUserId, table.status),
  ],
);

export const friendships = pgTable(
  "fkh_friendships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userAId: uuid("user_a_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userBId: uuid("user_b_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    visibilityLevel: varchar("visibility_level", { length: 24 }).notNull().default("friends"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_friendships_pair_idx").on(table.userAId, table.userBId),
    index("fkh_friendships_user_a_idx").on(table.userAId),
    index("fkh_friendships_user_b_idx").on(table.userBId),
  ],
);

export const userBlocks = pgTable(
  "fkh_user_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blockerUserId: uuid("blocker_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedUserId: uuid("blocked_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: varchar("reason", { length: 160 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_user_blocks_blocker_blocked_idx").on(table.blockerUserId, table.blockedUserId),
    index("fkh_user_blocks_blocked_idx").on(table.blockedUserId),
  ],
);

export const userFollows = pgTable(
  "fkh_user_follows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    followerUserId: uuid("follower_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followedUserId: uuid("followed_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_user_follows_follower_followed_idx").on(
      table.followerUserId,
      table.followedUserId,
    ),
    index("fkh_user_follows_followed_idx").on(table.followedUserId),
  ],
);

export const feedItems = pgTable(
  "fkh_feed_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemType: varchar("item_type", { length: 60 }).notNull(),
    headline: varchar("headline", { length: 220 }).notNull(),
    metricLabel: varchar("metric_label", { length: 80 }),
    metricValue: varchar("metric_value", { length: 120 }),
    context: text("context"),
    proofUrl: text("proof_url"),
    sourceType: varchar("source_type", { length: 60 }),
    sourceId: varchar("source_id", { length: 220 }),
    visibility: varchar("visibility", { length: 24 }).notNull().default("private"),
    verificationLabel: varchar("verification_label", { length: 80 })
      .notNull()
      .default("Unverified"),
    dedupeKey: varchar("dedupe_key", { length: 260 }),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_feed_items_user_dedupe_idx").on(table.userId, table.dedupeKey),
    index("fkh_feed_items_user_created_idx").on(table.userId, table.createdAt),
    index("fkh_feed_items_visibility_created_idx").on(table.visibility, table.createdAt),
    index("fkh_feed_items_source_idx").on(table.sourceType, table.sourceId),
  ],
);

export const feedReactions = pgTable(
  "fkh_feed_reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    feedItemId: uuid("feed_item_id")
      .notNull()
      .references(() => feedItems.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reactionType: varchar("reaction_type", { length: 40 }).notNull().default("kudos"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_feed_reactions_item_user_type_idx").on(
      table.feedItemId,
      table.userId,
      table.reactionType,
    ),
    index("fkh_feed_reactions_user_idx").on(table.userId),
  ],
);

export const feedComments = pgTable(
  "fkh_feed_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    feedItemId: uuid("feed_item_id")
      .notNull()
      .references(() => feedItems.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("fkh_feed_comments_item_created_idx").on(table.feedItemId, table.createdAt),
    index("fkh_feed_comments_user_idx").on(table.userId),
  ],
);

export const feedCommentReactions = pgTable(
  "fkh_feed_comment_reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    feedCommentId: uuid("feed_comment_id")
      .notNull()
      .references(() => feedComments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reactionType: varchar("reaction_type", { length: 40 }).notNull().default("like"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_feed_comment_reactions_comment_user_type_idx").on(
      table.feedCommentId,
      table.userId,
      table.reactionType,
    ),
    index("fkh_feed_comment_reactions_comment_idx").on(table.feedCommentId),
    index("fkh_feed_comment_reactions_user_idx").on(table.userId),
  ],
);

export const challengeTemplates = pgTable(
  "fkh_challenge_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 80 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description").notNull(),
    challengeType: varchar("challenge_type", { length: 60 }).notNull(),
    rulesJson: jsonb("rules_json").$type<Record<string, unknown>>().notNull().default({}),
    scoringDirection: varchar("scoring_direction", { length: 12 }).notNull().default("desc"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_challenge_templates_slug_idx").on(table.slug),
    index("fkh_challenge_templates_active_idx").on(table.active),
  ],
);

export const challenges = pgTable(
  "fkh_challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: uuid("template_id").references(() => challengeTemplates.id, {
      onDelete: "set null",
    }),
    creatorUserId: uuid("creator_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 180 }).notNull(),
    description: text("description"),
    visibility: varchar("visibility", { length: 24 }).notNull().default("friends"),
    status: varchar("status", { length: 24 }).notNull().default("open"),
    challengeRulesJson: jsonb("challenge_rules_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("fkh_challenges_creator_idx").on(table.creatorUserId),
    index("fkh_challenges_visibility_status_idx").on(table.visibility, table.status),
    index("fkh_challenges_template_idx").on(table.templateId),
  ],
);

export const challengeEntries = pgTable(
  "fkh_challenge_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 24 }).notNull().default("joined"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_challenge_entries_challenge_user_idx").on(table.challengeId, table.userId),
    index("fkh_challenge_entries_user_idx").on(table.userId),
  ],
);

export const challengeAttempts = pgTable(
  "fkh_challenge_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    entryId: uuid("entry_id").references(() => challengeEntries.id, { onDelete: "set null" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceType: varchar("source_type", { length: 60 }).notNull().default("manual"),
    sourceId: varchar("source_id", { length: 220 }),
    metricValue: doublePrecision("metric_value").notNull(),
    metricLabel: varchar("metric_label", { length: 80 }).notNull(),
    verificationLabel: varchar("verification_label", { length: 80 }).notNull().default("Manual"),
    notes: text("notes"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("fkh_challenge_attempts_challenge_user_idx").on(table.challengeId, table.userId),
    index("fkh_challenge_attempts_entry_idx").on(table.entryId),
  ],
);

export const challengeResults = pgTable(
  "fkh_challenge_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bestAttemptId: uuid("best_attempt_id").references(() => challengeAttempts.id, {
      onDelete: "set null",
    }),
    rank: integer("rank"),
    score: doublePrecision("score").notNull(),
    scoreLabel: varchar("score_label", { length: 120 }).notNull(),
    status: varchar("status", { length: 24 }).notNull().default("active"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_challenge_results_challenge_user_idx").on(table.challengeId, table.userId),
    index("fkh_challenge_results_challenge_rank_idx").on(table.challengeId, table.rank),
    index("fkh_challenge_results_user_idx").on(table.userId),
  ],
);

export const challengeComments = pgTable(
  "fkh_challenge_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("fkh_challenge_comments_challenge_created_idx").on(table.challengeId, table.createdAt),
    index("fkh_challenge_comments_user_idx").on(table.userId),
  ],
);

export const challengeInvites = pgTable(
  "fkh_challenge_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    inviterUserId: uuid("inviter_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    inviteeUserId: uuid("invitee_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 24 }).notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("fkh_challenge_invites_challenge_invitee_idx").on(
      table.challengeId,
      table.inviteeUserId,
    ),
    index("fkh_challenge_invites_invitee_status_idx").on(table.inviteeUserId, table.status),
  ],
);

export const groups = pgTable(
  "fkh_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 80 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    groupType: varchar("group_type", { length: 40 }).notNull().default("friends"),
    visibility: varchar("visibility", { length: 24 }).notNull().default("private"),
    avatarUrl: text("avatar_url"),
    inviteCode: varchar("invite_code", { length: 80 }),
    rules: text("rules"),
    settingsJson: jsonb("settings_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_groups_slug_idx").on(table.slug),
    uniqueIndex("fkh_groups_invite_code_idx").on(table.inviteCode),
    index("fkh_groups_owner_idx").on(table.ownerUserId),
    index("fkh_groups_visibility_type_idx").on(table.visibility, table.groupType),
  ],
);

export const groupMemberships = pgTable(
  "fkh_group_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 24 }).notNull().default("member"),
    status: varchar("status", { length: 24 }).notNull().default("active"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_group_memberships_group_user_idx").on(table.groupId, table.userId),
    index("fkh_group_memberships_user_idx").on(table.userId),
    index("fkh_group_memberships_group_role_idx").on(table.groupId, table.role),
  ],
);

export const groupInvites = pgTable(
  "fkh_group_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    inviterUserId: uuid("inviter_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    inviteeUserId: uuid("invitee_user_id").references(() => users.id, { onDelete: "cascade" }),
    inviteeEmail: varchar("invitee_email", { length: 320 }),
    tokenHash: varchar("token_hash", { length: 128 }),
    status: varchar("status", { length: 24 }).notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (table) => [
    index("fkh_group_invites_group_idx").on(table.groupId),
    index("fkh_group_invites_invitee_status_idx").on(table.inviteeUserId, table.status),
    index("fkh_group_invites_email_idx").on(table.inviteeEmail),
  ],
);

export const groupPosts = pgTable(
  "fkh_group_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 180 }),
    body: text("body").notNull(),
    pinned: boolean("pinned").notNull().default(false),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("fkh_group_posts_group_created_idx").on(table.groupId, table.createdAt),
    index("fkh_group_posts_user_idx").on(table.userId),
  ],
);

export const groupChallengeLinks = pgTable(
  "fkh_group_challenge_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_group_challenge_links_group_challenge_idx").on(
      table.groupId,
      table.challengeId,
    ),
    index("fkh_group_challenge_links_challenge_idx").on(table.challengeId),
  ],
);

export const billingCustomers = pgTable(
  "fkh_billing_customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stripeCustomerId: varchar("stripe_customer_id", { length: 120 }),
    email: varchar("email", { length: 320 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_billing_customers_user_idx").on(table.userId),
    uniqueIndex("fkh_billing_customers_stripe_idx").on(table.stripeCustomerId),
  ],
);

export const subscriptions = pgTable(
  "fkh_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    billingCustomerId: uuid("billing_customer_id").references(() => billingCustomers.id, {
      onDelete: "set null",
    }),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 120 }),
    planKey: varchar("plan_key", { length: 40 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("inactive"),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("fkh_subscriptions_user_status_idx").on(table.userId, table.status),
    uniqueIndex("fkh_subscriptions_stripe_idx").on(table.stripeSubscriptionId),
  ],
);

export const entitlements = pgTable(
  "fkh_entitlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    entitlementKey: varchar("entitlement_key", { length: 80 }).notNull(),
    valueJson: jsonb("value_json").$type<Record<string, unknown>>().notNull().default({}),
    source: varchar("source", { length: 40 }).notNull().default("plan"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_entitlements_user_key_idx").on(table.userId, table.entitlementKey),
    index("fkh_entitlements_user_source_idx").on(table.userId, table.source),
  ],
);

export const usageEvents = pgTable(
  "fkh_usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 80 }).notNull(),
    quantity: integer("quantity").notNull().default(1),
    sourceId: varchar("source_id", { length: 220 }),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("fkh_usage_events_user_type_created_idx").on(
      table.userId,
      table.eventType,
      table.createdAt,
    ),
  ],
);

export const planLimits = pgTable(
  "fkh_plan_limits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planKey: varchar("plan_key", { length: 40 }).notNull(),
    limitKey: varchar("limit_key", { length: 80 }).notNull(),
    limitValueJson: jsonb("limit_value_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("fkh_plan_limits_plan_key_idx").on(table.planKey, table.limitKey)],
);

export const sponsors = pgTable(
  "fkh_sponsors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 80 }).notNull(),
    websiteUrl: text("website_url"),
    contactEmail: varchar("contact_email", { length: 320 }),
    status: varchar("status", { length: 32 }).notNull().default("prospect"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_sponsors_slug_idx").on(table.slug),
    index("fkh_sponsors_owner_idx").on(table.ownerUserId),
  ],
);

export const challengeRewards = pgTable(
  "fkh_challenge_rewards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    sponsorId: uuid("sponsor_id").references(() => sponsors.id, { onDelete: "set null" }),
    rewardType: varchar("reward_type", { length: 40 }).notNull().default("discount"),
    title: varchar("title", { length: 160 }).notNull(),
    description: text("description"),
    rewardUrl: text("reward_url"),
    couponCode: varchar("coupon_code", { length: 80 }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("fkh_challenge_rewards_challenge_idx").on(table.challengeId),
    index("fkh_challenge_rewards_sponsor_idx").on(table.sponsorId),
  ],
);

export const partnerOffers = pgTable(
  "fkh_partner_offers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sponsorId: uuid("sponsor_id").references(() => sponsors.id, { onDelete: "set null" }),
    title: varchar("title", { length: 160 }).notNull(),
    description: text("description"),
    offerType: varchar("offer_type", { length: 40 }).notNull().default("affiliate"),
    placement: varchar("placement", { length: 80 }).notNull().default("contextual"),
    targetContext: varchar("target_context", { length: 80 }),
    offerUrl: text("offer_url"),
    couponCode: varchar("coupon_code", { length: 80 }),
    active: boolean("active").notNull().default(true),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("fkh_partner_offers_active_context_idx").on(table.active, table.targetContext),
    index("fkh_partner_offers_sponsor_idx").on(table.sponsorId),
  ],
);

export const offerClicks = pgTable(
  "fkh_offer_clicks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    offerId: uuid("offer_id")
      .notNull()
      .references(() => partnerOffers.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    source: varchar("source", { length: 80 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("fkh_offer_clicks_offer_created_idx").on(table.offerId, table.createdAt),
    index("fkh_offer_clicks_user_idx").on(table.userId),
  ],
);

export const providerAccounts = pgTable(
  "fkh_provider_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerKind: varchar("provider_kind", { length: 40 }).notNull(),
    providerAccountId: varchar("provider_account_id", { length: 180 }),
    displayName: varchar("display_name", { length: 160 }),
    status: varchar("status", { length: 32 }).notNull().default("active"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_provider_accounts_user_provider_account_idx").on(
      table.userId,
      table.providerKind,
      table.providerAccountId,
    ),
    index("fkh_provider_accounts_user_provider_idx").on(table.userId, table.providerKind),
  ],
);

export const providerSessions = pgTable(
  "fkh_provider_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerAccountId: uuid("provider_account_id").references(() => providerAccounts.id, {
      onDelete: "set null",
    }),
    providerKind: varchar("provider_kind", { length: 40 }).notNull(),
    providerSessionId: varchar("provider_session_id", { length: 180 }).notNull(),
    title: varchar("title", { length: 260 }),
    sessionDate: timestamp("session_date", { withTimezone: true }),
    importedSessionId: uuid("imported_session_id").references(() => sessions.id, {
      onDelete: "set null",
    }),
    rawMetadataJson: jsonb("raw_metadata_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    importedAt: timestamp("imported_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_provider_sessions_user_provider_session_idx").on(
      table.userId,
      table.providerKind,
      table.providerSessionId,
    ),
    index("fkh_provider_sessions_user_seen_idx").on(table.userId, table.lastSeenAt),
    index("fkh_provider_sessions_imported_idx").on(table.importedSessionId),
  ],
);

export const importJobs = pgTable(
  "fkh_import_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerKind: varchar("provider_kind", { length: 40 }).notNull(),
    sourceFileId: uuid("source_file_id").references(() => importSourceFiles.id, {
      onDelete: "set null",
    }),
    status: varchar("status", { length: 32 }).notNull().default("queued"),
    detectedProviderKind: varchar("detected_provider_kind", { length: 40 }),
    importedSessionId: uuid("imported_session_id").references(() => sessions.id, {
      onDelete: "set null",
    }),
    errorMessage: text("error_message"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("fkh_import_jobs_user_status_idx").on(table.userId, table.status),
    index("fkh_import_jobs_provider_idx").on(table.providerKind),
  ],
);

export const importSourceFiles = pgTable(
  "fkh_import_source_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerKind: varchar("provider_kind", { length: 40 }).notNull(),
    fileName: varchar("file_name", { length: 260 }).notNull(),
    fileSizeBytes: integer("file_size_bytes"),
    rawHash: varchar("raw_hash", { length: 64 }).notNull(),
    storagePath: text("storage_path"),
    status: varchar("status", { length: 32 }).notNull().default("saved"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_import_source_files_user_hash_idx").on(table.userId, table.rawHash),
    index("fkh_import_source_files_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const importMappings = pgTable(
  "fkh_import_mappings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerKind: varchar("provider_kind", { length: 40 }).notNull(),
    mappingName: varchar("mapping_name", { length: 160 }).notNull(),
    mappingJson: jsonb("mapping_json").$type<Record<string, unknown>>().notNull().default({}),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_import_mappings_user_provider_name_idx").on(
      table.userId,
      table.providerKind,
      table.mappingName,
    ),
    index("fkh_import_mappings_user_provider_idx").on(table.userId, table.providerKind),
  ],
);

export const aiSocialSummaries = pgTable(
  "fkh_ai_social_summaries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    summaryType: varchar("summary_type", { length: 60 }).notNull(),
    subjectType: varchar("subject_type", { length: 60 }),
    subjectId: varchar("subject_id", { length: 220 }),
    headline: varchar("headline", { length: 220 }).notNull(),
    body: text("body").notNull(),
    evidenceJson: jsonb("evidence_json").$type<Record<string, unknown>>().notNull().default({}),
    visibility: varchar("visibility", { length: 24 }).notNull().default("private"),
    model: varchar("model", { length: 80 }).notNull().default("rules-v1"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("fkh_ai_social_summaries_user_type_idx").on(table.userId, table.summaryType),
    index("fkh_ai_social_summaries_subject_idx").on(table.subjectType, table.subjectId),
  ],
);

export const socialReports = pgTable(
  "fkh_social_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterUserId: uuid("reporter_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reportedUserId: uuid("reported_user_id").references(() => users.id, { onDelete: "set null" }),
    targetType: varchar("target_type", { length: 60 }).notNull(),
    targetId: varchar("target_id", { length: 220 }).notNull(),
    reason: varchar("reason", { length: 120 }).notNull(),
    details: text("details"),
    status: varchar("status", { length: 32 }).notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    index("fkh_social_reports_reporter_idx").on(table.reporterUserId),
    index("fkh_social_reports_target_idx").on(table.targetType, table.targetId),
    index("fkh_social_reports_status_idx").on(table.status),
  ],
);

export const moderationEvents = pgTable(
  "fkh_moderation_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    targetType: varchar("target_type", { length: 60 }).notNull(),
    targetId: varchar("target_id", { length: 220 }).notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    eventType: varchar("event_type", { length: 60 }).notNull(),
    severity: varchar("severity", { length: 24 }).notNull().default("low"),
    status: varchar("status", { length: 32 }).notNull().default("open"),
    reason: text("reason"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    index("fkh_moderation_events_target_idx").on(table.targetType, table.targetId),
    index("fkh_moderation_events_status_severity_idx").on(table.status, table.severity),
    index("fkh_moderation_events_actor_idx").on(table.actorUserId),
  ],
);

export const accountMemberships = pgTable(
  "fkh_account_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    memberUserId: uuid("member_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 24 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_account_memberships_owner_member_idx").on(
      table.ownerUserId,
      table.memberUserId,
    ),
    index("fkh_account_memberships_member_idx").on(table.memberUserId),
    index("fkh_account_memberships_owner_role_idx").on(table.ownerUserId, table.role),
  ],
);

export const accountInvitations = pgTable(
  "fkh_account_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    invitedEmail: varchar("invited_email", { length: 320 }).notNull(),
    role: varchar("role", { length: 24 }).notNull(),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    status: varchar("status", { length: 24 }).notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedByUserId: uuid("accepted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_account_invitations_token_hash_idx").on(table.tokenHash),
    index("fkh_account_invitations_owner_idx").on(table.ownerUserId),
    index("fkh_account_invitations_email_idx").on(table.invitedEmail),
  ],
);

export const shareLinks = pgTable(
  "fkh_share_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    resourceType: varchar("resource_type", { length: 40 }).notNull(),
    resourceId: uuid("resource_id").notNull(),
    title: varchar("title", { length: 220 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_share_links_token_hash_idx").on(table.tokenHash),
    index("fkh_share_links_user_resource_idx").on(
      table.userId,
      table.resourceType,
      table.resourceId,
    ),
  ],
);

export const clubs = pgTable(
  "fkh_clubs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 40 }).notNull(),
    brand: varchar("brand", { length: 120 }),
    model: varchar("model", { length: 160 }),
    normalizedClubKey: varchar("normalized_club_key", { length: 260 }).notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_clubs_user_normalized_key_idx").on(table.userId, table.normalizedClubKey),
    index("fkh_clubs_user_type_idx").on(table.userId, table.type),
  ],
);

export const courses = pgTable(
  "fkh_courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 180 }).notNull(),
    country: varchar("country", { length: 80 }),
    address: varchar("address", { length: 260 }),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    provider: varchar("provider", { length: 80 }).notNull().default("manual"),
    externalId: varchar("external_id", { length: 180 }),
    googlePlaceId: varchar("google_place_id", { length: 180 }),
    canonicalCourseId: uuid("canonical_course_id"),
    websiteUrl: text("website_url"),
    googleMapsUrl: text("google_maps_url"),
    googleRating: doublePrecision("google_rating"),
    googleUserRatingsTotal: integer("google_user_ratings_total"),
    googleTypesJson: jsonb("google_types_json").$type<string[]>().notNull().default([]),
    googleOpeningHoursJson: jsonb("google_opening_hours_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    googleAttributionsJson: jsonb("google_attributions_json")
      .$type<string[]>()
      .notNull()
      .default([]),
    googleMetadataJson: jsonb("google_metadata_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    googleEnrichedAt: timestamp("google_enriched_at", { withTimezone: true }),
    visibility: varchar("visibility", { length: 24 }).notNull().default("shared"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_courses_provider_external_idx").on(table.provider, table.externalId),
    uniqueIndex("fkh_courses_google_place_idx").on(table.googlePlaceId),
    index("fkh_courses_name_idx").on(table.name),
    index("fkh_courses_created_by_idx").on(table.createdByUserId),
    index("fkh_courses_canonical_idx").on(table.canonicalCourseId),
  ],
);

export const teeSets = pgTable(
  "fkh_tee_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    par: integer("par").notNull(),
    courseRating: doublePrecision("course_rating"),
    slopeRating: integer("slope_rating"),
    yards: integer("yards"),
    meters: integer("meters"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_tee_sets_course_name_idx").on(table.courseId, table.name),
    index("fkh_tee_sets_course_idx").on(table.courseId),
  ],
);

export const holes = pgTable(
  "fkh_holes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    teeSetId: uuid("tee_set_id")
      .notNull()
      .references(() => teeSets.id, { onDelete: "cascade" }),
    holeNumber: integer("hole_number").notNull(),
    par: integer("par").notNull(),
    strokeIndex: integer("stroke_index"),
    yards: integer("yards").notNull(),
    teeLat: doublePrecision("tee_lat").notNull(),
    teeLng: doublePrecision("tee_lng").notNull(),
    greenLat: doublePrecision("green_lat").notNull(),
    greenLng: doublePrecision("green_lng").notNull(),
    centerlineGeojson: jsonb("centerline_geojson")
      .$type<{ type: "LineString"; coordinates: Array<[number, number]> }>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_holes_tee_set_hole_idx").on(table.teeSetId, table.holeNumber),
    index("fkh_holes_course_idx").on(table.courseId),
  ],
);

export const sessions = pgTable(
  "fkh_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    source: varchar("source", { length: 40 }).notNull(),
    type: varchar("type", { length: 40 }).notNull(),
    date: timestamp("date", { withTimezone: true }).notNull(),
    courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
    teeSetId: uuid("tee_set_id").references(() => teeSets.id, { onDelete: "set null" }),
    location: varchar("location", { length: 180 }),
    courseName: varchar("course_name", { length: 180 }),
    roundStatus: varchar("round_status", { length: 24 }).notNull().default("complete"),
    weatherJson: jsonb("weather_json")
      .$type<{
        conditions?: string | null;
        wind?: string | null;
        temperature?: string | null;
      }>()
      .notNull()
      .default({}),
    equipmentNotes: text("equipment_notes"),
    scorecardJson: jsonb("scorecard_json").$type<
      Array<{
        holeNumber: number;
        par: number;
        yards: number;
        name: string | null;
        csvShotCount?: number;
        progressYd?: number;
        distanceRemainingYd?: number;
        putts?: number | null;
        penalties?: number | null;
        score?: number | null;
        netScore?: number | null;
        fairwayHit?: boolean | null;
        gir?: boolean | null;
        strokeIndex?: number | null;
        chipShots?: number | null;
        greensideSandShots?: number | null;
      }>
    >(),
    notes: text("notes"),
    rawUploadId: varchar("raw_upload_id", { length: 160 }),
    fileName: varchar("file_name", { length: 260 }),
    fileSizeBytes: integer("file_size_bytes"),
    rawCsvHash: varchar("raw_csv_hash", { length: 64 }),
    rawCsvText: text("raw_csv_text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("fkh_sessions_user_date_idx").on(table.userId, table.date),
    index("fkh_sessions_user_source_idx").on(table.userId, table.source),
    index("fkh_sessions_user_type_date_idx").on(table.userId, table.type, table.date),
    index("fkh_sessions_type_date_idx").on(table.type, table.date),
    uniqueIndex("fkh_sessions_user_source_raw_hash_idx").on(
      table.userId,
      table.source,
      table.rawCsvHash,
    ),
  ],
);

export const importRows = pgTable(
  "fkh_import_rows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    rowNumber: integer("row_number").notNull(),
    rowType: varchar("row_type", { length: 40 }).notNull(),
    sourceRawJson: jsonb("source_raw_json").$type<Record<string, string>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("fkh_import_rows_user_session_idx").on(table.userId, table.sessionId),
    index("fkh_import_rows_row_type_idx").on(table.rowType),
  ],
);

export const importFiles = pgTable(
  "fkh_import_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    source: varchar("source", { length: 40 }).notNull(),
    fileName: varchar("file_name", { length: 260 }).notNull(),
    fileSizeBytes: integer("file_size_bytes"),
    rawCsvHash: varchar("raw_csv_hash", { length: 64 }).notNull(),
    parseVersion: varchar("parse_version", { length: 80 }).notNull().default("rapsodo-v1"),
    status: varchar("status", { length: 32 }).notNull().default("saved"),
    duplicateOfFileId: uuid("duplicate_of_file_id"),
    reprocessedFromFileId: uuid("reprocessed_from_file_id"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_import_files_user_hash_idx").on(table.userId, table.rawCsvHash),
    index("fkh_import_files_user_created_idx").on(table.userId, table.createdAt),
    index("fkh_import_files_session_idx").on(table.sessionId),
    index("fkh_import_files_duplicate_idx").on(table.duplicateOfFileId),
  ],
);

export const shots = pgTable(
  "fkh_shots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    clubId: uuid("club_id")
      .notNull()
      .references(() => clubs.id, { onDelete: "restrict" }),
    shotAt: timestamp("shot_at", { withTimezone: true }).notNull(),
    clubType: varchar("club_type", { length: 40 }).notNull(),
    shotNumber: integer("shot_number"),
    carryYd: doublePrecision("carry_yd"),
    totalYd: doublePrecision("total_yd"),
    ballSpeedMph: doublePrecision("ball_speed_mph"),
    clubSpeedMph: doublePrecision("club_speed_mph"),
    launchAngleDeg: doublePrecision("launch_angle_deg"),
    launchDirectionDeg: doublePrecision("launch_direction_deg"),
    apexFt: doublePrecision("apex_ft"),
    sideCarryYd: doublePrecision("side_carry_yd"),
    attackAngleDeg: doublePrecision("attack_angle_deg"),
    clubPathDeg: doublePrecision("club_path_deg"),
    descentAngleDeg: doublePrecision("descent_angle_deg"),
    smashFactor: doublePrecision("smash_factor"),
    spinRate: doublePrecision("spin_rate"),
    spinAxis: doublePrecision("spin_axis"),
    shotShape: varchar("shot_shape", { length: 40 }),
    shotCategory: varchar("shot_category", { length: 40 }).notNull().default("full"),
    courseHoleNumber: integer("course_hole_number"),
    courseHoleShotNumber: integer("course_hole_shot_number"),
    courseHolePar: integer("course_hole_par"),
    courseHoleYards: integer("course_hole_yards"),
    distanceRemainingYd: doublePrecision("distance_remaining_yd"),
    qualityTag: varchar("quality_tag", { length: 40 }),
    clubDataEstType: varchar("club_data_est_type", { length: 80 }),
    sourceRawJson: jsonb("source_raw_json").$type<Record<string, string>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("fkh_shots_user_session_idx").on(table.userId, table.sessionId),
    index("fkh_shots_user_club_idx").on(table.userId, table.clubId),
    index("fkh_shots_user_shot_at_idx").on(table.userId, table.shotAt),
    index("fkh_shots_user_category_idx").on(table.userId, table.shotCategory),
    index("fkh_shots_user_session_hole_idx").on(
      table.userId,
      table.sessionId,
      table.courseHoleNumber,
    ),
    index("fkh_shots_session_idx").on(table.sessionId),
    index("fkh_shots_club_type_idx").on(table.clubType),
    index("fkh_shots_shot_at_idx").on(table.shotAt),
  ],
);

export const stockYardages = pgTable(
  "fkh_stock_yardages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clubId: uuid("club_id")
      .notNull()
      .references(() => clubs.id, { onDelete: "cascade" }),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
    sampleSize: integer("sample_size").notNull(),
    carryMedianYd: doublePrecision("carry_median_yd"),
    carryMeanYd: doublePrecision("carry_mean_yd"),
    carryP75Yd: doublePrecision("carry_p75_yd"),
    carryP25Yd: doublePrecision("carry_p25_yd"),
    totalMedianYd: doublePrecision("total_median_yd"),
    dispersionLeftYd: doublePrecision("dispersion_left_yd"),
    dispersionRightYd: doublePrecision("dispersion_right_yd"),
    confidenceScore: doublePrecision("confidence_score"),
    recommendedPlayNumberYd: doublePrecision("recommended_play_number_yd"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("fkh_stock_yardages_user_club_idx").on(table.userId, table.clubId),
    index("fkh_stock_yardages_calculated_at_idx").on(table.calculatedAt),
  ],
);

export const ballModels = pgTable(
  "fkh_ball_models",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    brand: varchar("brand", { length: 120 }),
    model: varchar("model", { length: 160 }).notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_ball_models_user_model_idx").on(table.userId, table.brand, table.model),
    index("fkh_ball_models_user_active_idx").on(table.userId, table.active),
  ],
);

export const clubEquipmentHistory = pgTable(
  "fkh_club_equipment_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clubId: uuid("club_id")
      .notNull()
      .references(() => clubs.id, { onDelete: "cascade" }),
    ballModelId: uuid("ball_model_id").references(() => ballModels.id, { onDelete: "set null" }),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull().defaultNow(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    loftDeg: doublePrecision("loft_deg"),
    lieDeg: doublePrecision("lie_deg"),
    shaft: varchar("shaft", { length: 180 }),
    swingWeight: varchar("swing_weight", { length: 40 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("fkh_club_equipment_user_club_idx").on(table.userId, table.clubId),
    index("fkh_club_equipment_effective_idx").on(table.clubId, table.effectiveFrom),
  ],
);

export const strokesGainedBaselines = pgTable(
  "fkh_strokes_gained_baselines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    category: varchar("category", { length: 40 }).notNull(),
    lie: varchar("lie", { length: 40 }).notNull(),
    distanceStartYd: integer("distance_start_yd").notNull(),
    distanceEndYd: integer("distance_end_yd").notNull(),
    expectedStrokes: doublePrecision("expected_strokes").notNull(),
    source: varchar("source", { length: 80 }).notNull().default("default"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_sg_baselines_bucket_idx").on(
      table.category,
      table.lie,
      table.distanceStartYd,
      table.distanceEndYd,
      table.source,
    ),
  ],
);

export const strokesGainedShotEvents = pgTable(
  "fkh_strokes_gained_shot_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    shotId: uuid("shot_id").references(() => shots.id, { onDelete: "set null" }),
    holeNumber: integer("hole_number"),
    strokeNumber: integer("stroke_number"),
    category: varchar("category", { length: 40 }).notNull(),
    startLie: varchar("start_lie", { length: 40 }).notNull(),
    endLie: varchar("end_lie", { length: 40 }),
    startDistanceYd: doublePrecision("start_distance_yd"),
    endDistanceYd: doublePrecision("end_distance_yd"),
    penaltyStrokes: doublePrecision("penalty_strokes").notNull().default(0),
    strokesGained: doublePrecision("strokes_gained"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("fkh_sg_events_user_session_idx").on(table.userId, table.sessionId),
    index("fkh_sg_events_user_category_idx").on(table.userId, table.category),
    index("fkh_sg_events_shot_idx").on(table.shotId),
  ],
);

export const userAchievements = pgTable(
  "fkh_user_achievements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    achievementId: varchar("achievement_id", { length: 140 }).notNull(),
    firstUnlockedAt: timestamp("first_unlocked_at", { withTimezone: true }).notNull().defaultNow(),
    lastUnlockedAt: timestamp("last_unlocked_at", { withTimezone: true }).notNull().defaultNow(),
    unlockCount: integer("unlock_count").notNull().default(1),
    sourceSessionId: uuid("source_session_id").references(() => sessions.id, {
      onDelete: "set null",
    }),
    sourceShotId: uuid("source_shot_id").references(() => shots.id, { onDelete: "set null" }),
    xpAwarded: integer("xp_awarded").notNull().default(0),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_user_achievements_user_achievement_idx").on(table.userId, table.achievementId),
    index("fkh_user_achievements_user_unlocked_idx").on(table.userId, table.lastUnlockedAt),
  ],
);

export const xpLedger = pgTable(
  "fkh_xp_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    reason: varchar("reason", { length: 180 }).notNull(),
    achievementId: varchar("achievement_id", { length: 140 }),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    shotId: uuid("shot_id").references(() => shots.id, { onDelete: "set null" }),
    dedupeKey: varchar("dedupe_key", { length: 260 }).notNull(),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_xp_ledger_user_dedupe_idx").on(table.userId, table.dedupeKey),
    index("fkh_xp_ledger_user_created_idx").on(table.userId, table.createdAt),
    index("fkh_xp_ledger_user_achievement_idx").on(table.userId, table.achievementId),
  ],
);

export const achievementProgress = pgTable(
  "fkh_achievement_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    achievementId: varchar("achievement_id", { length: 140 }).notNull(),
    progressValue: doublePrecision("progress_value").notNull().default(0),
    targetValue: doublePrecision("target_value").notNull().default(1),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_achievement_progress_user_achievement_idx").on(
      table.userId,
      table.achievementId,
    ),
    index("fkh_achievement_progress_user_idx").on(table.userId),
  ],
);

export const achievementSyncState = pgTable(
  "fkh_achievement_sync_state",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    registryVersion: varchar("registry_version", { length: 80 }).notNull(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).notNull().defaultNow(),
    lastShotCount: integer("last_shot_count").notNull().default(0),
    lastSessionCount: integer("last_session_count").notNull().default(0),
    lastAchievementCount: integer("last_achievement_count").notNull().default(0),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>(),
  },
  (table) => [uniqueIndex("fkh_achievement_sync_state_user_idx").on(table.userId)],
);

export const rapsodoSyncSessions = pgTable(
  "fkh_rapsodo_sync_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerKind: varchar("provider_kind", { length: 40 }).notNull(),
    providerSessionId: varchar("provider_session_id", { length: 180 }).notNull(),
    providerSessionType: varchar("provider_session_type", { length: 80 }),
    providerSessionMode: varchar("provider_session_mode", { length: 80 }),
    sessionDate: timestamp("session_date", { withTimezone: true }),
    title: varchar("title", { length: 260 }),
    rawMetadataJson: jsonb("raw_metadata_json").$type<Record<string, unknown>>().notNull(),
    exportRawCsvHash: varchar("export_raw_csv_hash", { length: 64 }),
    importedSessionId: uuid("imported_session_id").references(() => sessions.id, {
      onDelete: "set null",
    }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastImportedAt: timestamp("last_imported_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_rapsodo_sync_user_provider_idx").on(
      table.userId,
      table.providerKind,
      table.providerSessionId,
    ),
    index("fkh_rapsodo_sync_user_seen_idx").on(table.userId, table.lastSeenAt),
    index("fkh_rapsodo_sync_imported_session_idx").on(table.importedSessionId),
  ],
);

export const courseProviderAliases = pgTable(
  "fkh_course_provider_aliases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    providerKind: varchar("provider_kind", { length: 40 }).notNull(),
    providerCourseId: varchar("provider_course_id", { length: 180 }),
    providerCourseName: varchar("provider_course_name", { length: 220 }).notNull(),
    providerTeeName: varchar("provider_tee_name", { length: 120 }),
    normalisedName: varchar("normalised_name", { length: 220 }).notNull(),
    confidenceScore: doublePrecision("confidence_score").notNull().default(0.6),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_course_provider_aliases_provider_idx").on(
      table.providerKind,
      table.providerCourseId,
      table.providerCourseName,
      table.providerTeeName,
    ),
    index("fkh_course_provider_aliases_course_idx").on(table.courseId),
    index("fkh_course_provider_aliases_normalised_idx").on(table.normalisedName),
  ],
);

export const courseRecordCategories = pgTable(
  "fkh_course_record_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 80 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    recordType: varchar("record_type", { length: 60 }).notNull(),
    metricKind: varchar("metric_kind", { length: 40 }).notNull().default("score"),
    scoringDirection: varchar("scoring_direction", { length: 12 }).notNull().default("asc"),
    scopeDefault: varchar("scope_default", { length: 24 }).notNull().default("public"),
    verificationRequired: varchar("verification_required", { length: 40 })
      .notNull()
      .default("silver"),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(100),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_course_record_categories_slug_idx").on(table.slug),
    index("fkh_course_record_categories_type_idx").on(table.recordType),
    index("fkh_course_record_categories_active_sort_idx").on(table.active, table.sortOrder),
  ],
);

export const courseRecords = pgTable(
  "fkh_course_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => courseRecordCategories.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    teeSetId: uuid("tee_set_id").references(() => teeSets.id, { onDelete: "set null" }),
    groupId: uuid("group_id").references(() => groups.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    recordType: varchar("record_type", { length: 60 }).notNull(),
    scope: varchar("scope", { length: 24 }).notNull().default("public"),
    period: varchar("period", { length: 24 }).notNull().default("all_time"),
    periodStart: timestamp("period_start", { withTimezone: true }),
    periodEnd: timestamp("period_end", { withTimezone: true }),
    verificationRequired: varchar("verification_required", { length: 40 })
      .notNull()
      .default("silver"),
    status: varchar("status", { length: 24 }).notNull().default("active"),
    bestResultId: uuid("best_result_id"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_course_records_unique_scope_idx").on(
      table.categoryId,
      table.courseId,
      table.teeSetId,
      table.scope,
      table.period,
      table.groupId,
    ),
    index("fkh_course_records_course_scope_idx").on(table.courseId, table.scope, table.period),
    index("fkh_course_records_best_idx").on(table.bestResultId),
    index("fkh_course_records_group_idx").on(table.groupId),
  ],
);

export const courseRecordAttempts = pgTable(
  "fkh_course_record_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recordId: uuid("record_id")
      .notNull()
      .references(() => courseRecords.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => courseRecordCategories.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    teeSetId: uuid("tee_set_id").references(() => teeSets.id, { onDelete: "set null" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    roundId: uuid("round_id").references(() => sessions.id, { onDelete: "set null" }),
    challengeId: uuid("challenge_id").references(() => challenges.id, { onDelete: "set null" }),
    score: integer("score"),
    netScore: integer("net_score"),
    stablefordPoints: integer("stableford_points"),
    metricValue: doublePrecision("metric_value").notNull(),
    metricLabel: varchar("metric_label", { length: 80 }).notNull(),
    verificationStatus: varchar("verification_status", { length: 40 })
      .notNull()
      .default("pending_evidence"),
    verificationTier: varchar("verification_tier", { length: 24 }).notNull().default("unverified"),
    sourceKind: varchar("source_kind", { length: 60 }).notNull().default("manual"),
    proofStatus: varchar("proof_status", { length: 40 }).notNull().default("pending_evidence"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("fkh_course_record_attempts_record_user_idx").on(table.recordId, table.userId),
    index("fkh_course_record_attempts_course_user_idx").on(table.courseId, table.userId),
    index("fkh_course_record_attempts_session_idx").on(table.sessionId),
    index("fkh_course_record_attempts_status_idx").on(table.verificationStatus),
  ],
);

export const courseRecordResults = pgTable(
  "fkh_course_record_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recordId: uuid("record_id")
      .notNull()
      .references(() => courseRecords.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bestAttemptId: uuid("best_attempt_id").references(() => courseRecordAttempts.id, {
      onDelete: "set null",
    }),
    rank: integer("rank"),
    metricValue: doublePrecision("metric_value").notNull(),
    scoreLabel: varchar("score_label", { length: 120 }).notNull(),
    verificationStatus: varchar("verification_status", { length: 40 })
      .notNull()
      .default("pending_evidence"),
    verificationTier: varchar("verification_tier", { length: 24 }).notNull().default("unverified"),
    status: varchar("status", { length: 24 }).notNull().default("active"),
    tieBreakerJson: jsonb("tie_breaker_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_course_record_results_record_user_idx").on(table.recordId, table.userId),
    index("fkh_course_record_results_record_rank_idx").on(table.recordId, table.rank),
    index("fkh_course_record_results_user_idx").on(table.userId),
  ],
);

export const courseRecordEvidence = pgTable(
  "fkh_course_record_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => courseRecordAttempts.id, { onDelete: "cascade" }),
    evidenceType: varchar("evidence_type", { length: 60 }).notNull(),
    storagePath: text("storage_path"),
    importSourceFileId: uuid("import_source_file_id").references(() => importSourceFiles.id, {
      onDelete: "set null",
    }),
    rapsodoSyncSessionId: uuid("rapsodo_sync_session_id").references(() => rapsodoSyncSessions.id, {
      onDelete: "set null",
    }),
    csvHash: varchar("csv_hash", { length: 64 }),
    extractedScorecardTotal: integer("extracted_scorecard_total"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    reviewStatus: varchar("review_status", { length: 40 }).notNull().default("pending"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("fkh_course_record_evidence_attempt_idx").on(table.attemptId),
    index("fkh_course_record_evidence_csv_hash_idx").on(table.csvHash),
    index("fkh_course_record_evidence_review_idx").on(table.reviewStatus),
  ],
);

export const courseRecordFlags = pgTable(
  "fkh_course_record_flags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => courseRecordAttempts.id, { onDelete: "cascade" }),
    reporterUserId: uuid("reporter_user_id").references(() => users.id, { onDelete: "set null" }),
    flagType: varchar("flag_type", { length: 60 }).notNull(),
    reason: text(),
    status: varchar("status", { length: 32 }).notNull().default("open"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    index("fkh_course_record_flags_attempt_idx").on(table.attemptId),
    index("fkh_course_record_flags_status_idx").on(table.status),
  ],
);

export const tournaments = pgTable(
  "fkh_tournaments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 180 }).notNull(),
    description: text(),
    courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
    teeSetId: uuid("tee_set_id").references(() => teeSets.id, { onDelete: "set null" }),
    format: varchar("format", { length: 40 }).notNull().default("two_round_open"),
    visibility: varchar("visibility", { length: 24 }).notNull().default("friends"),
    status: varchar("status", { length: 24 }).notNull().default("open"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    roundCount: integer("round_count").notNull().default(2),
    verificationPolicy: varchar("verification_policy", { length: 40 }).notNull().default("silver"),
    screenshotRequired: boolean("screenshot_required").notNull().default(false),
    directRapsodoRequired: boolean("direct_rapsodo_required").notNull().default(false),
    cutRuleJson: jsonb("cut_rule_json").$type<Record<string, unknown>>().notNull().default({}),
    playoffRuleJson: jsonb("playoff_rule_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").references(() => groups.id, { onDelete: "cascade" }),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("fkh_tournaments_creator_idx").on(table.createdByUserId),
    index("fkh_tournaments_course_status_idx").on(table.courseId, table.status),
    index("fkh_tournaments_visibility_status_idx").on(table.visibility, table.status),
    index("fkh_tournaments_group_idx").on(table.groupId),
  ],
);

export const tournamentRounds = pgTable(
  "fkh_tournament_rounds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    roundNumber: integer("round_number").notNull(),
    title: varchar("title", { length: 160 }),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    status: varchar("status", { length: 24 }).notNull().default("scheduled"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_tournament_rounds_number_idx").on(table.tournamentId, table.roundNumber),
    index("fkh_tournament_rounds_status_idx").on(table.tournamentId, table.status),
  ],
);

export const tournamentEntries = pgTable(
  "fkh_tournament_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 24 }).notNull().default("entered"),
    seed: integer("seed"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_tournament_entries_tournament_user_idx").on(table.tournamentId, table.userId),
    index("fkh_tournament_entries_user_idx").on(table.userId),
    index("fkh_tournament_entries_status_idx").on(table.tournamentId, table.status),
  ],
);

export const tournamentSubmissions = pgTable(
  "fkh_tournament_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => tournamentEntries.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roundNumber: integer("round_number").notNull(),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    scorecardSessionId: uuid("scorecard_session_id").references(() => sessions.id, {
      onDelete: "set null",
    }),
    grossScore: integer("gross_score").notNull(),
    netScore: integer("net_score"),
    stablefordPoints: integer("stableford_points"),
    rapsodoSyncSessionId: uuid("rapsodo_sync_session_id").references(() => rapsodoSyncSessions.id, {
      onDelete: "set null",
    }),
    importSourceFileId: uuid("import_source_file_id").references(() => importSourceFiles.id, {
      onDelete: "set null",
    }),
    scorecardScreenshotPath: text("scorecard_screenshot_path"),
    extractedScorecardTotal: integer("extracted_scorecard_total"),
    verificationStatus: varchar("verification_status", { length: 40 })
      .notNull()
      .default("pending_evidence"),
    verificationTier: varchar("verification_tier", { length: 24 }).notNull().default("unverified"),
    proofStatus: varchar("proof_status", { length: 40 }).notNull().default("pending_evidence"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_tournament_submissions_entry_round_idx").on(table.entryId, table.roundNumber),
    index("fkh_tournament_submissions_tournament_round_idx").on(
      table.tournamentId,
      table.roundNumber,
    ),
    index("fkh_tournament_submissions_status_idx").on(table.verificationStatus),
    index("fkh_tournament_submissions_session_idx").on(table.sessionId),
  ],
);

export const tournamentEvidence = pgTable(
  "fkh_tournament_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => tournamentSubmissions.id, { onDelete: "cascade" }),
    evidenceType: varchar("evidence_type", { length: 60 }).notNull(),
    storagePath: text("storage_path"),
    importSourceFileId: uuid("import_source_file_id").references(() => importSourceFiles.id, {
      onDelete: "set null",
    }),
    rapsodoSyncSessionId: uuid("rapsodo_sync_session_id").references(() => rapsodoSyncSessions.id, {
      onDelete: "set null",
    }),
    csvHash: varchar("csv_hash", { length: 64 }),
    extractedScorecardTotal: integer("extracted_scorecard_total"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    reviewStatus: varchar("review_status", { length: 40 }).notNull().default("pending"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("fkh_tournament_evidence_submission_idx").on(table.submissionId),
    index("fkh_tournament_evidence_csv_hash_idx").on(table.csvHash),
    index("fkh_tournament_evidence_review_idx").on(table.reviewStatus),
  ],
);

export const tournamentStandings = pgTable(
  "fkh_tournament_standings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => tournamentEntries.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    grossTotal: integer("gross_total").notNull().default(0),
    netTotal: integer("net_total"),
    stablefordTotal: integer("stableford_total"),
    roundsCompleted: integer("rounds_completed").notNull().default(0),
    rank: integer("rank"),
    tieBreakerJson: jsonb("tie_breaker_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    status: varchar("status", { length: 24 }).notNull().default("active"),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_tournament_standings_entry_idx").on(table.entryId),
    index("fkh_tournament_standings_rank_idx").on(table.tournamentId, table.rank),
    index("fkh_tournament_standings_user_idx").on(table.userId),
  ],
);

export const tournamentComments = pgTable(
  "fkh_tournament_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("fkh_tournament_comments_tournament_created_idx").on(table.tournamentId, table.createdAt),
    index("fkh_tournament_comments_user_idx").on(table.userId),
  ],
);

export const tournamentInvites = pgTable(
  "fkh_tournament_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    inviterUserId: uuid("inviter_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    inviteeUserId: uuid("invitee_user_id").references(() => users.id, { onDelete: "cascade" }),
    inviteeEmail: varchar("invitee_email", { length: 320 }),
    status: varchar("status", { length: 24 }).notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("fkh_tournament_invites_tournament_invitee_idx").on(
      table.tournamentId,
      table.inviteeUserId,
    ),
    index("fkh_tournament_invites_invitee_status_idx").on(table.inviteeUserId, table.status),
    index("fkh_tournament_invites_email_idx").on(table.inviteeEmail),
  ],
);

export const tournamentPrizes = pgTable(
  "fkh_tournament_prizes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    sponsorId: uuid("sponsor_id").references(() => sponsors.id, { onDelete: "set null" }),
    title: varchar("title", { length: 160 }).notNull(),
    description: text(),
    prizeType: varchar("prize_type", { length: 40 }).notNull().default("badge"),
    rankStart: integer("rank_start"),
    rankEnd: integer("rank_end"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("fkh_tournament_prizes_tournament_idx").on(table.tournamentId),
    index("fkh_tournament_prizes_sponsor_idx").on(table.sponsorId),
  ],
);

export const shotSavedViews = pgTable(
  "fkh_shot_saved_views",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    filterJson: jsonb("filter_json").$type<Record<string, unknown>>().notNull().default({}),
    sortKey: varchar("sort_key", { length: 60 }).notNull().default("recent"),
    visibility: varchar("visibility", { length: 24 }).notNull().default("private"),
    pinned: boolean("pinned").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_shot_saved_views_user_name_idx").on(table.userId, table.name),
    index("fkh_shot_saved_views_user_pinned_idx").on(table.userId, table.pinned),
  ],
);

export const practiceSessions = pgTable(
  "fkh_practice_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceType: varchar("source_type", { length: 60 }).notNull().default("coach"),
    sourceId: varchar("source_id", { length: 220 }),
    clubId: uuid("club_id").references(() => clubs.id, { onDelete: "set null" }),
    clubType: varchar("club_type", { length: 40 }),
    title: varchar("title", { length: 180 }).notNull(),
    focusArea: varchar("focus_area", { length: 80 }).notNull().default("practice"),
    status: varchar("status", { length: 24 }).notNull().default("planned"),
    plannedAt: timestamp("planned_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    targetShots: integer("target_shots").notNull().default(12),
    recordedShots: integer("recorded_shots").notNull().default(0),
    notes: text("notes"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("fkh_practice_sessions_user_status_idx").on(table.userId, table.status),
    index("fkh_practice_sessions_user_planned_idx").on(table.userId, table.plannedAt),
    index("fkh_practice_sessions_source_idx").on(table.sourceType, table.sourceId),
  ],
);

export const courseRecordGoals = pgTable(
  "fkh_course_record_goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recordId: uuid("record_id")
      .notNull()
      .references(() => courseRecords.id, { onDelete: "cascade" }),
    targetUserId: uuid("target_user_id").references(() => users.id, { onDelete: "set null" }),
    targetValue: doublePrecision("target_value"),
    targetLabel: varchar("target_label", { length: 120 }),
    notifyWhenBeaten: boolean("notify_when_beaten").notNull().default(true),
    status: varchar("status", { length: 24 }).notNull().default("active"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_course_record_goals_user_record_idx").on(table.userId, table.recordId),
    index("fkh_course_record_goals_user_status_idx").on(table.userId, table.status),
    index("fkh_course_record_goals_target_idx").on(table.targetUserId),
  ],
);

export const courseFollows = pgTable(
  "fkh_course_follows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    notifyRecords: boolean("notify_records").notNull().default(true),
    providerAliasesJson: jsonb("provider_aliases_json")
      .$type<Array<{ provider: string; alias: string }>>()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_course_follows_user_course_idx").on(table.userId, table.courseId),
    index("fkh_course_follows_course_idx").on(table.courseId),
  ],
);

export const userFeaturePreferences = pgTable("fkh_user_feature_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  autoShareRounds: boolean("auto_share_rounds").notNull().default(false),
  autoSharePbs: boolean("auto_share_pbs").notNull().default(false),
  autoShareAchievements: boolean("auto_share_achievements").notNull().default(false),
  autoSharePractice: boolean("auto_share_practice").notNull().default(false),
  publicSharePreview: boolean("public_share_preview").notNull().default(false),
  featuredRecordIdsJson: jsonb("featured_record_ids_json").$type<string[]>().notNull().default([]),
  highlightSettingsJson: jsonb("highlight_settings_json")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const weeklyRecaps = pgTable(
  "fkh_weekly_recaps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weekStart: timestamp("week_start", { withTimezone: true }).notNull(),
    weekEnd: timestamp("week_end", { withTimezone: true }).notNull(),
    headline: varchar("headline", { length: 220 }).notNull(),
    summaryJson: jsonb("summary_json").$type<Record<string, unknown>>().notNull().default({}),
    visibility: varchar("visibility", { length: 24 }).notNull().default("private"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_weekly_recaps_user_week_idx").on(table.userId, table.weekStart),
    index("fkh_weekly_recaps_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export type NewUser = typeof users.$inferInsert;
export type NewAdminUser = typeof adminUsers.$inferInsert;
export type NewAdminAuditLog = typeof adminAuditLog.$inferInsert;
export type NewUserProfile = typeof userProfiles.$inferInsert;
export type NewFriendRequest = typeof friendRequests.$inferInsert;
export type NewFriendship = typeof friendships.$inferInsert;
export type NewUserBlock = typeof userBlocks.$inferInsert;
export type NewUserFollow = typeof userFollows.$inferInsert;
export type NewFeedItem = typeof feedItems.$inferInsert;
export type NewFeedReaction = typeof feedReactions.$inferInsert;
export type NewFeedComment = typeof feedComments.$inferInsert;
export type NewFeedCommentReaction = typeof feedCommentReactions.$inferInsert;
export type NewChallengeTemplate = typeof challengeTemplates.$inferInsert;
export type NewChallenge = typeof challenges.$inferInsert;
export type NewChallengeEntry = typeof challengeEntries.$inferInsert;
export type NewChallengeAttempt = typeof challengeAttempts.$inferInsert;
export type NewChallengeResult = typeof challengeResults.$inferInsert;
export type NewChallengeComment = typeof challengeComments.$inferInsert;
export type NewChallengeInvite = typeof challengeInvites.$inferInsert;
export type NewGroup = typeof groups.$inferInsert;
export type NewGroupMembership = typeof groupMemberships.$inferInsert;
export type NewGroupInvite = typeof groupInvites.$inferInsert;
export type NewGroupPost = typeof groupPosts.$inferInsert;
export type NewGroupChallengeLink = typeof groupChallengeLinks.$inferInsert;
export type NewBillingCustomer = typeof billingCustomers.$inferInsert;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type NewEntitlement = typeof entitlements.$inferInsert;
export type NewUsageEvent = typeof usageEvents.$inferInsert;
export type NewPlanLimit = typeof planLimits.$inferInsert;
export type NewSponsor = typeof sponsors.$inferInsert;
export type NewChallengeReward = typeof challengeRewards.$inferInsert;
export type NewPartnerOffer = typeof partnerOffers.$inferInsert;
export type NewOfferClick = typeof offerClicks.$inferInsert;
export type NewProviderAccount = typeof providerAccounts.$inferInsert;
export type NewProviderSession = typeof providerSessions.$inferInsert;
export type NewImportJob = typeof importJobs.$inferInsert;
export type NewImportSourceFile = typeof importSourceFiles.$inferInsert;
export type NewImportMapping = typeof importMappings.$inferInsert;
export type NewAiSocialSummary = typeof aiSocialSummaries.$inferInsert;
export type NewSocialReport = typeof socialReports.$inferInsert;
export type NewModerationEvent = typeof moderationEvents.$inferInsert;
export type NewAccountMembership = typeof accountMemberships.$inferInsert;
export type NewAccountInvitation = typeof accountInvitations.$inferInsert;
export type NewShareLink = typeof shareLinks.$inferInsert;
export type NewClub = typeof clubs.$inferInsert;
export type NewSession = typeof sessions.$inferInsert;
export type NewShot = typeof shots.$inferInsert;
export type NewImportRow = typeof importRows.$inferInsert;
export type NewImportFile = typeof importFiles.$inferInsert;
export type NewCourse = typeof courses.$inferInsert;
export type NewTeeSet = typeof teeSets.$inferInsert;
export type NewHole = typeof holes.$inferInsert;
export type NewBallModel = typeof ballModels.$inferInsert;
export type NewClubEquipmentHistory = typeof clubEquipmentHistory.$inferInsert;
export type NewStrokesGainedBaseline = typeof strokesGainedBaselines.$inferInsert;
export type NewStrokesGainedShotEvent = typeof strokesGainedShotEvents.$inferInsert;
export type NewUserAchievement = typeof userAchievements.$inferInsert;
export type NewXpLedger = typeof xpLedger.$inferInsert;
export type NewAchievementProgress = typeof achievementProgress.$inferInsert;
export type NewAchievementSyncState = typeof achievementSyncState.$inferInsert;
export type NewRapsodoSyncSession = typeof rapsodoSyncSessions.$inferInsert;
export type NewCourseProviderAlias = typeof courseProviderAliases.$inferInsert;
export type NewCourseRecordCategory = typeof courseRecordCategories.$inferInsert;
export type NewCourseRecord = typeof courseRecords.$inferInsert;
export type NewCourseRecordAttempt = typeof courseRecordAttempts.$inferInsert;
export type NewCourseRecordResult = typeof courseRecordResults.$inferInsert;
export type NewCourseRecordEvidence = typeof courseRecordEvidence.$inferInsert;
export type NewCourseRecordFlag = typeof courseRecordFlags.$inferInsert;
export type NewTournament = typeof tournaments.$inferInsert;
export type NewTournamentRound = typeof tournamentRounds.$inferInsert;
export type NewTournamentEntry = typeof tournamentEntries.$inferInsert;
export type NewTournamentSubmission = typeof tournamentSubmissions.$inferInsert;
export type NewTournamentEvidence = typeof tournamentEvidence.$inferInsert;
export type NewTournamentStanding = typeof tournamentStandings.$inferInsert;
export type NewTournamentComment = typeof tournamentComments.$inferInsert;
export type NewTournamentInvite = typeof tournamentInvites.$inferInsert;
export type NewTournamentPrize = typeof tournamentPrizes.$inferInsert;
export type NewShotSavedView = typeof shotSavedViews.$inferInsert;
export type NewPracticeSession = typeof practiceSessions.$inferInsert;
export type NewCourseRecordGoal = typeof courseRecordGoals.$inferInsert;
export type NewCourseFollow = typeof courseFollows.$inferInsert;
export type NewUserFeaturePreference = typeof userFeaturePreferences.$inferInsert;
export type NewWeeklyRecap = typeof weeklyRecaps.$inferInsert;
