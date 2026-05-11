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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

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
    provider: varchar("provider", { length: 80 }).notNull().default("manual"),
    externalId: varchar("external_id", { length: 180 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fkh_courses_provider_external_idx").on(table.provider, table.externalId),
    index("fkh_courses_name_idx").on(table.name),
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
    rawCsvText: text("raw_csv_text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("fkh_sessions_user_date_idx").on(table.userId, table.date),
    index("fkh_sessions_user_source_idx").on(table.userId, table.source),
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
    index("fkh_shots_user_session_hole_idx").on(table.userId, table.sessionId, table.courseHoleNumber),
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
    sourceSessionId: uuid("source_session_id").references(() => sessions.id, { onDelete: "set null" }),
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
    uniqueIndex("fkh_achievement_progress_user_achievement_idx").on(table.userId, table.achievementId),
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
  (table) => [
    uniqueIndex("fkh_achievement_sync_state_user_idx").on(table.userId),
  ],
);

export type NewUser = typeof users.$inferInsert;
export type NewClub = typeof clubs.$inferInsert;
export type NewSession = typeof sessions.$inferInsert;
export type NewShot = typeof shots.$inferInsert;
export type NewImportRow = typeof importRows.$inferInsert;
export type NewCourse = typeof courses.$inferInsert;
export type NewTeeSet = typeof teeSets.$inferInsert;
export type NewHole = typeof holes.$inferInsert;
export type NewUserAchievement = typeof userAchievements.$inferInsert;
export type NewXpLedger = typeof xpLedger.$inferInsert;
export type NewAchievementProgress = typeof achievementProgress.$inferInsert;
export type NewAchievementSyncState = typeof achievementSyncState.$inferInsert;
