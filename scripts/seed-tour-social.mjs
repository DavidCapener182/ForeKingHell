#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import postgres from "postgres";

import { tourPlayerProfiles } from "./tour-player-profiles.mjs";

const SEED_MARKER = "fkh-demo-social-v1";
const SEEDED_TOUR_PLAYER_COUNT = 100;
const FOREKINGHELL_USERNAME = "forekinghell";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOCAL_DATABASE_HOSTS = new Set(["", "localhost", "127.0.0.1", "::1"]);
const TOUR_COVER_IMAGES = [
  "tour-cover-01.webp",
  "tour-cover-02.webp",
  "tour-cover-03.webp",
  "tour-cover-04.webp",
  "tour-cover-05.webp",
  "tour-cover-06.webp",
  "tour-cover-07.webp",
  "tour-cover-08.webp",
  "tour-cover-09.webp",
  "tour-cover-10.webp",
];

const args = new Set(process.argv.slice(2).filter((arg) => !arg.startsWith("--viewer-user-id=")));
const viewerUserIdArg = process.argv
  .slice(2)
  .find((arg) => arg.startsWith("--viewer-user-id="))
  ?.split("=")[1];
const dryRun = args.has("--dry-run");
const reset = args.has("--reset");
const forceRemote = args.has("--force-remote");

const seededTourPlayerProfiles = tourPlayerProfiles.slice(0, SEEDED_TOUR_PLAYER_COUNT);
const allTourPlayerUserIds = tourPlayerProfiles.map((profile) => uuidFor(`user:${slugForName(profile.name)}`));

const golfers = seededTourPlayerProfiles.map((profile, index) => {
  const slug = slugForName(profile.name);
  const scoringAverage = profile.scoring ?? estimatedScoringAverage(profile, index);
  const driverTotal = profile.drive ?? estimatedDriverTotal(profile, index);
  const roundScore = Math.round(clamp(scoringAverage + wiggle(index, 4, 0.9), 66, 74));
  const recentTournamentScores = [0, 1, 2, 3].map((roundIndex) =>
    Math.round(clamp(scoringAverage + wiggle(index, roundIndex + 9, 1.6) + (roundIndex % 2 === 0 ? -0.4 : 0.6), 65, 76)),
  );

  return {
    ...profile,
    slug,
    email: `${slug}.tour@example.invalid`,
    bio: buildGolferBio(profile),
    homeCourse: tourHomeCourse(profile),
    handicapBand: "Tour",
    driverCarry: Math.round(driverTotal - 22),
    roundScore,
    scoringAverage: round1(scoringAverage),
    recentTournamentScores,
    xp: Math.max(2400, Math.round(6800 - index * 34 + (profile.avg ?? 1.2) * 160 + wiggle(index, 11, 120))),
    rankingLabel: profile.rank ? `OWGR #${profile.rank}` : "Featured real player",
    dataSourceLabel: profile.featured ? "featured-tour" : "owgr-tour",
    index,
    userId: uuidFor(`user:${slug}`),
    username: `tour-${slug}`,
    avatarUrl: tourPlayerHeadshotUrl(profile),
    headerImageUrl: tourCoverImageUrl(index),
  };
});

if (golfers.length !== SEEDED_TOUR_PLAYER_COUNT) {
  throw new Error(`Tour player seed requires exactly ${SEEDED_TOUR_PLAYER_COUNT} golfers. Received ${golfers.length}.`);
}

const golfersBySlug = new Map(golfers.map((golfer) => [golfer.slug, golfer]));

for (const requiredLegacySlug of ["rory-mcilroy", "scottie-scheffler", "jordan-spieth", "collin-morikawa", "justin-thomas", "jon-rahm"]) {
  if (!golfersBySlug.has(requiredLegacySlug)) {
    throw new Error(`Tour player seed is missing required featured player ${requiredLegacySlug}.`);
  }
}

const demoUserIds = allTourPlayerUserIds;
const courseId = uuidFor("course:demo-links");
const teeSetId = uuidFor("tee-set:demo-links:championship");
const groupId = uuidFor("group:demo-tour");
const tournamentId = uuidFor("tournament:demo-spring-major");
const challengeIds = [
  uuidFor("challenge:straightest-drive"),
  uuidFor("challenge:7i-consistency"),
  uuidFor("challenge:wedge-ladder"),
];

const clubTypes = [
  { type: "driver", brand: "TaylorMade", model: "Qi10 Tour Driver", roll: 22, launch: 13.8 },
  { type: "5w", brand: "TaylorMade", model: "Qi10 Tour 5W", roll: 14, launch: 12.6 },
  { type: "4i", brand: "TaylorMade", model: "P790 Tour 4 Iron", roll: 10, launch: 14.8 },
  { type: "7i", brand: "TaylorMade", model: "P7MC Tour 7 Iron", roll: 7, launch: 17.2 },
  { type: "9i", brand: "TaylorMade", model: "P7MC Tour 9 Iron", roll: 4, launch: 21.4 },
  { type: "pw", brand: "TaylorMade", model: "MG Tour Pitching Wedge", roll: 3, launch: 25.6 },
  { type: "sw", brand: "TaylorMade", model: "MG Tour Sand Wedge", roll: 2, launch: 30.4 },
  { type: "lw", brand: "TaylorMade", model: "MG Tour Lob Wedge", roll: 1, launch: 33.8 },
];

const holes = [
  [1, 4, 11, 421],
  [2, 5, 5, 538],
  [3, 4, 15, 376],
  [4, 3, 17, 172],
  [5, 4, 7, 432],
  [6, 4, 3, 451],
  [7, 5, 9, 552],
  [8, 3, 13, 183],
  [9, 4, 1, 459],
  [10, 4, 12, 394],
  [11, 4, 4, 443],
  [12, 3, 18, 161],
  [13, 5, 8, 548],
  [14, 4, 2, 463],
  [15, 4, 14, 389],
  [16, 3, 16, 176],
  [17, 5, 10, 541],
  [18, 4, 6, 442],
].map(([holeNumber, par, strokeIndex, yards]) => ({ holeNumber, par, strokeIndex, yards }));

loadLocalEnv();

if (viewerUserIdArg && !UUID_PATTERN.test(viewerUserIdArg)) {
  throw new Error(`--viewer-user-id must be a UUID. Received: ${viewerUserIdArg}`);
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

assertLocalDatabase(databaseUrl);

const sql = postgres(databaseUrl, { max: 1, prepare: false });

try {
  if (reset) {
    if (dryRun) {
      const counts = await countExistingDemoRows(sql);
      printCounts("Dry run: seeded tour rows that would be removed", counts);
    } else {
      const counts = await resetDemoData(sql);
      printCounts("Removed seeded tour rows", counts);
    }
  } else {
    const viewerProfiles = await getViewerProfiles(sql);
    const plan = buildPlan(viewerProfiles);

    if (dryRun) {
      printSeedPlan(plan, viewerProfiles);
    } else {
      const before = await countSummaryRows(sql);
      await sql.begin(async (tx) => seedDemoData(tx, plan));
      const after = await countSummaryRows(sql);
      printDelta(before, after);
    }
  }
} finally {
  await sql.end();
}

function loadLocalEnv() {
  if (!fs.existsSync(".env")) {
    return;
  }

  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);

    if (!match || match[1].startsWith("#") || process.env[match[1]]) {
      continue;
    }

    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

function assertLocalDatabase(url) {
  const parsed = new URL(url);
  const host = parsed.hostname;

  if (!LOCAL_DATABASE_HOSTS.has(host) && !forceRemote) {
    throw new Error(
      `Refusing to seed a non-local database host (${host}). Re-run with --force-remote only if this is an intentional seeded tour database.`,
    );
  }
}

async function getViewerProfiles(db) {
  const rows = viewerUserIdArg
    ? await db`
        select
          profile.user_id as "userId",
          profile.username,
          profile.display_name as "displayName"
        from fkh_user_profiles profile
        where profile.user_id = ${viewerUserIdArg}
          and not (profile.user_id = any(${demoUserIds}))
        limit 1
      `
    : await db`
        select
          profile.user_id as "userId",
          profile.username,
          profile.display_name as "displayName"
        from fkh_user_profiles profile
        where not (profile.user_id = any(${demoUserIds}))
        order by profile.created_at asc
      `;

  if (viewerUserIdArg && rows.length === 0) {
    throw new Error(`No non-seeded social profile exists for --viewer-user-id=${viewerUserIdArg}.`);
  }

  return rows;
}

function buildPlan(viewerProfiles) {
  const now = new Date();
  const seededAt = now.toISOString();
  const dates = {
    created: daysAgo(now, 35),
    thisWeek: daysAgo(now, 4),
    yesterday: daysAgo(now, 1),
  };
  const demoClubs = new Map();
  const ballModels = [];
  const equipmentHistory = [];
  const stockYardages = [];
  const sessions = [];
  const importFiles = [];
  const syncSessions = [];
  const shots = [];
  const feedItems = [];
  const xpLedger = [];
  const userAchievements = [];
  const achievementProgress = [];

  for (const golfer of golfers) {
    const clubs = buildClubs(golfer, dates.created);
    demoClubs.set(golfer.slug, clubs);
    ballModels.push(buildBallModel(golfer, dates.created));

    for (const club of clubs) {
      equipmentHistory.push(buildEquipmentHistory(golfer, club, dates.created));
      stockYardages.push(buildStockYardage(golfer, club, now));
    }

    const golferSessions = buildSessions(golfer, dates.thisWeek);
    sessions.push(...golferSessions);
    importFiles.push(...golferSessions.filter((session) => session.source !== "manual").map(buildImportFile));
    syncSessions.push(...golferSessions.filter((session) => session.source === "rapsodo_cloud").map(buildSyncSession));

    for (const session of golferSessions) {
      shots.push(...buildShots(golfer, session, clubs));
    }

    userAchievements.push(...buildUserAchievements(golfer, dates.thisWeek));
    xpLedger.push(...buildXpLedger(golfer, dates.thisWeek));
    achievementProgress.push(...buildAchievementProgress(golfer, now));
    feedItems.push(...buildGolferFeedItems(golfer, golferSessions, dates.thisWeek));
  }

  const challenges = buildChallenges(dates.thisWeek);
  const challengeEntries = buildChallengeEntries(challenges, viewerProfiles, dates.thisWeek);
  const challengeAttempts = buildChallengeAttempts(challenges, dates.thisWeek);
  const challengeResults = rankChallengeResults(challenges, challengeAttempts, dates.thisWeek);
  const challengeComments = buildChallengeComments(challenges, viewerProfiles, dates.thisWeek);
  const groupMemberships = buildGroupMemberships(viewerProfiles, dates.created);
  const groupPosts = buildGroupPosts(viewerProfiles, dates.thisWeek);
  const groupChallengeLinks = challenges.map((challenge) => ({
    id: uuidFor(`group-challenge:${challenge.id}`),
    groupId,
    challengeId: challenge.id,
    createdByUserId: challenge.creatorUserId,
    createdAt: challenge.createdAt,
  }));
  const recordData = buildCourseRecordData(dates.thisWeek);
  const tournamentData = buildTournamentData(viewerProfiles, dates.thisWeek);

  feedItems.push(...buildCompetitionFeedItems(challenges, challengeResults, recordData, tournamentData, dates.thisWeek));

  const feedSocial = buildFeedSocialRows(feedItems, viewerProfiles, dates.yesterday);
  const intelligenceRows = buildSocialIntelligenceRows(viewerProfiles, feedItems, dates.yesterday);
  const socialGraphRows = buildSocialGraphRows(viewerProfiles, dates.created);

  return {
    seededAt,
    viewerProfiles,
    users: golfers.map((golfer) => buildUser(golfer, dates.created)),
    profiles: golfers.map((golfer) => buildProfile(golfer, dates.created)),
    course: buildCourse(dates.created),
    teeSet: buildTeeSet(dates.created),
    holes: buildHoles(dates.created),
    challengeTemplates: buildChallengeTemplates(dates.created),
    clubs: [...demoClubs.values()].flat(),
    ballModels,
    equipmentHistory,
    stockYardages,
    sessions,
    importFiles,
    syncSessions,
    shots,
    xpLedger,
    userAchievements,
    achievementProgress,
    group: buildGroup(dates.created),
    groupMemberships,
    groupPosts,
    groupChallengeLinks,
    challenges,
    challengeEntries,
    challengeAttempts,
    challengeResults,
    challengeComments,
    courseRecordCategories: recordData.categories,
    courseRecords: recordData.records,
    courseRecordAttempts: recordData.attempts,
    courseRecordResults: recordData.results,
    courseRecordEvidence: recordData.evidence,
    tournament: tournamentData.tournament,
    tournamentRounds: tournamentData.rounds,
    tournamentEntries: tournamentData.entries,
    tournamentSubmissions: tournamentData.submissions,
    tournamentEvidence: tournamentData.evidence,
    tournamentStandings: tournamentData.standings,
    tournamentComments: tournamentData.comments,
    tournamentInvites: tournamentData.invites,
    feedItems,
    feedReactions: feedSocial.reactions,
    feedComments: feedSocial.comments,
    feedCommentReactions: feedSocial.commentReactions,
    friendRequests: socialGraphRows.friendRequests,
    friendships: socialGraphRows.friendships,
    userBlocks: socialGraphRows.userBlocks,
    userFollows: socialGraphRows.userFollows,
    socialSummaries: intelligenceRows.summaries,
    socialReports: intelligenceRows.reports,
    moderationEvents: intelligenceRows.moderationEvents,
  };
}

async function seedDemoData(tx, plan) {
  await seedUsers(tx, plan.users);
  await seedProfiles(tx, plan.profiles);
  await seedCourse(tx, plan.course, plan.teeSet, plan.holes);
  await seedChallengeTemplates(tx, plan.challengeTemplates);
  await seedClubs(tx, plan.clubs);
  await seedBallModels(tx, plan.ballModels);
  await seedEquipmentHistory(tx, plan.equipmentHistory);
  await seedSessions(tx, plan.sessions);
  await seedImportFiles(tx, plan.importFiles);
  await seedSyncSessions(tx, plan.syncSessions);
  await seedShots(tx, plan.shots);
  await seedStockYardages(tx, plan.stockYardages);
  await seedAchievements(tx, plan.userAchievements, plan.xpLedger, plan.achievementProgress);
  await seedSocialGraph(tx, plan.friendships, plan.friendRequests, plan.userBlocks, plan.userFollows);
  await seedGroup(tx, plan.group, plan.groupMemberships, plan.groupPosts);
  await seedChallenges(
    tx,
    plan.challenges,
    plan.challengeEntries,
    plan.challengeAttempts,
    plan.challengeResults,
    plan.challengeComments,
    plan.groupChallengeLinks,
  );
  await seedCourseRecords(
    tx,
    plan.courseRecordCategories,
    plan.courseRecords,
    plan.courseRecordAttempts,
    plan.courseRecordResults,
    plan.courseRecordEvidence,
  );
  await seedTournament(tx, plan);
  await seedFeed(tx, plan.feedItems, plan.feedReactions, plan.feedComments, plan.feedCommentReactions);
  await seedSocialIntelligence(tx, plan.socialSummaries, plan.socialReports, plan.moderationEvents);
}

async function resetDemoData(db) {
  const before = await countExistingDemoRows(db);

  await db.begin(async (tx) => {
    await tx`delete from fkh_ai_social_summaries where evidence_json->>'demoSeed' = ${SEED_MARKER}`;
    await tx`delete from fkh_social_reports where details like ${`%${SEED_MARKER}%`} or reported_user_id = any(${demoUserIds})`;
    await tx`delete from fkh_moderation_events where metadata_json->>'demoSeed' = ${SEED_MARKER}`;
    await tx`delete from fkh_tournaments where id = ${tournamentId}`;
    await tx`delete from fkh_challenges where id = any(${challengeIds})`;
    await tx`delete from fkh_groups where id = ${groupId}`;
    await tx`delete from fkh_courses where id = ${courseId}`;
    await tx`delete from fkh_course_record_categories where metadata_json->>'demoSeed' = ${SEED_MARKER}`;
    await tx`delete from fkh_challenge_templates where rules_json->>'demoSeed' = ${SEED_MARKER}`;
    await tx`delete from fkh_users where id = any(${demoUserIds})`;
  });

  return before;
}

async function countExistingDemoRows(db) {
  const tables = [
    ["fkh_users", db`id = any(${demoUserIds})`],
    ["fkh_user_profiles", db`user_id = any(${demoUserIds})`],
    ["fkh_friendships", db`user_a_id = any(${demoUserIds}) or user_b_id = any(${demoUserIds})`],
    ["fkh_feed_items", db`user_id = any(${demoUserIds}) or metadata_json->>'demoSeed' = ${SEED_MARKER}`],
    ["fkh_groups", db`id = ${groupId}`],
    ["fkh_challenges", db`id = any(${challengeIds})`],
    ["fkh_courses", db`id = ${courseId}`],
    ["fkh_sessions", db`user_id = any(${demoUserIds})`],
    ["fkh_shots", db`user_id = any(${demoUserIds})`],
    ["fkh_course_records", db`course_id = ${courseId}`],
    ["fkh_course_record_categories", db`metadata_json->>'demoSeed' = ${SEED_MARKER}`],
    ["fkh_tournaments", db`id = ${tournamentId}`],
    ["fkh_challenge_templates", db`rules_json->>'demoSeed' = ${SEED_MARKER}`],
    ["fkh_ai_social_summaries", db`evidence_json->>'demoSeed' = ${SEED_MARKER}`],
    ["fkh_social_reports", db`details like ${`%${SEED_MARKER}%`} or reported_user_id = any(${demoUserIds})`],
    ["fkh_moderation_events", db`metadata_json->>'demoSeed' = ${SEED_MARKER}`],
  ];
  const counts = {};

  for (const [table, where] of tables) {
    const [row] = await db`select count(*)::int as count from ${db(table)} where ${where}`;
    counts[table] = row.count;
  }

  return counts;
}

async function countSummaryRows(db) {
  const tables = [
    "fkh_user_profiles",
    "fkh_friendships",
    "fkh_feed_items",
    "fkh_feed_reactions",
    "fkh_feed_comments",
    "fkh_groups",
    "fkh_group_memberships",
    "fkh_challenges",
    "fkh_challenge_results",
    "fkh_sessions",
    "fkh_clubs",
    "fkh_shots",
    "fkh_stock_yardages",
    "fkh_course_records",
    "fkh_course_record_results",
    "fkh_tournaments",
    "fkh_tournament_standings",
    "fkh_ai_social_summaries",
    "fkh_social_reports",
    "fkh_moderation_events",
  ];
  const counts = {};

  for (const table of tables) {
    const [row] = await db`select count(*)::int as count from ${db(table)}`;
    counts[table] = row.count;
  }

  return counts;
}

function printSeedPlan(plan, viewerProfiles) {
  console.log("Dry run: would seed tour player social network.");
  console.log(`Viewer profile targets: ${viewerProfiles.length}`);
  printCounts("Rows planned", {
    users: plan.users.length,
    profiles: plan.profiles.length,
    friendships: plan.friendships.length,
    friendRequests: plan.friendRequests.length,
    userBlocks: plan.userBlocks.length,
    clubs: plan.clubs.length,
    sessions: plan.sessions.length,
    shots: plan.shots.length,
    stockYardages: plan.stockYardages.length,
    feedItems: plan.feedItems.length,
    feedReactions: plan.feedReactions.length,
    feedComments: plan.feedComments.length,
    groups: 1,
    groupMemberships: plan.groupMemberships.length,
    challenges: plan.challenges.length,
    challengeResults: plan.challengeResults.length,
    courseRecords: plan.courseRecords.length,
    courseRecordResults: plan.courseRecordResults.length,
    tournaments: 1,
    tournamentStandings: plan.tournamentStandings.length,
    socialSummaries: plan.socialSummaries.length,
    socialReports: plan.socialReports.length,
    moderationEvents: plan.moderationEvents.length,
  });
}

function printCounts(label, counts) {
  console.log(label);

  for (const [table, count] of Object.entries(counts)) {
    console.log(`- ${table}: ${count}`);
  }
}

function printDelta(before, after) {
  console.log("Seed complete. Current row deltas:");

  for (const [table, afterCount] of Object.entries(after)) {
    const beforeCount = before[table] ?? 0;
    const delta = afterCount - beforeCount;
    console.log(`- ${table}: ${afterCount} (${delta >= 0 ? "+" : ""}${delta})`);
  }
}

function buildUser(golfer, createdAt) {
  return {
    id: golfer.userId,
    email: golfer.email,
    name: golfer.name,
    preferredUnits: "yards",
    theme: "light",
    tableDensity: "comfortable",
    dashboardPins: ["social", "bag", "leaderboard", "progress"],
    privacySettingsJson: {
      allowCoachAccess: true,
      allowLeaderboard: true,
      publicProfile: true,
      demoSeed: SEED_MARKER,
    },
    onboardingCompletedAt: createdAt,
    createdAt,
    updatedAt: createdAt,
  };
}

function buildProfile(golfer, createdAt) {
  return {
    userId: golfer.userId,
    username: golfer.username,
    displayName: golfer.name,
    avatarUrl: golfer.avatarUrl,
    headerImageUrl: golfer.headerImageUrl,
    bio: golfer.bio,
    homeCourse: golfer.homeCourse,
    primaryLaunchMonitor: null,
    handicapBand: golfer.handicapBand,
    publicProfile: true,
    friendProfile: false,
    feedVisibilityDefault: "public",
    leaderboardVisibility: "public",
    visibilitySettingsJson: {
      rounds: "public",
      pbs: "public",
      bag: "public",
      achievements: "public",
      handicap: "public",
      practice: "public",
      exactShots: "public",
      profileKind: "tour-player",
      tourPlayer: true,
      managedProfile: true,
      allowFriendRequests: false,
      allowCompare: true,
      cbsId: golfer.cbsId ?? null,
      demoSeed: SEED_MARKER,
    },
    achievementShowcaseJson: ["course_champion", "major_contender", "driver_total_250"],
    pbShowcaseJson: [
      { label: "Ranking", value: golfer.rankingLabel, demoSeed: SEED_MARKER },
      { label: "Scoring avg", value: golfer.scoringAverage ? golfer.scoringAverage.toFixed(2) : "Tour profile", demoSeed: SEED_MARKER },
      { label: "Driver total", value: `${Math.round(golfer.driverCarry + 22)} yd`, demoSeed: SEED_MARKER },
      { label: "Best round", value: String(golfer.roundScore), demoSeed: SEED_MARKER },
      { label: "Recent scores", value: golfer.recentTournamentScores.slice(0, 2).join(" / "), demoSeed: SEED_MARKER },
    ],
    createdAt,
    updatedAt: createdAt,
  };
}

function buildCourse(createdAt) {
  return {
    id: courseId,
    name: "ForeKingHell Tour Links",
    country: "United Kingdom",
    provider: "tour-seed",
    externalId: "forekinghell-tour-links",
    visibility: "shared",
    createdByUserId: golfers[0].userId,
    createdAt,
    updatedAt: createdAt,
  };
}

function buildTeeSet(createdAt) {
  return {
    id: teeSetId,
    courseId,
    name: "Championship",
    par: 72,
    courseRating: 74.2,
    slopeRating: 138,
    yards: holes.reduce((total, hole) => total + hole.yards, 0),
    meters: Math.round(holes.reduce((total, hole) => total + hole.yards, 0) * 0.9144),
    createdAt,
    updatedAt: createdAt,
  };
}

function buildHoles(createdAt) {
  return holes.map((hole) => {
    const baseLat = 56.343 + hole.holeNumber * 0.0011;
    const baseLng = -2.803 - hole.holeNumber * 0.0012;
    const greenLat = baseLat + 0.0015 + (hole.holeNumber % 3) * 0.0002;
    const greenLng = baseLng - 0.0011 - (hole.holeNumber % 4) * 0.00015;

    return {
      id: uuidFor(`hole:${hole.holeNumber}`),
      courseId,
      teeSetId,
      holeNumber: hole.holeNumber,
      par: hole.par,
      strokeIndex: hole.strokeIndex,
      yards: hole.yards,
      teeLat: baseLat,
      teeLng: baseLng,
      greenLat,
      greenLng,
      centerlineGeojson: {
        type: "LineString",
        coordinates: [
          [baseLng, baseLat],
          [(baseLng + greenLng) / 2, (baseLat + greenLat) / 2],
          [greenLng, greenLat],
        ],
      },
      createdAt,
      updatedAt: createdAt,
    };
  });
}

function buildChallengeTemplates(createdAt) {
  return [
    {
      id: uuidFor("challenge-template:straightest-drive"),
      slug: "tour-straightest-drive",
      name: "Straightest Drive",
      description: "Post the lowest offline error with a verified tee shot.",
      challengeType: "straightest_drive",
      rulesJson: { metric: "offline_error", clubTypes: ["driver"], minShots: 1, demoSeed: SEED_MARKER },
      scoringDirection: "asc",
      active: true,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: uuidFor("challenge-template:7i-consistency"),
      slug: "tour-7i-consistency",
      name: "7i Consistency",
      description: "Hit a 7 iron set and rank by the tightest carry spread.",
      challengeType: "iron_consistency",
      rulesJson: { metric: "carry_spread", clubTypes: ["7i"], minShots: 10, demoSeed: SEED_MARKER },
      scoringDirection: "asc",
      active: true,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: uuidFor("challenge-template:wedge-ladder"),
      slug: "tour-wedge-ladder",
      name: "Wedge Ladder 50-100 yd",
      description: "Build a verified wedge ladder through scoring windows.",
      challengeType: "wedge_ladder",
      rulesJson: { metric: "ladder_error", clubTypes: ["pw", "sw", "lw"], minShots: 18, demoSeed: SEED_MARKER },
      scoringDirection: "asc",
      active: true,
      createdAt,
      updatedAt: createdAt,
    },
  ];
}

function buildClubs(golfer, createdAt) {
  return clubTypes.map((club) => ({
    id: uuidFor(`club:${golfer.slug}:${club.type}`),
    userId: golfer.userId,
    type: club.type,
    brand: club.brand,
    model: club.model,
    normalizedClubKey: `${club.type}:${club.brand}:${club.model}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    active: true,
    createdAt,
    updatedAt: createdAt,
    expectedCarry: carryForClub(golfer, club.type),
    roll: club.roll,
    launch: club.launch,
  }));
}

function buildBallModel(golfer, createdAt) {
  return {
    id: uuidFor(`ball:${golfer.slug}:tp5x`),
    userId: golfer.userId,
    brand: "TaylorMade",
    model: golfer.index % 2 === 0 ? "TP5x Tour" : "TP5 Tour",
    active: true,
    createdAt,
    updatedAt: createdAt,
  };
}

function buildEquipmentHistory(golfer, club, createdAt) {
  return {
    id: uuidFor(`equipment:${golfer.slug}:${club.type}`),
    userId: golfer.userId,
    clubId: club.id,
    ballModelId: uuidFor(`ball:${golfer.slug}:tp5x`),
    effectiveFrom: createdAt,
    effectiveTo: null,
    loftDeg: loftForClub(club.type),
    lieDeg: 59 + (club.type === "driver" ? 0 : golfer.index % 4),
    shaft: club.type === "driver" ? "Ventus TR 6X" : "Dynamic Gold Tour Issue X100",
    swingWeight: club.type === "driver" ? "D4" : "D3",
    notes: `Tour equipment profile for ${golfer.name}. ${SEED_MARKER}`,
    createdAt,
    updatedAt: createdAt,
  };
}

function buildStockYardage(golfer, club, now) {
  const carry = club.expectedCarry;
  return {
    id: uuidFor(`stock:${golfer.slug}:${club.type}`),
    userId: golfer.userId,
    clubId: club.id,
    calculatedAt: now,
    sampleSize: 24 + ((golfer.index + club.type.length) % 12),
    carryMedianYd: round1(carry),
    carryMeanYd: round1(carry + wiggle(golfer.index, club.type.length, 2.2)),
    carryP75Yd: round1(carry + 4.5),
    carryP25Yd: round1(carry - 4.5),
    totalMedianYd: round1(carry + club.roll),
    dispersionLeftYd: round1(-8 - (golfer.index % 4)),
    dispersionRightYd: round1(7 + (golfer.index % 5)),
    confidenceScore: 72 + ((golfer.index + club.type.length) % 24),
    recommendedPlayNumberYd: round1(carry - 2),
    createdAt: now,
  };
}

function buildSessions(golfer, startDate) {
  const rangeDate = addHours(daysAgo(startDate, golfer.index), 9 + golfer.index);
  const roundDate = addHours(daysAgo(startDate, golfer.index + 2), 13);
  const wedgeDate = addHours(daysAgo(startDate, golfer.index + 4), 16);
  return [
    {
      id: uuidFor(`session:${golfer.slug}:range`),
      userId: golfer.userId,
      source: golfer.index % 3 === 0 ? "rapsodo_cloud" : "rapsodo",
      type: "range",
      date: rangeDate,
      courseId: null,
      teeSetId: null,
      location: "Tour performance bay",
      courseName: null,
      roundStatus: "complete",
      weatherJson: { conditions: "Indoor", wind: "None", temperature: "20 C", demoSeed: SEED_MARKER },
      equipmentNotes: "Rapsodo range session.",
      scorecardJson: null,
      notes: `Range session for ${golfer.name}. ${SEED_MARKER}`,
      rawUploadId: `tour-range-${golfer.slug}`,
      fileName: `${golfer.slug}-tour-range.csv`,
      fileSizeBytes: 24576 + golfer.index,
      rawCsvHash: hash64(`session:${golfer.slug}:range`),
      rawCsvText: `club,carry,total,side\ntour range rows for ${golfer.name}\n`,
      createdAt: rangeDate,
    },
    {
      id: uuidFor(`session:${golfer.slug}:round`),
      userId: golfer.userId,
      source: golfer.index % 2 === 0 ? "rapsodo_cloud" : "manual",
      type: golfer.index % 2 === 0 ? "simulated_course" : "real_round",
      date: roundDate,
      courseId,
      teeSetId,
      location: "ForeKingHell Tour Links",
      courseName: "ForeKingHell Tour Links",
      roundStatus: "complete",
      weatherJson: { conditions: "Bright", wind: `${8 + golfer.index} mph`, temperature: "17 C", demoSeed: SEED_MARKER },
      equipmentNotes: "Scorecard and course-shot rows.",
      scorecardJson: buildScorecard(golfer),
      notes: `Round session for ${golfer.name}. ${SEED_MARKER}`,
      rawUploadId: `tour-round-${golfer.slug}`,
      fileName: `${golfer.slug}-tour-round.csv`,
      fileSizeBytes: 32768 + golfer.index,
      rawCsvHash: hash64(`session:${golfer.slug}:round`),
      rawCsvText: `hole,club,carry,total\ntour round rows for ${golfer.name}\n`,
      createdAt: roundDate,
    },
    {
      id: uuidFor(`session:${golfer.slug}:wedge`),
      userId: golfer.userId,
      source: "rapsodo",
      type: "range",
      date: wedgeDate,
      courseId: null,
      teeSetId: null,
      location: "Tour short-game studio",
      courseName: null,
      roundStatus: "complete",
      weatherJson: { conditions: "Indoor", wind: "None", temperature: "20 C", demoSeed: SEED_MARKER },
      equipmentNotes: "Wedge ladder.",
      scorecardJson: null,
      notes: `Wedge-ladder session for ${golfer.name}. ${SEED_MARKER}`,
      rawUploadId: `tour-wedge-${golfer.slug}`,
      fileName: `${golfer.slug}-tour-wedge.csv`,
      fileSizeBytes: 18432 + golfer.index,
      rawCsvHash: hash64(`session:${golfer.slug}:wedge`),
      rawCsvText: `club,target,carry,total\ntour wedge ladder rows for ${golfer.name}\n`,
      createdAt: wedgeDate,
    },
  ];
}

function buildImportFile(session) {
  return {
    id: uuidFor(`import-file:${session.id}`),
    userId: session.userId,
    sessionId: session.id,
    source: session.source,
    fileName: session.fileName,
    fileSizeBytes: session.fileSizeBytes,
    rawCsvHash: session.rawCsvHash,
    parseVersion: "tour-profile-v1",
    status: "saved",
    duplicateOfFileId: null,
    reprocessedFromFileId: null,
    metadataJson: { demoSeed: SEED_MARKER, tourProfile: true },
    createdAt: session.createdAt,
    updatedAt: session.createdAt,
  };
}

function buildSyncSession(session) {
  return {
    id: uuidFor(`rapsodo-sync:${session.id}`),
    userId: session.userId,
    providerKind: session.type === "range" ? "range" : "simulation",
    providerSessionId: `tour-provider-${session.id}`,
    providerSessionType: session.type,
    providerSessionMode: session.type === "range" ? "range" : "courses",
    sessionDate: session.date,
    title: session.fileName,
    rawMetadataJson: { demoSeed: SEED_MARKER, tourProfile: true },
    exportRawCsvHash: session.rawCsvHash,
    importedSessionId: session.id,
    lastSeenAt: session.createdAt,
    lastImportedAt: session.createdAt,
    createdAt: session.createdAt,
    updatedAt: session.createdAt,
  };
}

function buildShots(golfer, session, clubs) {
  const clubByType = new Map(clubs.map((club) => [club.type, club]));

  if (session.type === "range" && session.fileName.includes("wedge")) {
    const wedgeTypes = ["pw", "sw", "lw"];
    return Array.from({ length: 24 }, (_, index) => {
      const club = clubByType.get(wedgeTypes[index % wedgeTypes.length]);
      const target = 50 + (index % 6) * 10;
      return buildShot({
        golfer,
        session,
        club,
        index,
        carry: target + wiggle(golfer.index, index, 3),
        category: "wedge",
        holeNumber: null,
      });
    });
  }

  if (session.type === "simulated_course" || session.type === "real_round") {
    return holes.flatMap((hole, holeIndex) => {
      const teeClub = hole.par === 3 ? clubByType.get("7i") : clubByType.get("driver");
      const approachClub = hole.par === 5 ? clubByType.get("5w") : hole.par === 3 ? clubByType.get("pw") : clubByType.get("9i");
      return [
        buildShot({
          golfer,
          session,
          club: teeClub,
          index: holeIndex * 2,
          carry: teeClub.expectedCarry + wiggle(golfer.index, holeIndex, 7),
          category: hole.par === 3 ? "approach" : "tee",
          holeNumber: hole.holeNumber,
          holeShotNumber: 1,
          hole,
        }),
        buildShot({
          golfer,
          session,
          club: approachClub,
          index: holeIndex * 2 + 1,
          carry: Math.min(approachClub.expectedCarry, Math.max(55, hole.yards - teeClub.expectedCarry - 20)) + wiggle(golfer.index, holeIndex + 12, 5),
          category: "approach",
          holeNumber: hole.holeNumber,
          holeShotNumber: 2,
          hole,
        }),
      ];
    });
  }

  return clubTypes.flatMap((clubType, clubIndex) => {
    const club = clubByType.get(clubType.type);
    return Array.from({ length: 5 }, (_, shotIndex) =>
      buildShot({
        golfer,
        session,
        club,
        index: clubIndex * 5 + shotIndex,
        carry: club.expectedCarry + wiggle(golfer.index + clubIndex, shotIndex, club.type === "driver" ? 9 : 5),
        category: club.type === "driver" || club.type === "5w" ? "full" : "stock",
        holeNumber: null,
      }),
    );
  });
}

function buildShot({ golfer, session, club, index, carry, category, holeNumber, holeShotNumber = null, hole = null }) {
  const total = carry + club.roll + wiggle(index, golfer.index, 2);
  const side = wiggle(golfer.index, index, club.type === "driver" ? 16 : 8);
  return {
    id: uuidFor(`shot:${session.id}:${index}`),
    userId: golfer.userId,
    sessionId: session.id,
    clubId: club.id,
    shotAt: addMinutes(session.date, index * 3),
    clubType: club.type,
    shotNumber: index + 1,
    carryYd: round1(carry),
    totalYd: round1(total),
    ballSpeedMph: round1(Math.max(65, carry * (club.type === "driver" ? 0.57 : 0.5))),
    clubSpeedMph: round1(Math.max(52, carry * (club.type === "driver" ? 0.37 : 0.33))),
    launchAngleDeg: round1(club.launch + wiggle(index, golfer.index, 1.8)),
    launchDirectionDeg: round1(side / 4),
    apexFt: round1(45 + carry * 0.24 + wiggle(index, golfer.index, 8)),
    sideCarryYd: round1(side),
    attackAngleDeg: round1(club.type === "driver" ? 2 + wiggle(golfer.index, index, 1.5) : -3 + wiggle(index, golfer.index, 1.2)),
    clubPathDeg: round1(wiggle(index, golfer.index, 3)),
    descentAngleDeg: round1(34 + (club.type === "driver" ? 3 : 10) + wiggle(index, golfer.index, 2)),
    smashFactor: round1(club.type === "driver" ? 1.48 + wiggle(index, golfer.index, 0.03) : 1.36 + wiggle(golfer.index, index, 0.04)),
    spinRate: Math.round(club.type === "driver" ? 2300 + wiggle(index, golfer.index, 250) : 5200 + wiggle(index, golfer.index, 700)),
    spinAxis: round1(wiggle(golfer.index, index, 8)),
    shotShape: side > 5 ? "fade" : side < -5 ? "draw" : "straight",
    shotCategory: category,
    courseHoleNumber: holeNumber,
    courseHoleShotNumber: holeShotNumber,
    courseHolePar: hole?.par ?? null,
    courseHoleYards: hole?.yards ?? null,
    distanceRemainingYd: hole ? Math.max(0, hole.yards - total) : null,
    qualityTag: Math.abs(side) < 12 ? "clean" : "playable",
    clubDataEstType: "tour_profile",
    sourceRawJson: {
      demoSeed: SEED_MARKER,
      tourProfile: "true",
      sessionId: session.id,
      shotNumber: String(index + 1),
    },
    createdAt: session.createdAt,
  };
}

function buildScorecard(golfer) {
  const scorecard = holes.map((hole) => ({
    holeNumber: hole.holeNumber,
    par: hole.par,
    yards: hole.yards,
    name: null,
    csvShotCount: hole.par === 3 ? 2 : 3,
    progressYd: hole.yards,
    distanceRemainingYd: 0,
    putts: hole.holeNumber % 5 === 0 ? 1 : 2,
    penalties: 0,
    score: hole.par,
    netScore: hole.par,
    fairwayHit: hole.par === 3 ? null : (hole.holeNumber + golfer.index) % 3 !== 0,
    gir: (hole.holeNumber + golfer.index) % 4 !== 0,
    strokeIndex: hole.strokeIndex,
    chipShots: (hole.holeNumber + golfer.index) % 6 === 0 ? 1 : 0,
    greensideSandShots: (hole.holeNumber + golfer.index) % 8 === 0 ? 1 : 0,
  }));
  let delta = golfer.roundScore - 72;
  const ordered = [...scorecard].sort((left, right) => left.strokeIndex - right.strokeIndex);

  for (const hole of ordered) {
    if (delta === 0) {
      break;
    }

    if (delta < 0 && hole.par > 3) {
      hole.score -= 1;
      hole.netScore -= 1;
      delta += 1;
    } else if (delta > 0) {
      hole.score += 1;
      hole.netScore += 1;
      delta -= 1;
    }
  }

  return scorecard.sort((left, right) => left.holeNumber - right.holeNumber);
}

function buildGolferFeedItems(golfer, sessionsForGolfer, createdAt) {
  const roundSession = sessionsForGolfer.find((session) => session.type !== "range");
  const driverTotal = Math.round(golfer.driverCarry + 22 + (golfer.index % 4));
  return [
    {
      id: uuidFor(`feed:${golfer.slug}:longest-drive`),
      userId: golfer.userId,
      itemType: "longest_drive",
      headline: `${golfer.name} set a tour longest-drive marker`,
      metricLabel: "Driver",
      metricValue: `${driverTotal} yd`,
      context: "Rapsodo driver total.",
      proofUrl: `/bag/${uuidFor(`club:${golfer.slug}:driver`)}`,
      sourceType: "shot",
      sourceId: uuidFor(`shot:${uuidFor(`session:${golfer.slug}:range`)}:0`),
      visibility: "public",
      verificationLabel: golfer.index % 3 === 0 ? "Rapsodo Cloud" : "Rapsodo CSV",
      dedupeKey: `demo-longest-drive:${golfer.slug}`,
      metadataJson: { demoSeed: SEED_MARKER, tourProfile: true, distanceType: "total" },
      createdAt: addHours(createdAt, golfer.index),
      updatedAt: addHours(createdAt, golfer.index),
    },
    {
      id: uuidFor(`feed:${golfer.slug}:new-pb`),
      userId: golfer.userId,
      itemType: "new_pb",
      headline: `${golfer.name} posted a new 7 iron tour PB`,
      metricLabel: "Carry",
      metricValue: `${Math.round(carryForClub(golfer, "7i") + 5)} yd`,
      context: "Previous best improved by 4 yd in a range block.",
      proofUrl: `/bag/${uuidFor(`club:${golfer.slug}:7i`)}`,
      sourceType: "shot",
      sourceId: uuidFor(`shot:${uuidFor(`session:${golfer.slug}:range`)}:18`),
      visibility: "public",
      verificationLabel: "Rapsodo CSV",
      dedupeKey: `demo-new-pb:${golfer.slug}:7i`,
      metadataJson: { demoSeed: SEED_MARKER, tourProfile: true, clubType: "7i" },
      createdAt: addHours(createdAt, golfer.index + 2),
      updatedAt: addHours(createdAt, golfer.index + 2),
    },
    {
      id: uuidFor(`feed:${golfer.slug}:round`),
      userId: golfer.userId,
      itemType: "round_completed",
      headline: `${golfer.name} completed a tour round`,
      metricLabel: "ForeKingHell Tour Links",
      metricValue: String(golfer.roundScore),
      context: "Scorecard posted with verified round details.",
      proofUrl: `/rounds/${roundSession.id}`,
      sourceType: "session",
      sourceId: roundSession.id,
      visibility: "public",
      verificationLabel: roundSession.source === "manual" ? "Manual" : "Verified import",
      dedupeKey: `demo-round:${golfer.slug}`,
      metadataJson: { demoSeed: SEED_MARKER, tourProfile: true },
      createdAt: addHours(createdAt, golfer.index + 4),
      updatedAt: addHours(createdAt, golfer.index + 4),
    },
    {
      id: uuidFor(`feed:${golfer.slug}:achievement`),
      userId: golfer.userId,
      itemType: "achievement_unlock",
      headline: `${golfer.name} unlocked "Course Champion"`,
      metricLabel: "Achievement",
      metricValue: "+250 XP",
      context: "Achievement unlocked from tour activity.",
      proofUrl: "/achievements",
      sourceType: "achievement",
      sourceId: "course_champion",
      visibility: "public",
      verificationLabel: "Verified import",
      dedupeKey: `demo-achievement:${golfer.slug}:course_champion`,
      metadataJson: { demoSeed: SEED_MARKER, tourProfile: true, tier: "gold" },
      createdAt: addHours(createdAt, golfer.index + 6),
      updatedAt: addHours(createdAt, golfer.index + 6),
    },
    {
      id: uuidFor(`feed:${golfer.slug}:level`),
      userId: golfer.userId,
      itemType: "level_up",
      headline: `${golfer.name} reached level ${Math.floor(golfer.xp / 1000) + 2}`,
      metricLabel: "XP",
      metricValue: String(golfer.xp),
      context: "XP totals from tour activity.",
      proofUrl: "/achievements",
      sourceType: "xp",
      sourceId: `demo-level-${golfer.slug}`,
      visibility: "public",
      verificationLabel: "Verified import",
      dedupeKey: `demo-level:${golfer.slug}`,
      metadataJson: { demoSeed: SEED_MARKER, tourProfile: true },
      createdAt: addHours(createdAt, golfer.index + 8),
      updatedAt: addHours(createdAt, golfer.index + 8),
    },
  ];
}

function buildUserAchievements(golfer, createdAt) {
  return [
    ["course_champion", 250],
    ["first_verified_record", 150],
    ["major_contender", 150],
    ["driver_total_250", 1000],
  ].map(([achievementId, xp], index) => ({
    id: uuidFor(`achievement:${golfer.slug}:${achievementId}`),
    userId: golfer.userId,
    achievementId,
    firstUnlockedAt: addHours(createdAt, index),
    lastUnlockedAt: addHours(createdAt, index),
    unlockCount: 1,
    sourceSessionId: uuidFor(`session:${golfer.slug}:round`),
    sourceShotId: achievementId === "driver_total_250" ? uuidFor(`shot:${uuidFor(`session:${golfer.slug}:range`)}:0`) : null,
    xpAwarded: xp,
    metadataJson: { demoSeed: SEED_MARKER, tourProfile: true },
    createdAt: addHours(createdAt, index),
    updatedAt: addHours(createdAt, index),
  }));
}

function buildXpLedger(golfer, createdAt) {
  const rows = [
    ["Tour range import", 100, "first_import"],
    ["Tour PB", 250, "driver_total_250"],
    ["Tour course record", 250, "course_champion"],
    ["Tour tournament entry", 150, "major_contender"],
    ["Tour network activity", golfer.xp - 750, null],
  ];
  return rows.map(([reason, amount, achievementId], index) => ({
    id: uuidFor(`xp:${golfer.slug}:${index}`),
    userId: golfer.userId,
    amount,
    reason,
    achievementId,
    sessionId: uuidFor(`session:${golfer.slug}:round`),
    shotId: achievementId === "driver_total_250" ? uuidFor(`shot:${uuidFor(`session:${golfer.slug}:range`)}:0`) : null,
    dedupeKey: `demo-xp:${golfer.slug}:${index}`,
    metadataJson: { demoSeed: SEED_MARKER, tourProfile: true },
    createdAt: addHours(createdAt, index),
  }));
}

function buildAchievementProgress(golfer, updatedAt) {
  return ["reliable_bag", "full_bag_mapped", "wedge_ladder_i"].map((achievementId, index) => ({
    id: uuidFor(`achievement-progress:${golfer.slug}:${achievementId}`),
    userId: golfer.userId,
    achievementId,
    progressValue: 6 + index,
    targetValue: 8,
    metadataJson: { demoSeed: SEED_MARKER, tourProfile: true },
    updatedAt,
  }));
}

function buildSocialGraphRows(viewerProfiles, createdAt) {
  const friendships = [];
  const friendRequests = [];
  const userBlocks = [];
  const userFollows = [];
  const foreKingHellProfile =
    viewerProfiles.find((viewer) => viewer.username === FOREKINGHELL_USERNAME) ??
    viewerProfiles.find((viewer) => viewer.displayName.toLowerCase() === "forekinghell");

  if (foreKingHellProfile) {
    for (const golfer of golfers) {
      const [userAId, userBId] = sortedUserPair(foreKingHellProfile.userId, golfer.userId);
      friendships.push({
        id: uuidFor(`friendship:${foreKingHellProfile.userId}:${golfer.userId}`),
        userAId,
        userBId,
        visibilityLevel: "friends",
        createdAt,
      });
      userFollows.push({
        id: uuidFor(`follow:${foreKingHellProfile.userId}:${golfer.userId}`),
        followerUserId: foreKingHellProfile.userId,
        followedUserId: golfer.userId,
        createdAt,
      });
    }
  }

  return { friendships, friendRequests, userBlocks, userFollows };
}

function buildGroup(createdAt) {
  return {
    id: groupId,
    ownerUserId: golfers[1].userId,
    slug: "tour-forekinghell-tour",
    name: "ForeKingHell Tour Players",
    description: "Public tour-player group for posts, members, challenges, records and event links.",
    groupType: "rapsodo_league",
    visibility: "public",
    avatarUrl: null,
    inviteCode: "FKH-TOUR",
    rules: `Tour-player group. Profiles include public player activity. ${SEED_MARKER}`,
    settingsJson: { demoSeed: SEED_MARKER, tourProfile: true },
    createdAt,
    updatedAt: createdAt,
  };
}

function buildGroupMemberships(viewerProfiles, createdAt) {
  return [
    ...golfers.map((golfer, index) => ({
      id: uuidFor(`group-member:${golfer.userId}`),
      groupId,
      userId: golfer.userId,
      role: index === 1 ? "admin" : "member",
      status: "active",
      joinedAt: addHours(createdAt, index),
      createdAt: addHours(createdAt, index),
      updatedAt: addHours(createdAt, index),
    })),
    ...viewerProfiles.map((viewer, index) => ({
      id: uuidFor(`group-member:${viewer.userId}`),
      groupId,
      userId: viewer.userId,
      role: "member",
      status: "active",
      joinedAt: addHours(createdAt, 24 + index),
      createdAt: addHours(createdAt, 24 + index),
      updatedAt: addHours(createdAt, 24 + index),
    })),
  ];
}

function buildGroupPosts(viewerProfiles, createdAt) {
  const posts = [
    {
      id: uuidFor("group-post:welcome"),
      groupId,
      userId: golfers[1].userId,
      title: "Welcome to the tour players board",
      body: "This group follows tour-player rounds, challenge boards and tournament standings.",
      pinned: true,
      metadataJson: { demoSeed: SEED_MARKER, tourProfile: true },
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
    },
    {
      id: uuidFor("group-post:challenge"),
      groupId,
      userId: golfers[4].userId,
      title: "7i consistency board is live",
      body: "Tour-player attempts are in. Check the carry spread and verification labels before the next event refresh.",
      pinned: false,
      metadataJson: { demoSeed: SEED_MARKER, tourProfile: true },
      createdAt: addHours(createdAt, 4),
      updatedAt: addHours(createdAt, 4),
      deletedAt: null,
    },
  ];

  for (const [index, viewer] of viewerProfiles.entries()) {
    posts.push({
      id: uuidFor(`group-post:viewer:${viewer.userId}`),
      groupId,
      userId: viewer.userId,
      title: "QA viewer joined",
      body: "Local viewer membership is active so group pages show member-scoped controls.",
      pinned: false,
      metadataJson: { demoSeed: SEED_MARKER, tourProfile: true },
      createdAt: addHours(createdAt, 8 + index),
      updatedAt: addHours(createdAt, 8 + index),
      deletedAt: null,
    });
  }

  return posts;
}

function buildChallenges(createdAt) {
  const definitions = [
    ["straightest-drive", "Tour Straightest Drive", golfers[0], "Keep the driver closest to the centre line.", "straightest-drive"],
    ["7i-consistency", "Tour 7i Carry Window", golfers[4], "Tightest 7 iron carry spread wins.", "7i-consistency"],
    ["wedge-ladder", "Tour Wedge Ladder", golfers[5], "Score the ladder from 50 to 100 yards.", "wedge-ladder"],
  ];
  return definitions.map(([slug, title, creator, description, templateSlug], index) => ({
    id: challengeIds[index],
    templateId: uuidFor(`challenge-template:${templateSlug}`),
    creatorUserId: creator.userId,
    title,
    description,
    visibility: "public",
    status: "open",
    challengeRulesJson: { demoSeed: SEED_MARKER, tourProfile: true },
    startsAt: addHours(createdAt, index),
    endsAt: daysAfter(createdAt, 21 + index),
    createdAt: addHours(createdAt, index),
    updatedAt: addHours(createdAt, index),
    slug,
  }));
}

function buildChallengeEntries(challenges, viewerProfiles, createdAt) {
  const rows = [];

  for (const challenge of challenges) {
    for (const golfer of golfers) {
      rows.push({
        id: uuidFor(`challenge-entry:${challenge.id}:${golfer.userId}`),
        challengeId: challenge.id,
        userId: golfer.userId,
        status: "completed",
        joinedAt: addHours(createdAt, golfer.index),
        completedAt: addHours(createdAt, golfer.index + 2),
        createdAt: addHours(createdAt, golfer.index),
        updatedAt: addHours(createdAt, golfer.index + 2),
      });
    }

    for (const [index, viewer] of viewerProfiles.entries()) {
      rows.push({
        id: uuidFor(`challenge-entry:${challenge.id}:${viewer.userId}`),
        challengeId: challenge.id,
        userId: viewer.userId,
        status: "joined",
        joinedAt: addHours(createdAt, 20 + index),
        completedAt: null,
        createdAt: addHours(createdAt, 20 + index),
        updatedAt: addHours(createdAt, 20 + index),
      });
    }
  }

  return rows;
}

function buildChallengeAttempts(challenges, createdAt) {
  const rows = [];

  for (const [challengeIndex, challenge] of challenges.entries()) {
    for (const golfer of golfers) {
      const score =
        challengeIndex === 0
          ? Math.max(1.2, 2.4 + golfer.index * 0.9 + wiggle(golfer.index, challengeIndex, 0.5))
          : challengeIndex === 1
            ? Math.max(2.8, 5.6 + golfer.index * 0.55 + wiggle(challengeIndex, golfer.index, 0.6))
            : Math.max(1.8, 4.2 + golfer.index * 0.4 + wiggle(golfer.index, 8, 0.8));
      rows.push({
        id: uuidFor(`challenge-attempt:${challenge.id}:${golfer.userId}`),
        challengeId: challenge.id,
        entryId: uuidFor(`challenge-entry:${challenge.id}:${golfer.userId}`),
        userId: golfer.userId,
        sourceType: golfer.index % 3 === 0 ? "launch_monitor" : "manual",
        sourceId: uuidFor(`session:${golfer.slug}:${challengeIndex === 2 ? "wedge" : "range"}`),
        metricValue: round1(score),
        metricLabel: challengeIndex === 0 ? "Offline miss" : challengeIndex === 1 ? "Carry spread" : "Average error",
        verificationLabel: golfer.index % 3 === 0 ? "Rapsodo Cloud" : golfer.index % 3 === 1 ? "Rapsodo CSV" : "Manual",
        notes: `Challenge attempt. ${SEED_MARKER}`,
        metadataJson: { demoSeed: SEED_MARKER, tourProfile: true },
        attemptedAt: addHours(createdAt, golfer.index + challengeIndex),
        createdAt: addHours(createdAt, golfer.index + challengeIndex),
      });
    }
  }

  return rows;
}

function rankChallengeResults(challenges, attempts, createdAt) {
  return challenges.flatMap((challenge) =>
    attempts
      .filter((attempt) => attempt.challengeId === challenge.id)
      .sort((left, right) => left.metricValue - right.metricValue)
      .map((attempt, index) => ({
        id: uuidFor(`challenge-result:${challenge.id}:${attempt.userId}`),
        challengeId: challenge.id,
        userId: attempt.userId,
        bestAttemptId: attempt.id,
        rank: index + 1,
        score: attempt.metricValue,
        scoreLabel:
          attempt.metricLabel === "Offline miss"
            ? `${attempt.metricValue.toFixed(1)} yd offline`
            : `${attempt.metricValue.toFixed(1)} yd ${attempt.metricLabel === "Carry spread" ? "spread" : "error"}`,
        status: "active",
        metadataJson: { demoSeed: SEED_MARKER, tourProfile: true, verificationLabel: attempt.verificationLabel },
        calculatedAt: addHours(createdAt, index),
        createdAt: addHours(createdAt, index),
        updatedAt: addHours(createdAt, index),
      })),
  );
}

function buildChallengeComments(challenges, viewerProfiles, createdAt) {
  const rows = [];

  for (const [index, challenge] of challenges.entries()) {
    rows.push({
      id: uuidFor(`challenge-comment:${challenge.id}:demo`),
      challengeId: challenge.id,
      userId: golfers[index + 2].userId,
      body: "Result posted with verification labels and leaderboard ranks.",
      createdAt: addHours(createdAt, index),
      updatedAt: addHours(createdAt, index),
      deletedAt: null,
    });

    for (const [viewerIndex, viewer] of viewerProfiles.entries()) {
      rows.push({
        id: uuidFor(`challenge-comment:${challenge.id}:viewer:${viewer.userId}`),
        challengeId: challenge.id,
        userId: viewer.userId,
        body: "Local viewer can see and comment on this public challenge.",
        createdAt: addHours(createdAt, 4 + viewerIndex),
        updatedAt: addHours(createdAt, 4 + viewerIndex),
        deletedAt: null,
      });
    }
  }

  return rows;
}

function buildCourseRecordData(createdAt) {
  const categories = [
    {
      id: uuidFor("course-record-category:best-gross-score"),
      slug: "tour-best-gross-score",
      name: "Best gross score",
      description: "Lowest verified gross score for this course and tee.",
      recordType: "best_gross_score",
      metricKind: "strokes",
      scoringDirection: "asc",
      scopeDefault: "public",
      verificationRequired: "silver",
      active: true,
      sortOrder: 10,
      metadataJson: { unit: "strokes", demoSeed: SEED_MARKER },
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: uuidFor("course-record-category:longest-drive"),
      slug: "tour-longest-drive",
      name: "Longest drive",
      description: "Longest verified drive on this course.",
      recordType: "longest_drive",
      metricKind: "yards",
      scoringDirection: "desc",
      scopeDefault: "public",
      verificationRequired: "gold",
      active: true,
      sortOrder: 90,
      metadataJson: { unit: "yd", demoSeed: SEED_MARKER },
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: uuidFor("course-record-category:seven-iron-consistency"),
      slug: "tour-seven-iron-consistency",
      name: "7-iron consistency",
      description: "Tightest verified 7-iron carry pattern.",
      recordType: "seven_iron_consistency",
      metricKind: "yards",
      scoringDirection: "asc",
      scopeDefault: "public",
      verificationRequired: "gold",
      active: true,
      sortOrder: 130,
      metadataJson: { unit: "yd spread", demoSeed: SEED_MARKER },
      createdAt,
      updatedAt: createdAt,
    },
  ];
  const records = categories.flatMap((category) =>
    ["public", "friends"].map((scope) => ({
      id: uuidFor(`course-record:${category.slug}:${scope}`),
      categoryId: category.id,
      courseId,
      teeSetId,
      groupId: scope === "friends" ? groupId : null,
      createdByUserId: golfers[0].userId,
      recordType: category.recordType,
      scope,
      period: "all_time",
      periodStart: null,
      periodEnd: null,
      verificationRequired: category.verificationRequired,
      status: "active",
      bestResultId: null,
      metadataJson: { demoSeed: SEED_MARKER, tourProfile: true },
      createdAt,
      updatedAt: createdAt,
    })),
  );
  const attempts = [];

  for (const record of records) {
    for (const golfer of golfers.slice(0, 6)) {
      const category = categories.find((item) => item.id === record.categoryId);
      const metricValue =
        category.recordType === "best_gross_score"
          ? golfer.roundScore
          : category.recordType === "longest_drive"
            ? golfer.driverCarry + 22 + wiggle(golfer.index, 2, 5)
            : 4 + golfer.index * 0.55 + wiggle(golfer.index, 3, 0.7);
      attempts.push({
        id: uuidFor(`course-record-attempt:${record.id}:${golfer.userId}`),
        recordId: record.id,
        categoryId: category.id,
        courseId,
        teeSetId,
        userId: golfer.userId,
        sessionId: uuidFor(`session:${golfer.slug}:${category.recordType === "longest_drive" ? "range" : "round"}`),
        roundId: uuidFor(`session:${golfer.slug}:round`),
        challengeId: null,
        score: category.recordType === "best_gross_score" ? golfer.roundScore : null,
        netScore: category.recordType === "best_gross_score" ? golfer.roundScore : null,
        stablefordPoints: category.recordType === "best_gross_score" ? 42 - (golfer.roundScore - 66) : null,
        metricValue: round1(metricValue),
        metricLabel: metricLabelForRecord(category),
        verificationStatus: "verified",
        verificationTier: category.verificationRequired === "gold" ? "gold" : "silver",
        sourceKind: "tour_profile",
        proofStatus: "verified",
        submittedAt: addHours(createdAt, golfer.index),
        metadataJson: { demoSeed: SEED_MARKER, tourProfile: true },
        createdAt: addHours(createdAt, golfer.index),
        updatedAt: addHours(createdAt, golfer.index),
        category,
      });
    }
  }

  const results = rankCourseRecordResults(records, attempts, categories, createdAt);
  const evidence = attempts.map((attempt) => ({
    id: uuidFor(`course-record-evidence:${attempt.id}`),
    attemptId: attempt.id,
    evidenceType: attempt.verificationTier === "gold" ? "rapsodo_import" : "csv_hash",
    storagePath: null,
    importSourceFileId: null,
    rapsodoSyncSessionId: null,
    csvHash: hash64(`course-record-evidence:${attempt.id}`),
    extractedScorecardTotal: attempt.score,
    metadataJson: { demoSeed: SEED_MARKER, tourProfile: true },
    reviewStatus: "approved",
    reviewedBy: null,
    reviewedAt: addHours(createdAt, 8),
    createdAt: addHours(createdAt, 8),
    updatedAt: addHours(createdAt, 8),
  }));

  return {
    categories,
    records: records.map((record) => ({
      ...record,
      bestResultId: results.find((result) => result.recordId === record.id && result.rank === 1)?.id ?? null,
    })),
    attempts,
    results,
    evidence,
  };
}

function rankCourseRecordResults(records, attempts, categories, createdAt) {
  return records.flatMap((record) => {
    const category = categories.find((item) => item.id === record.categoryId);
    const direction = category.scoringDirection;
    return attempts
      .filter((attempt) => attempt.recordId === record.id)
      .sort((left, right) =>
        direction === "desc" ? right.metricValue - left.metricValue : left.metricValue - right.metricValue,
      )
      .map((attempt, index) => ({
        id: uuidFor(`course-record-result:${record.id}:${attempt.userId}`),
        recordId: record.id,
        userId: attempt.userId,
        bestAttemptId: attempt.id,
        rank: index + 1,
        metricValue: attempt.metricValue,
        scoreLabel: scoreLabelForRecord(attempt.metricValue, category),
        verificationStatus: "verified",
        verificationTier: attempt.verificationTier,
        status: "active",
        tieBreakerJson: { demoSeed: SEED_MARKER, submittedAt: attempt.submittedAt.toISOString() },
        calculatedAt: addHours(createdAt, index),
        createdAt: addHours(createdAt, index),
        updatedAt: addHours(createdAt, index),
      }));
  });
}

function buildTournamentData(viewerProfiles, createdAt) {
  const tournament = {
    id: tournamentId,
    title: "Tour Players Spring Major",
    description: "Four-round tour-player event for local tournament, leaderboard, recent-score and feed testing.",
    courseId,
    teeSetId,
    format: "four_round_major",
    visibility: "public",
    status: "open",
    startsAt: createdAt,
    endsAt: daysAfter(createdAt, 14),
    roundCount: 4,
    verificationPolicy: "silver",
    screenshotRequired: true,
    directRapsodoRequired: false,
    cutRuleJson: { demoSeed: SEED_MARKER, enabled: false },
    playoffRuleJson: { demoSeed: SEED_MARKER, tieBreakers: ["net_total", "final_round", "earliest_submission"] },
    createdByUserId: golfers[2].userId,
    groupId,
    metadataJson: { demoSeed: SEED_MARKER, tourProfile: true },
    createdAt,
    updatedAt: createdAt,
  };
  const rounds = [1, 2, 3, 4].map((roundNumber) => ({
    id: uuidFor(`tournament-round:${roundNumber}`),
    tournamentId,
    roundNumber,
    title: `Tour Round ${roundNumber}`,
    startsAt: daysAfter(createdAt, roundNumber - 1),
    endsAt: daysAfter(createdAt, roundNumber + 3),
    status: roundNumber === 1 ? "open" : "scheduled",
    metadataJson: { demoSeed: SEED_MARKER, tourProfile: true },
    createdAt,
    updatedAt: createdAt,
  }));
  const entries = [
    ...golfers.map((golfer, index) => ({
      id: uuidFor(`tournament-entry:${golfer.userId}`),
      tournamentId,
      userId: golfer.userId,
      status: "entered",
      seed: index + 1,
      joinedAt: addHours(createdAt, index),
      withdrawnAt: null,
      metadataJson: { demoSeed: SEED_MARKER, tourProfile: true },
      createdAt: addHours(createdAt, index),
      updatedAt: addHours(createdAt, index),
    })),
    ...viewerProfiles.map((viewer, index) => ({
      id: uuidFor(`tournament-entry:${viewer.userId}`),
      tournamentId,
      userId: viewer.userId,
      status: "entered",
      seed: golfers.length + index + 1,
      joinedAt: addHours(createdAt, 20 + index),
      withdrawnAt: null,
      metadataJson: { demoSeed: SEED_MARKER, tourProfile: true },
      createdAt: addHours(createdAt, 20 + index),
      updatedAt: addHours(createdAt, 20 + index),
    })),
  ];
  const submissions = golfers.flatMap((golfer) =>
    [1, 2, 3, 4].map((roundNumber) => {
      const grossScore =
        golfer.recentTournamentScores[roundNumber - 1] ??
        golfer.roundScore + roundNumber - 1 + (golfer.index % 3);
      return {
        id: uuidFor(`tournament-submission:${golfer.userId}:${roundNumber}`),
        tournamentId,
        entryId: uuidFor(`tournament-entry:${golfer.userId}`),
        userId: golfer.userId,
        roundNumber,
        sessionId: uuidFor(`session:${golfer.slug}:round`),
        scorecardSessionId: uuidFor(`session:${golfer.slug}:round`),
        grossScore,
        netScore: grossScore,
        stablefordPoints: 42 - (grossScore - 68),
        rapsodoSyncSessionId: golfer.index % 2 === 0 ? uuidFor(`rapsodo-sync:${uuidFor(`session:${golfer.slug}:round`)}`) : null,
        importSourceFileId: null,
        scorecardScreenshotPath: `/tour-scorecards/${golfer.slug}-round-${roundNumber}.png`,
        extractedScorecardTotal: grossScore,
        verificationStatus: "verified",
        verificationTier: golfer.index % 2 === 0 ? "gold" : "silver",
        proofStatus: "verified",
        submittedAt: addHours(createdAt, golfer.index + roundNumber),
        reviewedAt: addHours(createdAt, golfer.index + roundNumber + 1),
        metadataJson: { demoSeed: SEED_MARKER, tourProfile: true, csvHash: hash64(`tournament:${golfer.slug}:${roundNumber}`) },
        createdAt: addHours(createdAt, golfer.index + roundNumber),
        updatedAt: addHours(createdAt, golfer.index + roundNumber + 1),
      };
    }),
  );
  const evidence = submissions.map((submission) => ({
    id: uuidFor(`tournament-evidence:${submission.id}`),
    submissionId: submission.id,
    evidenceType: submission.verificationTier === "gold" ? "rapsodo_import" : "scorecard_screenshot",
    storagePath: submission.scorecardScreenshotPath,
    importSourceFileId: null,
    rapsodoSyncSessionId: submission.rapsodoSyncSessionId,
    csvHash: submission.metadataJson.csvHash,
    extractedScorecardTotal: submission.extractedScorecardTotal,
    metadataJson: { demoSeed: SEED_MARKER, tourProfile: true },
    reviewStatus: "approved",
    reviewedBy: null,
    reviewedAt: submission.reviewedAt,
    createdAt: submission.createdAt,
    updatedAt: submission.updatedAt,
  }));
  const standings = rankTournamentStandings(entries, submissions, createdAt);
  const comments = [
    {
      id: uuidFor("tournament-comment:rory"),
      tournamentId,
      userId: golfers[1].userId,
      body: "Leaderboard is live with gross totals, verification tiers and event feed cards.",
      createdAt: addHours(createdAt, 7),
      updatedAt: addHours(createdAt, 7),
      deletedAt: null,
    },
    ...viewerProfiles.map((viewer, index) => ({
      id: uuidFor(`tournament-comment:viewer:${viewer.userId}`),
      tournamentId,
      userId: viewer.userId,
      body: "Local viewer entry keeps event pages in joined state.",
      createdAt: addHours(createdAt, 10 + index),
      updatedAt: addHours(createdAt, 10 + index),
      deletedAt: null,
    })),
  ];
  const invites = viewerProfiles.map((viewer, index) => ({
    id: uuidFor(`tournament-invite:${viewer.userId}`),
    tournamentId,
    inviterUserId: golfers[2].userId,
    inviteeUserId: viewer.userId,
    inviteeEmail: null,
    status: "pending",
    createdAt: addHours(createdAt, index),
    respondedAt: null,
  }));

  return { tournament, rounds, entries, submissions, evidence, standings, comments, invites };
}

function rankTournamentStandings(entries, submissions, createdAt) {
  const rows = entries
    .map((entry) => {
      const entrySubmissions = submissions.filter((submission) => submission.entryId === entry.id);
      return entrySubmissions.length > 0
        ? {
            entry,
            grossTotal: entrySubmissions.reduce((total, submission) => total + submission.grossScore, 0),
            netTotal: entrySubmissions.reduce((total, submission) => total + submission.netScore, 0),
            stablefordTotal: entrySubmissions.reduce((total, submission) => total + submission.stablefordPoints, 0),
            roundsCompleted: entrySubmissions.length,
            latestSubmissionAt: entrySubmissions.sort((left, right) => right.submittedAt - left.submittedAt)[0].submittedAt,
          }
        : null;
    })
    .filter(Boolean)
    .sort((left, right) => right.roundsCompleted - left.roundsCompleted || left.grossTotal - right.grossTotal);

  return rows.map((row, index) => ({
    id: uuidFor(`tournament-standing:${row.entry.id}`),
    tournamentId,
    entryId: row.entry.id,
    userId: row.entry.userId,
    grossTotal: row.grossTotal,
    netTotal: row.netTotal,
    stablefordTotal: row.stablefordTotal,
    roundsCompleted: row.roundsCompleted,
    rank: index + 1,
    tieBreakerJson: { demoSeed: SEED_MARKER, latestSubmissionAt: row.latestSubmissionAt.toISOString() },
    status: "active",
    calculatedAt: addHours(createdAt, index),
    createdAt: addHours(createdAt, index),
    updatedAt: addHours(createdAt, index),
  }));
}

function buildCompetitionFeedItems(challenges, challengeResults, recordData, tournamentData, createdAt) {
  const challengeLeaderItems = challenges.map((challenge, index) => {
    const leader = challengeResults.find((result) => result.challengeId === challenge.id && result.rank === 1);
    const golfer = golfers.find((item) => item.userId === leader.userId);
    return {
      id: uuidFor(`feed:challenge:${challenge.id}`),
      userId: leader.userId,
      itemType: "challenge_won",
      headline: `${golfer.name} leads ${challenge.title}`,
      metricLabel: "Challenge",
      metricValue: leader.scoreLabel,
      context: "Tour-player challenge result for leaderboards.",
      proofUrl: `/challenges/${challenge.id}`,
      sourceType: "challenge_result",
      sourceId: `${challenge.id}:${leader.userId}`,
      visibility: "public",
      verificationLabel: leader.metadataJson.verificationLabel ?? "Rapsodo CSV",
      dedupeKey: `demo-challenge-leader:${challenge.id}:${leader.userId}`,
      metadataJson: { demoSeed: SEED_MARKER, tourProfile: true },
      createdAt: addHours(createdAt, 20 + index),
      updatedAt: addHours(createdAt, 20 + index),
    };
  });
  const courseRecordItems = recordData.results
    .filter((result) => result.rank === 1)
    .slice(0, 4)
    .map((result, index) => {
      const record = recordData.records.find((item) => item.id === result.recordId);
      const category = recordData.categories.find((item) => item.id === record.categoryId);
      const golfer = golfers.find((item) => item.userId === result.userId);
      return {
        id: uuidFor(`feed:course-record:${result.id}`),
        userId: result.userId,
        itemType: "course_record_set",
        headline: `${golfer.name} became Course Champion at ForeKingHell Tour Links`,
        metricLabel: category.name,
        metricValue: result.scoreLabel,
        context: `${result.verificationTier === "gold" ? "Gold verified" : "Silver verified"} on the ${record.scope} board.`,
        proofUrl: `/course-records/${record.id}`,
        sourceType: "course_record",
        sourceId: record.id,
        visibility: "public",
        verificationLabel: result.verificationTier === "gold" ? "Gold verified" : "Silver verified",
        dedupeKey: `demo-course-record:${result.id}`,
        metadataJson: { demoSeed: SEED_MARKER, tourProfile: true },
        createdAt: addHours(createdAt, 24 + index),
        updatedAt: addHours(createdAt, 24 + index),
      };
    });
  const tournamentLeader = tournamentData.standings.find((standing) => standing.rank === 1);
  const tournamentGolfer = golfers.find((golfer) => golfer.userId === tournamentLeader.userId);
  const tournamentItem = {
    id: uuidFor("feed:tournament:leader"),
    userId: tournamentLeader.userId,
    itemType: "tournament_round_submitted",
    headline: `${tournamentGolfer.name} submitted round 4 for ${tournamentData.tournament.title}`,
    metricLabel: "Gross",
    metricValue: String(tournamentLeader.grossTotal),
    context: `Current standing #${tournamentLeader.rank}`,
    proofUrl: `/tournaments/${tournamentId}`,
    sourceType: "tournament_submission",
    sourceId: tournamentData.submissions.find((submission) => submission.userId === tournamentLeader.userId && submission.roundNumber === 4).id,
    visibility: "public",
    verificationLabel: "Gold verified",
    dedupeKey: "demo-tournament-leader",
    metadataJson: { demoSeed: SEED_MARKER, tourProfile: true },
    createdAt: addHours(createdAt, 30),
    updatedAt: addHours(createdAt, 30),
  };
  const groupItem = {
    id: uuidFor("feed:group:created"),
    userId: golfers[1].userId,
    itemType: "group_created",
    headline: `${golfers[1].name} created ForeKingHell Tour Players`,
    metricLabel: "Group",
    metricValue: "Rapsodo League",
    context: "Public tour-player group for local multi-user testing.",
    proofUrl: "/groups/tour-forekinghell-tour",
    sourceType: "group",
    sourceId: groupId,
    visibility: "public",
    verificationLabel: "Manual",
    dedupeKey: "demo-group-created",
    metadataJson: { demoSeed: SEED_MARKER, tourProfile: true },
    createdAt: addHours(createdAt, 31),
    updatedAt: addHours(createdAt, 31),
  };

  return [...challengeLeaderItems, ...courseRecordItems, tournamentItem, groupItem];
}

function buildFeedSocialRows(feedItems, viewerProfiles, createdAt) {
  const reactions = [];
  const comments = [];
  const commentReactions = [];
  const visibleFeedItems = feedItems.slice(0, 36);

  for (const [index, item] of visibleFeedItems.entries()) {
    const reactingGolfers = [golfers[(index + 1) % golfers.length], golfers[(index + 3) % golfers.length]];

    for (const golfer of reactingGolfers) {
      if (golfer.userId === item.userId) {
        continue;
      }

      reactions.push({
        id: uuidFor(`feed-reaction:${item.id}:${golfer.userId}`),
        feedItemId: item.id,
        userId: golfer.userId,
        reactionType: "kudos",
        createdAt: addMinutes(createdAt, index),
      });
    }

    for (const viewer of viewerProfiles.slice(0, 2)) {
      reactions.push({
        id: uuidFor(`feed-reaction:${item.id}:${viewer.userId}`),
        feedItemId: item.id,
        userId: viewer.userId,
        reactionType: "kudos",
        createdAt: addMinutes(createdAt, index + 2),
      });
    }

    if (index % 2 === 0) {
      const commenter = golfers[(index + 2) % golfers.length];
      const comment = {
        id: uuidFor(`feed-comment:${item.id}:${commenter.userId}`),
        feedItemId: item.id,
        userId: commenter.userId,
        body: "Tour-player comment: this card should show reactions, comments and verification labels.",
        createdAt: addMinutes(createdAt, index + 4),
        updatedAt: addMinutes(createdAt, index + 4),
        deletedAt: null,
      };
      comments.push(comment);
      commentReactions.push({
        id: uuidFor(`feed-comment-reaction:${comment.id}`),
        feedCommentId: comment.id,
        userId: golfers[(index + 4) % golfers.length].userId,
        reactionType: "like",
        createdAt: addMinutes(createdAt, index + 5),
      });
    }

    for (const viewer of viewerProfiles.slice(0, 1)) {
      if (index % 5 === 0) {
        const comment = {
          id: uuidFor(`feed-comment:${item.id}:viewer:${viewer.userId}`),
          feedItemId: item.id,
          userId: viewer.userId,
          body: "Local viewer comment for interaction testing.",
          createdAt: addMinutes(createdAt, index + 6),
          updatedAt: addMinutes(createdAt, index + 6),
          deletedAt: null,
        };
        comments.push(comment);
      }
    }
  }

  return { reactions, comments, commentReactions };
}

function buildSocialIntelligenceRows(viewerProfiles, feedItems, createdAt) {
  const summaries = [];
  const reports = [];
  const moderationEvents = [];
  const targetFeedItem = feedItems.find((item) => item.itemType === "tournament_round_submitted") ?? feedItems[0];

  for (const [index, viewer] of viewerProfiles.entries()) {
    summaries.push({
      id: uuidFor(`social-summary:${viewer.userId}:import`),
      userId: viewer.userId,
      summaryType: "import_recap",
      subjectType: "feed_item",
      subjectId: targetFeedItem.id,
      headline: `${viewer.displayName}'s tour network recap`,
      body: "Tour-player recap: your network has PBs, course records, tournament movement, comments and verification events ready to review.",
      evidenceJson: { demoSeed: SEED_MARKER, tourProfile: true, feedItemIds: feedItems.slice(0, 6).map((item) => item.id) },
      visibility: "private",
      model: "tour-profile-v1",
      createdAt: addMinutes(createdAt, index),
      updatedAt: addMinutes(createdAt, index),
    });
    summaries.push({
      id: uuidFor(`social-summary:${viewer.userId}:tournament`),
      userId: viewer.userId,
      summaryType: "tournament_recap",
      subjectType: "tournament",
      subjectId: tournamentId,
      headline: `${viewer.displayName}'s tour tournament recap`,
      body: "Tour-player recap: tournament standings include multiple submitted rounds, evidence rows and a visible event leader.",
      evidenceJson: { demoSeed: SEED_MARKER, tourProfile: true, tournamentId },
      visibility: "public",
      model: "tour-profile-v1",
      createdAt: addMinutes(createdAt, index + 3),
      updatedAt: addMinutes(createdAt, index + 3),
    });
    reports.push({
      id: uuidFor(`social-report:${viewer.userId}`),
      reporterUserId: viewer.userId,
      reportedUserId: golfers[9].userId,
      targetType: "feed_item",
      targetId: targetFeedItem.id,
      reason: "tour_score_review",
      details: `Social report for moderation queue review. ${SEED_MARKER}`,
      status: "open",
      createdAt: addMinutes(createdAt, index + 5),
      resolvedAt: null,
    });
    moderationEvents.push({
      id: uuidFor(`moderation:${viewer.userId}`),
      targetType: "tournament_submission",
      targetId: uuidFor(`tournament-submission:${golfers[9].userId}:2`),
      actorUserId: viewer.userId,
      eventType: "tournament_score_mismatch",
      severity: "medium",
      status: "open",
      reason: "Review event: screenshot and imported score need QA review.",
      metadataJson: {
        demoSeed: SEED_MARKER,
        tourProfile: true,
        tournament: "Tour Players Spring Major",
        imported: 68,
        screenshot: 69,
      },
      createdAt: addMinutes(createdAt, index + 8),
      resolvedAt: null,
    });
  }

  return { summaries, reports, moderationEvents };
}

async function seedUsers(tx, rows) {
  for (const row of rows) {
    await tx`
      insert into fkh_users (
        id, email, name, preferred_units, theme, table_density, dashboard_pins, privacy_settings_json,
        onboarding_completed_at, created_at, updated_at
      )
      values (
        ${row.id}, ${row.email}, ${row.name}, ${row.preferredUnits}, ${row.theme}, ${row.tableDensity},
        ${tx.json(row.dashboardPins)}, ${tx.json(row.privacySettingsJson)}, ${row.onboardingCompletedAt},
        ${row.createdAt}, ${row.updatedAt}
      )
      on conflict (id) do update set
        email = excluded.email,
        name = excluded.name,
        preferred_units = excluded.preferred_units,
        theme = excluded.theme,
        table_density = excluded.table_density,
        dashboard_pins = excluded.dashboard_pins,
        privacy_settings_json = excluded.privacy_settings_json,
        onboarding_completed_at = excluded.onboarding_completed_at,
        updated_at = excluded.updated_at
    `;
  }
}

async function seedProfiles(tx, rows) {
  for (const row of rows) {
    await tx`
      insert into fkh_user_profiles (
        user_id, username, display_name, avatar_url, header_image_url, bio, home_course, primary_launch_monitor, handicap_band,
        public_profile, friend_profile, feed_visibility_default, leaderboard_visibility, visibility_settings_json,
        achievement_showcase_json, pb_showcase_json, created_at, updated_at
      )
      values (
        ${row.userId}, ${row.username}, ${row.displayName}, ${row.avatarUrl}, ${row.headerImageUrl}, ${row.bio}, ${row.homeCourse},
        ${row.primaryLaunchMonitor}, ${row.handicapBand}, ${row.publicProfile}, ${row.friendProfile},
        ${row.feedVisibilityDefault}, ${row.leaderboardVisibility}, ${tx.json(row.visibilitySettingsJson)},
        ${tx.json(row.achievementShowcaseJson)}, ${tx.json(row.pbShowcaseJson)}, ${row.createdAt}, ${row.updatedAt}
      )
      on conflict (user_id) do update set
        username = excluded.username,
        display_name = excluded.display_name,
        avatar_url = excluded.avatar_url,
        header_image_url = excluded.header_image_url,
        bio = excluded.bio,
        home_course = excluded.home_course,
        primary_launch_monitor = excluded.primary_launch_monitor,
        handicap_band = excluded.handicap_band,
        public_profile = excluded.public_profile,
        friend_profile = excluded.friend_profile,
        feed_visibility_default = excluded.feed_visibility_default,
        leaderboard_visibility = excluded.leaderboard_visibility,
        visibility_settings_json = excluded.visibility_settings_json,
        achievement_showcase_json = excluded.achievement_showcase_json,
        pb_showcase_json = excluded.pb_showcase_json,
        updated_at = excluded.updated_at
    `;
  }
}

async function seedCourse(tx, course, teeSet, holeRows) {
  await tx`
    insert into fkh_courses (id, name, country, provider, external_id, visibility, created_by_user_id, created_at, updated_at)
    values (${course.id}, ${course.name}, ${course.country}, ${course.provider}, ${course.externalId}, ${course.visibility}, ${course.createdByUserId}, ${course.createdAt}, ${course.updatedAt})
    on conflict (id) do update set
      name = excluded.name,
      country = excluded.country,
      provider = excluded.provider,
      external_id = excluded.external_id,
      visibility = excluded.visibility,
      created_by_user_id = excluded.created_by_user_id,
      updated_at = excluded.updated_at
  `;
  await tx`
    insert into fkh_tee_sets (id, course_id, name, par, course_rating, slope_rating, yards, meters, created_at, updated_at)
    values (${teeSet.id}, ${teeSet.courseId}, ${teeSet.name}, ${teeSet.par}, ${teeSet.courseRating}, ${teeSet.slopeRating}, ${teeSet.yards}, ${teeSet.meters}, ${teeSet.createdAt}, ${teeSet.updatedAt})
    on conflict (id) do update set
      course_id = excluded.course_id,
      name = excluded.name,
      par = excluded.par,
      course_rating = excluded.course_rating,
      slope_rating = excluded.slope_rating,
      yards = excluded.yards,
      meters = excluded.meters,
      updated_at = excluded.updated_at
  `;

  for (const row of holeRows) {
    await tx`
      insert into fkh_holes (
        id, course_id, tee_set_id, hole_number, par, stroke_index, yards, tee_lat, tee_lng, green_lat, green_lng,
        centerline_geojson, created_at, updated_at
      )
      values (
        ${row.id}, ${row.courseId}, ${row.teeSetId}, ${row.holeNumber}, ${row.par}, ${row.strokeIndex}, ${row.yards},
        ${row.teeLat}, ${row.teeLng}, ${row.greenLat}, ${row.greenLng}, ${tx.json(row.centerlineGeojson)},
        ${row.createdAt}, ${row.updatedAt}
      )
      on conflict (id) do update set
        hole_number = excluded.hole_number,
        par = excluded.par,
        stroke_index = excluded.stroke_index,
        yards = excluded.yards,
        tee_lat = excluded.tee_lat,
        tee_lng = excluded.tee_lng,
        green_lat = excluded.green_lat,
        green_lng = excluded.green_lng,
        centerline_geojson = excluded.centerline_geojson,
        updated_at = excluded.updated_at
    `;
  }
}

async function seedChallengeTemplates(tx, rows) {
  for (const row of rows) {
    await tx`
      insert into fkh_challenge_templates (
        id, slug, name, description, challenge_type, rules_json, scoring_direction, active, created_at, updated_at
      )
      values (
        ${row.id}, ${row.slug}, ${row.name}, ${row.description}, ${row.challengeType}, ${tx.json(row.rulesJson)},
        ${row.scoringDirection}, ${row.active}, ${row.createdAt}, ${row.updatedAt}
      )
      on conflict (id) do update set
        slug = excluded.slug,
        name = excluded.name,
        description = excluded.description,
        challenge_type = excluded.challenge_type,
        rules_json = excluded.rules_json,
        scoring_direction = excluded.scoring_direction,
        active = excluded.active,
        updated_at = excluded.updated_at
    `;
  }
}

async function seedClubs(tx, rows) {
  for (const row of rows) {
    await tx`
      insert into fkh_clubs (id, user_id, type, brand, model, normalized_club_key, active, created_at, updated_at)
      values (${row.id}, ${row.userId}, ${row.type}, ${row.brand}, ${row.model}, ${row.normalizedClubKey}, ${row.active}, ${row.createdAt}, ${row.updatedAt})
      on conflict (id) do update set
        type = excluded.type,
        brand = excluded.brand,
        model = excluded.model,
        normalized_club_key = excluded.normalized_club_key,
        active = excluded.active,
        updated_at = excluded.updated_at
    `;
  }
}

async function seedBallModels(tx, rows) {
  for (const row of rows) {
    await tx`
      insert into fkh_ball_models (id, user_id, brand, model, active, created_at, updated_at)
      values (${row.id}, ${row.userId}, ${row.brand}, ${row.model}, ${row.active}, ${row.createdAt}, ${row.updatedAt})
      on conflict (id) do update set
        brand = excluded.brand,
        model = excluded.model,
        active = excluded.active,
        updated_at = excluded.updated_at
    `;
  }
}

async function seedEquipmentHistory(tx, rows) {
  for (const row of rows) {
    await tx`
      insert into fkh_club_equipment_history (
        id, user_id, club_id, ball_model_id, effective_from, effective_to, loft_deg, lie_deg, shaft, swing_weight, notes,
        created_at, updated_at
      )
      values (
        ${row.id}, ${row.userId}, ${row.clubId}, ${row.ballModelId}, ${row.effectiveFrom}, ${row.effectiveTo},
        ${row.loftDeg}, ${row.lieDeg}, ${row.shaft}, ${row.swingWeight}, ${row.notes}, ${row.createdAt}, ${row.updatedAt}
      )
      on conflict (id) do update set
        ball_model_id = excluded.ball_model_id,
        effective_from = excluded.effective_from,
        effective_to = excluded.effective_to,
        loft_deg = excluded.loft_deg,
        lie_deg = excluded.lie_deg,
        shaft = excluded.shaft,
        swing_weight = excluded.swing_weight,
        notes = excluded.notes,
        updated_at = excluded.updated_at
    `;
  }
}

async function seedSessions(tx, rows) {
  for (const row of rows) {
    await tx`
      insert into fkh_sessions (
        id, user_id, source, type, date, course_id, tee_set_id, location, course_name, round_status, weather_json,
        equipment_notes, scorecard_json, notes, raw_upload_id, file_name, file_size_bytes, raw_csv_hash, raw_csv_text, created_at
      )
      values (
        ${row.id}, ${row.userId}, ${row.source}, ${row.type}, ${row.date}, ${row.courseId}, ${row.teeSetId}, ${row.location},
        ${row.courseName}, ${row.roundStatus}, ${tx.json(row.weatherJson)}, ${row.equipmentNotes},
        ${row.scorecardJson ? tx.json(row.scorecardJson) : null}, ${row.notes}, ${row.rawUploadId}, ${row.fileName},
        ${row.fileSizeBytes}, ${row.rawCsvHash}, ${row.rawCsvText}, ${row.createdAt}
      )
      on conflict (id) do update set
        source = excluded.source,
        type = excluded.type,
        date = excluded.date,
        course_id = excluded.course_id,
        tee_set_id = excluded.tee_set_id,
        location = excluded.location,
        course_name = excluded.course_name,
        round_status = excluded.round_status,
        weather_json = excluded.weather_json,
        equipment_notes = excluded.equipment_notes,
        scorecard_json = excluded.scorecard_json,
        notes = excluded.notes,
        raw_upload_id = excluded.raw_upload_id,
        file_name = excluded.file_name,
        file_size_bytes = excluded.file_size_bytes,
        raw_csv_hash = excluded.raw_csv_hash,
        raw_csv_text = excluded.raw_csv_text
    `;
  }
}

async function seedImportFiles(tx, rows) {
  for (const row of rows) {
    await tx`
      insert into fkh_import_files (
        id, user_id, session_id, source, file_name, file_size_bytes, raw_csv_hash, parse_version, status, duplicate_of_file_id,
        reprocessed_from_file_id, metadata_json, created_at, updated_at
      )
      values (
        ${row.id}, ${row.userId}, ${row.sessionId}, ${row.source}, ${row.fileName}, ${row.fileSizeBytes}, ${row.rawCsvHash},
        ${row.parseVersion}, ${row.status}, ${row.duplicateOfFileId}, ${row.reprocessedFromFileId}, ${tx.json(row.metadataJson)},
        ${row.createdAt}, ${row.updatedAt}
      )
      on conflict (id) do update set
        session_id = excluded.session_id,
        source = excluded.source,
        file_name = excluded.file_name,
        file_size_bytes = excluded.file_size_bytes,
        raw_csv_hash = excluded.raw_csv_hash,
        parse_version = excluded.parse_version,
        status = excluded.status,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at
    `;
  }
}

async function seedSyncSessions(tx, rows) {
  for (const row of rows) {
    await tx`
      insert into fkh_rapsodo_sync_sessions (
        id, user_id, provider_kind, provider_session_id, provider_session_type, provider_session_mode, session_date, title,
        raw_metadata_json, export_raw_csv_hash, imported_session_id, last_seen_at, last_imported_at, created_at, updated_at
      )
      values (
        ${row.id}, ${row.userId}, ${row.providerKind}, ${row.providerSessionId}, ${row.providerSessionType},
        ${row.providerSessionMode}, ${row.sessionDate}, ${row.title}, ${tx.json(row.rawMetadataJson)}, ${row.exportRawCsvHash},
        ${row.importedSessionId}, ${row.lastSeenAt}, ${row.lastImportedAt}, ${row.createdAt}, ${row.updatedAt}
      )
      on conflict (id) do update set
        provider_kind = excluded.provider_kind,
        provider_session_id = excluded.provider_session_id,
        provider_session_type = excluded.provider_session_type,
        provider_session_mode = excluded.provider_session_mode,
        session_date = excluded.session_date,
        title = excluded.title,
        raw_metadata_json = excluded.raw_metadata_json,
        export_raw_csv_hash = excluded.export_raw_csv_hash,
        imported_session_id = excluded.imported_session_id,
        last_seen_at = excluded.last_seen_at,
        last_imported_at = excluded.last_imported_at,
        updated_at = excluded.updated_at
    `;
  }
}

async function seedShots(tx, rows) {
  for (const row of rows) {
    await tx`
      insert into fkh_shots (
        id, user_id, session_id, club_id, shot_at, club_type, shot_number, carry_yd, total_yd, ball_speed_mph,
        club_speed_mph, launch_angle_deg, launch_direction_deg, apex_ft, side_carry_yd, attack_angle_deg, club_path_deg,
        descent_angle_deg, smash_factor, spin_rate, spin_axis, shot_shape, shot_category, course_hole_number,
        course_hole_shot_number, course_hole_par, course_hole_yards, distance_remaining_yd, quality_tag, club_data_est_type,
        source_raw_json, created_at
      )
      values (
        ${row.id}, ${row.userId}, ${row.sessionId}, ${row.clubId}, ${row.shotAt}, ${row.clubType}, ${row.shotNumber},
        ${row.carryYd}, ${row.totalYd}, ${row.ballSpeedMph}, ${row.clubSpeedMph}, ${row.launchAngleDeg},
        ${row.launchDirectionDeg}, ${row.apexFt}, ${row.sideCarryYd}, ${row.attackAngleDeg}, ${row.clubPathDeg},
        ${row.descentAngleDeg}, ${row.smashFactor}, ${row.spinRate}, ${row.spinAxis}, ${row.shotShape}, ${row.shotCategory},
        ${row.courseHoleNumber}, ${row.courseHoleShotNumber}, ${row.courseHolePar}, ${row.courseHoleYards},
        ${row.distanceRemainingYd}, ${row.qualityTag}, ${row.clubDataEstType}, ${tx.json(row.sourceRawJson)}, ${row.createdAt}
      )
      on conflict (id) do update set
        shot_at = excluded.shot_at,
        club_type = excluded.club_type,
        shot_number = excluded.shot_number,
        carry_yd = excluded.carry_yd,
        total_yd = excluded.total_yd,
        ball_speed_mph = excluded.ball_speed_mph,
        club_speed_mph = excluded.club_speed_mph,
        launch_angle_deg = excluded.launch_angle_deg,
        launch_direction_deg = excluded.launch_direction_deg,
        apex_ft = excluded.apex_ft,
        side_carry_yd = excluded.side_carry_yd,
        attack_angle_deg = excluded.attack_angle_deg,
        club_path_deg = excluded.club_path_deg,
        descent_angle_deg = excluded.descent_angle_deg,
        smash_factor = excluded.smash_factor,
        spin_rate = excluded.spin_rate,
        spin_axis = excluded.spin_axis,
        shot_shape = excluded.shot_shape,
        shot_category = excluded.shot_category,
        course_hole_number = excluded.course_hole_number,
        course_hole_shot_number = excluded.course_hole_shot_number,
        course_hole_par = excluded.course_hole_par,
        course_hole_yards = excluded.course_hole_yards,
        distance_remaining_yd = excluded.distance_remaining_yd,
        quality_tag = excluded.quality_tag,
        club_data_est_type = excluded.club_data_est_type,
        source_raw_json = excluded.source_raw_json
    `;
  }
}

async function seedStockYardages(tx, rows) {
  for (const row of rows) {
    await tx`
      insert into fkh_stock_yardages (
        id, user_id, club_id, calculated_at, sample_size, carry_median_yd, carry_mean_yd, carry_p75_yd, carry_p25_yd,
        total_median_yd, dispersion_left_yd, dispersion_right_yd, confidence_score, recommended_play_number_yd, created_at
      )
      values (
        ${row.id}, ${row.userId}, ${row.clubId}, ${row.calculatedAt}, ${row.sampleSize}, ${row.carryMedianYd},
        ${row.carryMeanYd}, ${row.carryP75Yd}, ${row.carryP25Yd}, ${row.totalMedianYd}, ${row.dispersionLeftYd},
        ${row.dispersionRightYd}, ${row.confidenceScore}, ${row.recommendedPlayNumberYd}, ${row.createdAt}
      )
      on conflict (id) do update set
        calculated_at = excluded.calculated_at,
        sample_size = excluded.sample_size,
        carry_median_yd = excluded.carry_median_yd,
        carry_mean_yd = excluded.carry_mean_yd,
        carry_p75_yd = excluded.carry_p75_yd,
        carry_p25_yd = excluded.carry_p25_yd,
        total_median_yd = excluded.total_median_yd,
        dispersion_left_yd = excluded.dispersion_left_yd,
        dispersion_right_yd = excluded.dispersion_right_yd,
        confidence_score = excluded.confidence_score,
        recommended_play_number_yd = excluded.recommended_play_number_yd
    `;
  }
}

async function seedAchievements(tx, achievements, xpRows, progressRows) {
  for (const row of achievements) {
    await tx`
      insert into fkh_user_achievements (
        id, user_id, achievement_id, first_unlocked_at, last_unlocked_at, unlock_count, source_session_id, source_shot_id,
        xp_awarded, metadata_json, created_at, updated_at
      )
      values (
        ${row.id}, ${row.userId}, ${row.achievementId}, ${row.firstUnlockedAt}, ${row.lastUnlockedAt}, ${row.unlockCount},
        ${row.sourceSessionId}, ${row.sourceShotId}, ${row.xpAwarded}, ${tx.json(row.metadataJson)}, ${row.createdAt}, ${row.updatedAt}
      )
      on conflict (user_id, achievement_id) do update set
        last_unlocked_at = excluded.last_unlocked_at,
        unlock_count = excluded.unlock_count,
        source_session_id = excluded.source_session_id,
        source_shot_id = excluded.source_shot_id,
        xp_awarded = excluded.xp_awarded,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at
    `;
  }

  for (const row of xpRows) {
    await tx`
      insert into fkh_xp_ledger (
        id, user_id, amount, reason, achievement_id, session_id, shot_id, dedupe_key, metadata_json, created_at
      )
      values (
        ${row.id}, ${row.userId}, ${row.amount}, ${row.reason}, ${row.achievementId}, ${row.sessionId}, ${row.shotId},
        ${row.dedupeKey}, ${tx.json(row.metadataJson)}, ${row.createdAt}
      )
      on conflict (user_id, dedupe_key) do update set
        amount = excluded.amount,
        reason = excluded.reason,
        achievement_id = excluded.achievement_id,
        session_id = excluded.session_id,
        shot_id = excluded.shot_id,
        metadata_json = excluded.metadata_json
    `;
  }

  for (const row of progressRows) {
    await tx`
      insert into fkh_achievement_progress (
        id, user_id, achievement_id, progress_value, target_value, metadata_json, updated_at
      )
      values (
        ${row.id}, ${row.userId}, ${row.achievementId}, ${row.progressValue}, ${row.targetValue}, ${tx.json(row.metadataJson)}, ${row.updatedAt}
      )
      on conflict (user_id, achievement_id) do update set
        progress_value = excluded.progress_value,
        target_value = excluded.target_value,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at
    `;
  }
}

async function seedSocialGraph(tx, friendships, friendRequests, blocks, follows) {
  for (const row of friendships) {
    await tx`
      insert into fkh_friendships (id, user_a_id, user_b_id, visibility_level, created_at)
      values (${row.id}, ${row.userAId}, ${row.userBId}, ${row.visibilityLevel}, ${row.createdAt})
      on conflict (user_a_id, user_b_id) do update set visibility_level = excluded.visibility_level
    `;
  }

  for (const row of friendRequests) {
    await tx`
      insert into fkh_friend_requests (
        id, requester_user_id, recipient_user_id, status, message, created_at, responded_at, updated_at
      )
      values (
        ${row.id}, ${row.requesterUserId}, ${row.recipientUserId}, ${row.status}, ${row.message}, ${row.createdAt}, ${row.respondedAt}, ${row.updatedAt}
      )
      on conflict (id) do update set
        requester_user_id = excluded.requester_user_id,
        recipient_user_id = excluded.recipient_user_id,
        status = excluded.status,
        message = excluded.message,
        responded_at = excluded.responded_at,
        updated_at = excluded.updated_at
    `;
  }

  for (const row of blocks) {
    await tx`
      insert into fkh_user_blocks (id, blocker_user_id, blocked_user_id, reason, created_at)
      values (${row.id}, ${row.blockerUserId}, ${row.blockedUserId}, ${row.reason}, ${row.createdAt})
      on conflict (blocker_user_id, blocked_user_id) do update set reason = excluded.reason
    `;
  }

  for (const row of follows) {
    await tx`
      insert into fkh_user_follows (id, follower_user_id, followed_user_id, created_at)
      values (${row.id}, ${row.followerUserId}, ${row.followedUserId}, ${row.createdAt})
      on conflict (follower_user_id, followed_user_id) do nothing
    `;
  }
}

async function seedGroup(tx, group, memberships, posts) {
  await tx`
    insert into fkh_groups (
      id, owner_user_id, slug, name, description, group_type, visibility, avatar_url, invite_code, rules, settings_json,
      created_at, updated_at
    )
    values (
      ${group.id}, ${group.ownerUserId}, ${group.slug}, ${group.name}, ${group.description}, ${group.groupType}, ${group.visibility},
      ${group.avatarUrl}, ${group.inviteCode}, ${group.rules}, ${tx.json(group.settingsJson)}, ${group.createdAt}, ${group.updatedAt}
    )
    on conflict (id) do update set
      owner_user_id = excluded.owner_user_id,
      slug = excluded.slug,
      name = excluded.name,
      description = excluded.description,
      group_type = excluded.group_type,
      visibility = excluded.visibility,
      avatar_url = excluded.avatar_url,
      invite_code = excluded.invite_code,
      rules = excluded.rules,
      settings_json = excluded.settings_json,
      updated_at = excluded.updated_at
  `;

  for (const row of memberships) {
    await tx`
      insert into fkh_group_memberships (
        id, group_id, user_id, role, status, joined_at, created_at, updated_at
      )
      values (
        ${row.id}, ${row.groupId}, ${row.userId}, ${row.role}, ${row.status}, ${row.joinedAt}, ${row.createdAt}, ${row.updatedAt}
      )
      on conflict (group_id, user_id) do update set
        role = excluded.role,
        status = excluded.status,
        joined_at = excluded.joined_at,
        updated_at = excluded.updated_at
    `;
  }

  for (const row of posts) {
    await tx`
      insert into fkh_group_posts (
        id, group_id, user_id, title, body, pinned, metadata_json, created_at, updated_at, deleted_at
      )
      values (
        ${row.id}, ${row.groupId}, ${row.userId}, ${row.title}, ${row.body}, ${row.pinned}, ${tx.json(row.metadataJson)},
        ${row.createdAt}, ${row.updatedAt}, ${row.deletedAt}
      )
      on conflict (id) do update set
        title = excluded.title,
        body = excluded.body,
        pinned = excluded.pinned,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at
    `;
  }
}

async function seedChallenges(tx, challenges, entries, attempts, results, comments, groupLinks) {
  for (const row of challenges) {
    await tx`
      insert into fkh_challenges (
        id, template_id, creator_user_id, title, description, visibility, status, challenge_rules_json, starts_at, ends_at,
        created_at, updated_at
      )
      values (
        ${row.id}, ${row.templateId}, ${row.creatorUserId}, ${row.title}, ${row.description}, ${row.visibility}, ${row.status},
        ${tx.json(row.challengeRulesJson)}, ${row.startsAt}, ${row.endsAt}, ${row.createdAt}, ${row.updatedAt}
      )
      on conflict (id) do update set
        template_id = excluded.template_id,
        creator_user_id = excluded.creator_user_id,
        title = excluded.title,
        description = excluded.description,
        visibility = excluded.visibility,
        status = excluded.status,
        challenge_rules_json = excluded.challenge_rules_json,
        starts_at = excluded.starts_at,
        ends_at = excluded.ends_at,
        updated_at = excluded.updated_at
    `;
  }

  for (const row of entries) {
    await tx`
      insert into fkh_challenge_entries (
        id, challenge_id, user_id, status, joined_at, completed_at, created_at, updated_at
      )
      values (
        ${row.id}, ${row.challengeId}, ${row.userId}, ${row.status}, ${row.joinedAt}, ${row.completedAt}, ${row.createdAt}, ${row.updatedAt}
      )
      on conflict (challenge_id, user_id) do update set
        status = excluded.status,
        joined_at = excluded.joined_at,
        completed_at = excluded.completed_at,
        updated_at = excluded.updated_at
    `;
  }

  for (const row of attempts) {
    await tx`
      insert into fkh_challenge_attempts (
        id, challenge_id, entry_id, user_id, source_type, source_id, metric_value, metric_label, verification_label,
        notes, metadata_json, attempted_at, created_at
      )
      values (
        ${row.id}, ${row.challengeId}, ${row.entryId}, ${row.userId}, ${row.sourceType}, ${row.sourceId}, ${row.metricValue},
        ${row.metricLabel}, ${row.verificationLabel}, ${row.notes}, ${tx.json(row.metadataJson)}, ${row.attemptedAt}, ${row.createdAt}
      )
      on conflict (id) do update set
        source_type = excluded.source_type,
        source_id = excluded.source_id,
        metric_value = excluded.metric_value,
        metric_label = excluded.metric_label,
        verification_label = excluded.verification_label,
        notes = excluded.notes,
        metadata_json = excluded.metadata_json,
        attempted_at = excluded.attempted_at
    `;
  }

  for (const row of results) {
    await tx`
      insert into fkh_challenge_results (
        id, challenge_id, user_id, best_attempt_id, rank, score, score_label, status, metadata_json, calculated_at, created_at, updated_at
      )
      values (
        ${row.id}, ${row.challengeId}, ${row.userId}, ${row.bestAttemptId}, ${row.rank}, ${row.score}, ${row.scoreLabel},
        ${row.status}, ${tx.json(row.metadataJson)}, ${row.calculatedAt}, ${row.createdAt}, ${row.updatedAt}
      )
      on conflict (challenge_id, user_id) do update set
        best_attempt_id = excluded.best_attempt_id,
        rank = excluded.rank,
        score = excluded.score,
        score_label = excluded.score_label,
        status = excluded.status,
        metadata_json = excluded.metadata_json,
        calculated_at = excluded.calculated_at,
        updated_at = excluded.updated_at
    `;
  }

  for (const row of comments) {
    await tx`
      insert into fkh_challenge_comments (
        id, challenge_id, user_id, body, created_at, updated_at, deleted_at
      )
      values (${row.id}, ${row.challengeId}, ${row.userId}, ${row.body}, ${row.createdAt}, ${row.updatedAt}, ${row.deletedAt})
      on conflict (id) do update set
        body = excluded.body,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at
    `;
  }

  for (const row of groupLinks) {
    await tx`
      insert into fkh_group_challenge_links (id, group_id, challenge_id, created_by_user_id, created_at)
      values (${row.id}, ${row.groupId}, ${row.challengeId}, ${row.createdByUserId}, ${row.createdAt})
      on conflict (group_id, challenge_id) do update set created_by_user_id = excluded.created_by_user_id
    `;
  }
}

async function seedCourseRecords(tx, categories, records, attempts, results, evidence) {
  for (const row of categories) {
    await tx`
      insert into fkh_course_record_categories (
        id, slug, name, description, record_type, metric_kind, scoring_direction, scope_default, verification_required,
        active, sort_order, metadata_json, created_at, updated_at
      )
      values (
        ${row.id}, ${row.slug}, ${row.name}, ${row.description}, ${row.recordType}, ${row.metricKind}, ${row.scoringDirection},
        ${row.scopeDefault}, ${row.verificationRequired}, ${row.active}, ${row.sortOrder}, ${tx.json(row.metadataJson)},
        ${row.createdAt}, ${row.updatedAt}
      )
      on conflict (id) do update set
        slug = excluded.slug,
        name = excluded.name,
        description = excluded.description,
        record_type = excluded.record_type,
        metric_kind = excluded.metric_kind,
        scoring_direction = excluded.scoring_direction,
        scope_default = excluded.scope_default,
        verification_required = excluded.verification_required,
        active = excluded.active,
        sort_order = excluded.sort_order,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at
    `;
  }

  for (const row of records) {
    await tx`
      insert into fkh_course_records (
        id, category_id, course_id, tee_set_id, group_id, created_by_user_id, record_type, scope, period, period_start, period_end,
        verification_required, status, best_result_id, metadata_json, created_at, updated_at
      )
      values (
        ${row.id}, ${row.categoryId}, ${row.courseId}, ${row.teeSetId}, ${row.groupId}, ${row.createdByUserId}, ${row.recordType},
        ${row.scope}, ${row.period}, ${row.periodStart}, ${row.periodEnd}, ${row.verificationRequired}, ${row.status}, ${row.bestResultId},
        ${tx.json(row.metadataJson)}, ${row.createdAt}, ${row.updatedAt}
      )
      on conflict (id) do update set
        category_id = excluded.category_id,
        course_id = excluded.course_id,
        tee_set_id = excluded.tee_set_id,
        group_id = excluded.group_id,
        created_by_user_id = excluded.created_by_user_id,
        record_type = excluded.record_type,
        scope = excluded.scope,
        period = excluded.period,
        period_start = excluded.period_start,
        period_end = excluded.period_end,
        verification_required = excluded.verification_required,
        status = excluded.status,
        best_result_id = excluded.best_result_id,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at
    `;
  }

  for (const row of attempts) {
    await tx`
      insert into fkh_course_record_attempts (
        id, record_id, category_id, course_id, tee_set_id, user_id, session_id, round_id, challenge_id, score, net_score,
        stableford_points, metric_value, metric_label, verification_status, verification_tier, source_kind, proof_status,
        submitted_at, metadata_json, created_at, updated_at
      )
      values (
        ${row.id}, ${row.recordId}, ${row.categoryId}, ${row.courseId}, ${row.teeSetId}, ${row.userId}, ${row.sessionId},
        ${row.roundId}, ${row.challengeId}, ${row.score}, ${row.netScore}, ${row.stablefordPoints}, ${row.metricValue}, ${row.metricLabel},
        ${row.verificationStatus}, ${row.verificationTier}, ${row.sourceKind}, ${row.proofStatus}, ${row.submittedAt},
        ${tx.json(row.metadataJson)}, ${row.createdAt}, ${row.updatedAt}
      )
      on conflict (id) do update set
        metric_value = excluded.metric_value,
        metric_label = excluded.metric_label,
        verification_status = excluded.verification_status,
        verification_tier = excluded.verification_tier,
        source_kind = excluded.source_kind,
        proof_status = excluded.proof_status,
        submitted_at = excluded.submitted_at,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at
    `;
  }

  for (const row of results) {
    await tx`
      insert into fkh_course_record_results (
        id, record_id, user_id, best_attempt_id, rank, metric_value, score_label, verification_status, verification_tier,
        status, tie_breaker_json, calculated_at, created_at, updated_at
      )
      values (
        ${row.id}, ${row.recordId}, ${row.userId}, ${row.bestAttemptId}, ${row.rank}, ${row.metricValue}, ${row.scoreLabel},
        ${row.verificationStatus}, ${row.verificationTier}, ${row.status}, ${tx.json(row.tieBreakerJson)}, ${row.calculatedAt},
        ${row.createdAt}, ${row.updatedAt}
      )
      on conflict (record_id, user_id) do update set
        best_attempt_id = excluded.best_attempt_id,
        rank = excluded.rank,
        metric_value = excluded.metric_value,
        score_label = excluded.score_label,
        verification_status = excluded.verification_status,
        verification_tier = excluded.verification_tier,
        status = excluded.status,
        tie_breaker_json = excluded.tie_breaker_json,
        calculated_at = excluded.calculated_at,
        updated_at = excluded.updated_at
    `;
  }

  for (const row of evidence) {
    await tx`
      insert into fkh_course_record_evidence (
        id, attempt_id, evidence_type, storage_path, import_source_file_id, rapsodo_sync_session_id, csv_hash,
        extracted_scorecard_total, metadata_json, review_status, reviewed_by, reviewed_at, created_at, updated_at
      )
      values (
        ${row.id}, ${row.attemptId}, ${row.evidenceType}, ${row.storagePath}, ${row.importSourceFileId}, ${row.rapsodoSyncSessionId},
        ${row.csvHash}, ${row.extractedScorecardTotal}, ${tx.json(row.metadataJson)}, ${row.reviewStatus}, ${row.reviewedBy},
        ${row.reviewedAt}, ${row.createdAt}, ${row.updatedAt}
      )
      on conflict (id) do update set
        evidence_type = excluded.evidence_type,
        storage_path = excluded.storage_path,
        import_source_file_id = excluded.import_source_file_id,
        rapsodo_sync_session_id = excluded.rapsodo_sync_session_id,
        csv_hash = excluded.csv_hash,
        extracted_scorecard_total = excluded.extracted_scorecard_total,
        metadata_json = excluded.metadata_json,
        review_status = excluded.review_status,
        reviewed_by = excluded.reviewed_by,
        reviewed_at = excluded.reviewed_at,
        updated_at = excluded.updated_at
    `;
  }
}

async function seedTournament(tx, plan) {
  const tournament = plan.tournament;
  await tx`
    insert into fkh_tournaments (
      id, title, description, course_id, tee_set_id, format, visibility, status, starts_at, ends_at, round_count,
      verification_policy, screenshot_required, direct_rapsodo_required, cut_rule_json, playoff_rule_json, created_by_user_id,
      group_id, metadata_json, created_at, updated_at
    )
    values (
      ${tournament.id}, ${tournament.title}, ${tournament.description}, ${tournament.courseId}, ${tournament.teeSetId},
      ${tournament.format}, ${tournament.visibility}, ${tournament.status}, ${tournament.startsAt}, ${tournament.endsAt},
      ${tournament.roundCount}, ${tournament.verificationPolicy}, ${tournament.screenshotRequired}, ${tournament.directRapsodoRequired},
      ${tx.json(tournament.cutRuleJson)}, ${tx.json(tournament.playoffRuleJson)}, ${tournament.createdByUserId}, ${tournament.groupId},
      ${tx.json(tournament.metadataJson)}, ${tournament.createdAt}, ${tournament.updatedAt}
    )
    on conflict (id) do update set
      title = excluded.title,
      description = excluded.description,
      course_id = excluded.course_id,
      tee_set_id = excluded.tee_set_id,
      format = excluded.format,
      visibility = excluded.visibility,
      status = excluded.status,
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at,
      round_count = excluded.round_count,
      verification_policy = excluded.verification_policy,
      screenshot_required = excluded.screenshot_required,
      direct_rapsodo_required = excluded.direct_rapsodo_required,
      cut_rule_json = excluded.cut_rule_json,
      playoff_rule_json = excluded.playoff_rule_json,
      created_by_user_id = excluded.created_by_user_id,
      group_id = excluded.group_id,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at
  `;

  for (const row of plan.tournamentRounds) {
    await tx`
      insert into fkh_tournament_rounds (
        id, tournament_id, round_number, title, starts_at, ends_at, status, metadata_json, created_at, updated_at
      )
      values (
        ${row.id}, ${row.tournamentId}, ${row.roundNumber}, ${row.title}, ${row.startsAt}, ${row.endsAt}, ${row.status},
        ${tx.json(row.metadataJson)}, ${row.createdAt}, ${row.updatedAt}
      )
      on conflict (tournament_id, round_number) do update set
        title = excluded.title,
        starts_at = excluded.starts_at,
        ends_at = excluded.ends_at,
        status = excluded.status,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at
    `;
  }

  for (const row of plan.tournamentEntries) {
    await tx`
      insert into fkh_tournament_entries (
        id, tournament_id, user_id, status, seed, joined_at, withdrawn_at, metadata_json, created_at, updated_at
      )
      values (
        ${row.id}, ${row.tournamentId}, ${row.userId}, ${row.status}, ${row.seed}, ${row.joinedAt}, ${row.withdrawnAt},
        ${tx.json(row.metadataJson)}, ${row.createdAt}, ${row.updatedAt}
      )
      on conflict (tournament_id, user_id) do update set
        status = excluded.status,
        seed = excluded.seed,
        joined_at = excluded.joined_at,
        withdrawn_at = excluded.withdrawn_at,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at
    `;
  }

  for (const row of plan.tournamentSubmissions) {
    await tx`
      insert into fkh_tournament_submissions (
        id, tournament_id, entry_id, user_id, round_number, session_id, scorecard_session_id, gross_score, net_score,
        stableford_points, rapsodo_sync_session_id, import_source_file_id, scorecard_screenshot_path, extracted_scorecard_total,
        verification_status, verification_tier, proof_status, submitted_at, reviewed_at, metadata_json, created_at, updated_at
      )
      values (
        ${row.id}, ${row.tournamentId}, ${row.entryId}, ${row.userId}, ${row.roundNumber}, ${row.sessionId}, ${row.scorecardSessionId},
        ${row.grossScore}, ${row.netScore}, ${row.stablefordPoints}, ${row.rapsodoSyncSessionId}, ${row.importSourceFileId},
        ${row.scorecardScreenshotPath}, ${row.extractedScorecardTotal}, ${row.verificationStatus}, ${row.verificationTier},
        ${row.proofStatus}, ${row.submittedAt}, ${row.reviewedAt}, ${tx.json(row.metadataJson)}, ${row.createdAt}, ${row.updatedAt}
      )
      on conflict (entry_id, round_number) do update set
        session_id = excluded.session_id,
        scorecard_session_id = excluded.scorecard_session_id,
        gross_score = excluded.gross_score,
        net_score = excluded.net_score,
        stableford_points = excluded.stableford_points,
        rapsodo_sync_session_id = excluded.rapsodo_sync_session_id,
        import_source_file_id = excluded.import_source_file_id,
        scorecard_screenshot_path = excluded.scorecard_screenshot_path,
        extracted_scorecard_total = excluded.extracted_scorecard_total,
        verification_status = excluded.verification_status,
        verification_tier = excluded.verification_tier,
        proof_status = excluded.proof_status,
        submitted_at = excluded.submitted_at,
        reviewed_at = excluded.reviewed_at,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at
    `;
  }

  for (const row of plan.tournamentEvidence) {
    await tx`
      insert into fkh_tournament_evidence (
        id, submission_id, evidence_type, storage_path, import_source_file_id, rapsodo_sync_session_id, csv_hash,
        extracted_scorecard_total, metadata_json, review_status, reviewed_by, reviewed_at, created_at, updated_at
      )
      values (
        ${row.id}, ${row.submissionId}, ${row.evidenceType}, ${row.storagePath}, ${row.importSourceFileId}, ${row.rapsodoSyncSessionId},
        ${row.csvHash}, ${row.extractedScorecardTotal}, ${tx.json(row.metadataJson)}, ${row.reviewStatus}, ${row.reviewedBy},
        ${row.reviewedAt}, ${row.createdAt}, ${row.updatedAt}
      )
      on conflict (id) do update set
        evidence_type = excluded.evidence_type,
        storage_path = excluded.storage_path,
        import_source_file_id = excluded.import_source_file_id,
        rapsodo_sync_session_id = excluded.rapsodo_sync_session_id,
        csv_hash = excluded.csv_hash,
        extracted_scorecard_total = excluded.extracted_scorecard_total,
        metadata_json = excluded.metadata_json,
        review_status = excluded.review_status,
        reviewed_by = excluded.reviewed_by,
        reviewed_at = excluded.reviewed_at,
        updated_at = excluded.updated_at
    `;
  }

  for (const row of plan.tournamentStandings) {
    await tx`
      insert into fkh_tournament_standings (
        id, tournament_id, entry_id, user_id, gross_total, net_total, stableford_total, rounds_completed, rank,
        tie_breaker_json, status, calculated_at, created_at, updated_at
      )
      values (
        ${row.id}, ${row.tournamentId}, ${row.entryId}, ${row.userId}, ${row.grossTotal}, ${row.netTotal}, ${row.stablefordTotal},
        ${row.roundsCompleted}, ${row.rank}, ${tx.json(row.tieBreakerJson)}, ${row.status}, ${row.calculatedAt}, ${row.createdAt},
        ${row.updatedAt}
      )
      on conflict (entry_id) do update set
        gross_total = excluded.gross_total,
        net_total = excluded.net_total,
        stableford_total = excluded.stableford_total,
        rounds_completed = excluded.rounds_completed,
        rank = excluded.rank,
        tie_breaker_json = excluded.tie_breaker_json,
        status = excluded.status,
        calculated_at = excluded.calculated_at,
        updated_at = excluded.updated_at
    `;
  }

  for (const row of plan.tournamentComments) {
    await tx`
      insert into fkh_tournament_comments (
        id, tournament_id, user_id, body, created_at, updated_at, deleted_at
      )
      values (${row.id}, ${row.tournamentId}, ${row.userId}, ${row.body}, ${row.createdAt}, ${row.updatedAt}, ${row.deletedAt})
      on conflict (id) do update set
        body = excluded.body,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at
    `;
  }

  for (const row of plan.tournamentInvites) {
    await tx`
      insert into fkh_tournament_invites (
        id, tournament_id, inviter_user_id, invitee_user_id, invitee_email, status, created_at, responded_at
      )
      values (
        ${row.id}, ${row.tournamentId}, ${row.inviterUserId}, ${row.inviteeUserId}, ${row.inviteeEmail}, ${row.status},
        ${row.createdAt}, ${row.respondedAt}
      )
      on conflict (id) do update set
        status = excluded.status,
        responded_at = excluded.responded_at
    `;
  }
}

async function seedFeed(tx, items, reactions, comments, commentReactions) {
  for (const row of items) {
    await tx`
      insert into fkh_feed_items (
        id, user_id, item_type, headline, metric_label, metric_value, context, proof_url, source_type, source_id,
        visibility, verification_label, dedupe_key, metadata_json, created_at, updated_at
      )
      values (
        ${row.id}, ${row.userId}, ${row.itemType}, ${row.headline}, ${row.metricLabel}, ${row.metricValue}, ${row.context},
        ${row.proofUrl}, ${row.sourceType}, ${row.sourceId}, ${row.visibility}, ${row.verificationLabel}, ${row.dedupeKey},
        ${tx.json(row.metadataJson)}, ${row.createdAt}, ${row.updatedAt}
      )
      on conflict (id) do update set
        item_type = excluded.item_type,
        headline = excluded.headline,
        metric_label = excluded.metric_label,
        metric_value = excluded.metric_value,
        context = excluded.context,
        proof_url = excluded.proof_url,
        source_type = excluded.source_type,
        source_id = excluded.source_id,
        visibility = excluded.visibility,
        verification_label = excluded.verification_label,
        dedupe_key = excluded.dedupe_key,
        metadata_json = excluded.metadata_json,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at
    `;
  }

  for (const row of reactions) {
    await tx`
      insert into fkh_feed_reactions (id, feed_item_id, user_id, reaction_type, created_at)
      values (${row.id}, ${row.feedItemId}, ${row.userId}, ${row.reactionType}, ${row.createdAt})
      on conflict (feed_item_id, user_id, reaction_type) do nothing
    `;
  }

  for (const row of comments) {
    await tx`
      insert into fkh_feed_comments (id, feed_item_id, user_id, body, created_at, updated_at, deleted_at)
      values (${row.id}, ${row.feedItemId}, ${row.userId}, ${row.body}, ${row.createdAt}, ${row.updatedAt}, ${row.deletedAt})
      on conflict (id) do update set
        body = excluded.body,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at
    `;
  }

  for (const row of commentReactions) {
    await tx`
      insert into fkh_feed_comment_reactions (id, feed_comment_id, user_id, reaction_type, created_at)
      values (${row.id}, ${row.feedCommentId}, ${row.userId}, ${row.reactionType}, ${row.createdAt})
      on conflict (feed_comment_id, user_id, reaction_type) do nothing
    `;
  }
}

async function seedSocialIntelligence(tx, summaries, reports, moderationEvents) {
  for (const row of summaries) {
    await tx`
      insert into fkh_ai_social_summaries (
        id, user_id, summary_type, subject_type, subject_id, headline, body, evidence_json, visibility, model, created_at, updated_at
      )
      values (
        ${row.id}, ${row.userId}, ${row.summaryType}, ${row.subjectType}, ${row.subjectId}, ${row.headline}, ${row.body},
        ${tx.json(row.evidenceJson)}, ${row.visibility}, ${row.model}, ${row.createdAt}, ${row.updatedAt}
      )
      on conflict (id) do update set
        headline = excluded.headline,
        body = excluded.body,
        evidence_json = excluded.evidence_json,
        visibility = excluded.visibility,
        model = excluded.model,
        updated_at = excluded.updated_at
    `;
  }

  for (const row of reports) {
    await tx`
      insert into fkh_social_reports (
        id, reporter_user_id, reported_user_id, target_type, target_id, reason, details, status, created_at, resolved_at
      )
      values (
        ${row.id}, ${row.reporterUserId}, ${row.reportedUserId}, ${row.targetType}, ${row.targetId}, ${row.reason},
        ${row.details}, ${row.status}, ${row.createdAt}, ${row.resolvedAt}
      )
      on conflict (id) do update set
        reported_user_id = excluded.reported_user_id,
        target_type = excluded.target_type,
        target_id = excluded.target_id,
        reason = excluded.reason,
        details = excluded.details,
        status = excluded.status,
        resolved_at = excluded.resolved_at
    `;
  }

  for (const row of moderationEvents) {
    await tx`
      insert into fkh_moderation_events (
        id, target_type, target_id, actor_user_id, event_type, severity, status, reason, metadata_json, created_at, resolved_at
      )
      values (
        ${row.id}, ${row.targetType}, ${row.targetId}, ${row.actorUserId}, ${row.eventType}, ${row.severity}, ${row.status},
        ${row.reason}, ${tx.json(row.metadataJson)}, ${row.createdAt}, ${row.resolvedAt}
      )
      on conflict (id) do update set
        target_type = excluded.target_type,
        target_id = excluded.target_id,
        actor_user_id = excluded.actor_user_id,
        event_type = excluded.event_type,
        severity = excluded.severity,
        status = excluded.status,
        reason = excluded.reason,
        metadata_json = excluded.metadata_json,
        resolved_at = excluded.resolved_at
    `;
  }
}

function uuidFor(value) {
  const bytes = crypto.createHash("sha256").update(`${SEED_MARKER}:${value}`).digest();
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function hash64(value) {
  return crypto.createHash("sha256").update(`${SEED_MARKER}:${value}`).digest("hex");
}

function sortedUserPair(userAId, userBId) {
  return userAId < userBId ? [userAId, userBId] : [userBId, userAId];
}

function carryForClub(golfer, clubType) {
  const gapByType = {
    driver: 0,
    "5w": -45,
    "4i": -73,
    "7i": -118,
    "9i": -148,
    pw: -167,
    sw: -205,
    lw: -224,
  };
  return Math.max(34, golfer.driverCarry + gapByType[clubType]);
}

function loftForClub(clubType) {
  return {
    driver: 9,
    "5w": 18,
    "4i": 22,
    "7i": 34,
    "9i": 42,
    pw: 46,
    sw: 54,
    lw: 60,
  }[clubType];
}

function buildGolferBio(profile) {
  const rankLabel = profile.rank ? `Current ${profile.country} player listed at OWGR #${profile.rank}` : `${profile.country} featured player`;
  const scoringLabel = profile.scoring ? `public scoring average ${profile.scoring.toFixed(2)}` : "tour scoring profile";

  return `${rankLabel}. Tour profile uses ${scoringLabel}. ForeKingHell shows shots, stock yardages, scorecards, social activity and tournament evidence.`;
}

function tourPlayerHeadshotUrl(profile) {
  return profile.cbsId
    ? `https://sportshub.cbsistatic.com/i/sports/player/headshot/${profile.cbsId}.png?width=200`
    : null;
}

function tourCoverImageUrl(index) {
  const image = TOUR_COVER_IMAGES[index % TOUR_COVER_IMAGES.length];
  return `/assets/tour-covers/${image}`;
}

function tourHomeCourse(profile) {
  const countryNames = {
    AUS: "Australia",
    AUT: "Austria",
    BEL: "Belgium",
    CAN: "Canada",
    CHN: "China",
    COL: "Colombia",
    DEU: "Germany",
    DNK: "Denmark",
    ENG: "England",
    ESP: "Spain",
    FIN: "Finland",
    IRL: "Ireland",
    JPN: "Japan",
    KOR: "Korea",
    NIR: "Northern Ireland",
    NOR: "Norway",
    NZL: "New Zealand",
    PHL: "Philippines",
    SCO: "Scotland",
    SWE: "Sweden",
    USA: "United States",
    ZAF: "South Africa",
  };

  return `${countryNames[profile.country] ?? profile.country} Performance Centre`;
}

function estimatedScoringAverage(profile, index) {
  const rankFactor = profile.rank ? Math.min(2.6, profile.rank * 0.021) : 1.1;
  return round1(69.55 + rankFactor + wiggle(index, 15, 0.45));
}

function estimatedDriverTotal(profile, index) {
  const rankFactor = profile.rank ? Math.max(-4, 28 - profile.rank) * 0.18 : 0;
  return round1(302 + rankFactor + wiggle(index, 17, 10));
}

function slugForName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function metricLabelForRecord(category) {
  if (category.recordType === "best_gross_score") {
    return "Gross score";
  }

  if (category.recordType === "longest_drive") {
    return "Total distance";
  }

  return "Carry spread";
}

function scoreLabelForRecord(value, category) {
  if (category.metricKind === "strokes") {
    return `${Math.round(value)} strokes`;
  }

  if (category.metricKind === "yards" && category.recordType === "longest_drive") {
    return `${round1(value)} yd`;
  }

  return `${round1(value)} yd spread`;
}

function wiggle(a, b, scale) {
  return Math.sin((a + 1) * 19.13 + (b + 1) * 7.71) * scale;
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function daysAgo(date, days) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() - days);
  return copy;
}

function daysAfter(date, days) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function addHours(date, hours) {
  const copy = new Date(date);
  copy.setUTCHours(copy.getUTCHours() + hours);
  return copy;
}

function addMinutes(date, minutes) {
  const copy = new Date(date);
  copy.setUTCMinutes(copy.getUTCMinutes() + minutes);
  return copy;
}
