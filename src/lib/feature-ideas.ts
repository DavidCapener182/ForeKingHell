import "server-only";

import { and, desc, eq, inArray, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  challengeEntries,
  challenges,
  clubs,
  courseFollows,
  courseProviderAliases,
  courseRecordGoals,
  courseRecordResults,
  courseRecords,
  courses,
  feedItems,
  friendships,
  groupChallengeLinks,
  groupMemberships,
  groupPosts,
  groups,
  importFiles,
  importJobs,
  practiceSessions,
  providerAccounts,
  providerSessions,
  sessions,
  shotSavedViews,
  shots,
  stockYardages,
  tournamentEntries,
  tournamentSubmissions,
  tournaments,
  userFeaturePreferences,
  userProfiles,
  weeklyRecaps,
} from "@/db/schema";
import { getDb } from "@/db/client";
import { formatClubType } from "@/lib/club-format";
import { requireCurrentUserId } from "@/lib/current-user";
import { roundSessionTypes } from "@/lib/round-sessions";
import {
  areFriends,
  createFeedItem,
  ensureSocialProfileForUser,
  parseVisibility,
} from "@/lib/social";

type ShotRow = typeof shots.$inferSelect;
type ClubRow = typeof clubs.$inferSelect;
type StockRow = typeof stockYardages.$inferSelect;
type SessionRow = typeof sessions.$inferSelect;
type FeaturePreferenceRow = typeof userFeaturePreferences.$inferSelect;
type FriendTargetOption = {
  userId: string;
  label: string;
  username: string;
};

const integerFormatter = new Intl.NumberFormat("en-GB");
const numberFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

export type FeatureInsight = {
  title: string;
  detail: string;
  metric?: string;
  href?: string;
  tone: "green" | "sky" | "amber" | "pink" | "slate";
};

export type FeatureIdeasData = Awaited<ReturnType<typeof buildFeatureIdeasDataForUser>>;
export type CourseFollowFeatureData = Pick<FeatureIdeasData, "courseFollows">;

export async function getFeatureIdeasData() {
  return buildFeatureIdeasDataForUser(await requireCurrentUserId());
}

export async function getCourseFollowFeatureData(): Promise<CourseFollowFeatureData> {
  const userId = await requireCurrentUserId();
  const db = getDb();
  const courseFollowRows = await optionalFeatureRows(
    db
      .select()
      .from(courseFollows)
      .where(eq(courseFollows.userId, userId))
      .orderBy(desc(courseFollows.updatedAt))
      .limit(30),
  );
  const followedCourseIds = courseFollowRows.map((follow) => follow.courseId);
  const [followedCourses, followedAliases] = await Promise.all([
    followedCourseIds.length
      ? db.select().from(courses).where(inArray(courses.id, followedCourseIds))
      : Promise.resolve([]),
    followedCourseIds.length
      ? optionalFeatureRows(
          db
            .select()
            .from(courseProviderAliases)
            .where(inArray(courseProviderAliases.courseId, followedCourseIds)),
        )
      : Promise.resolve([]),
  ]);

  return {
    courseFollows: buildCourseFollows(courseFollowRows, followedCourses, followedAliases),
  };
}

export async function buildFeatureIdeasDataForUser(userId: string) {
  const db = getDb();
  const now = new Date();
  const week = currentWeekWindow(now);

  const [
    profileRows,
    preferenceRows,
    clubRows,
    shotRows,
    stockRows,
    sessionRows,
    importFileRows,
    importJobRows,
    providerAccountRows,
    providerSessionRows,
    savedViewRows,
    practiceRows,
    recordGoalRows,
    courseFollowRows,
    recapRows,
    feedRows,
    tournamentEntryRows,
    challengeRows,
    membershipRows,
    availableRecordRows,
    friendshipRows,
  ] = await Promise.all([
    db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1),
    selectFeaturePreferenceRows(db, userId),
    db.select().from(clubs).where(eq(clubs.userId, userId)).orderBy(clubs.type),
    db.select().from(shots).where(eq(shots.userId, userId)).orderBy(desc(shots.shotAt)).limit(1200),
    db
      .select()
      .from(stockYardages)
      .where(eq(stockYardages.userId, userId))
      .orderBy(desc(stockYardages.calculatedAt))
      .limit(120),
    db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .orderBy(desc(sessions.date))
      .limit(120),
    db
      .select()
      .from(importFiles)
      .where(eq(importFiles.userId, userId))
      .orderBy(desc(importFiles.createdAt))
      .limit(40),
    db
      .select()
      .from(importJobs)
      .where(eq(importJobs.userId, userId))
      .orderBy(desc(importJobs.createdAt))
      .limit(40),
    optionalFeatureRows(
      db
        .select()
        .from(providerAccounts)
        .where(eq(providerAccounts.userId, userId))
        .orderBy(desc(providerAccounts.updatedAt)),
    ),
    optionalFeatureRows(
      db
        .select()
        .from(providerSessions)
        .where(eq(providerSessions.userId, userId))
        .orderBy(desc(providerSessions.lastSeenAt))
        .limit(40),
    ),
    optionalFeatureRows(
      db
        .select()
        .from(shotSavedViews)
        .where(eq(shotSavedViews.userId, userId))
        .orderBy(desc(shotSavedViews.pinned), desc(shotSavedViews.updatedAt)),
    ),
    optionalFeatureRows(
      db
        .select()
        .from(practiceSessions)
        .where(eq(practiceSessions.userId, userId))
        .orderBy(desc(practiceSessions.createdAt))
        .limit(30),
    ),
    optionalFeatureRows(
      db
        .select()
        .from(courseRecordGoals)
        .where(eq(courseRecordGoals.userId, userId))
        .orderBy(desc(courseRecordGoals.updatedAt))
        .limit(30),
    ),
    optionalFeatureRows(
      db
        .select()
        .from(courseFollows)
        .where(eq(courseFollows.userId, userId))
        .orderBy(desc(courseFollows.updatedAt))
        .limit(30),
    ),
    optionalFeatureRows(
      db
        .select()
        .from(weeklyRecaps)
        .where(eq(weeklyRecaps.userId, userId))
        .orderBy(desc(weeklyRecaps.createdAt))
        .limit(8),
    ),
    db
      .select()
      .from(feedItems)
      .where(eq(feedItems.userId, userId))
      .orderBy(desc(feedItems.createdAt))
      .limit(20),
    db
      .select()
      .from(tournamentEntries)
      .where(eq(tournamentEntries.userId, userId))
      .orderBy(desc(tournamentEntries.joinedAt))
      .limit(20),
    db
      .select()
      .from(challenges)
      .where(eq(challenges.creatorUserId, userId))
      .orderBy(desc(challenges.createdAt))
      .limit(20),
    db
      .select()
      .from(groupMemberships)
      .where(eq(groupMemberships.userId, userId))
      .orderBy(desc(groupMemberships.joinedAt))
      .limit(20),
    db
      .select()
      .from(courseRecords)
      .where(eq(courseRecords.status, "active"))
      .orderBy(desc(courseRecords.createdAt))
      .limit(12),
    optionalFeatureRows(
      db
        .select({
          userAId: friendships.userAId,
          userBId: friendships.userBId,
        })
        .from(friendships)
        .where(or(eq(friendships.userAId, userId), eq(friendships.userBId, userId))),
    ),
  ]);

  const followedCourseIds = courseFollowRows.map((follow) => follow.courseId);
  const recordIds = recordGoalRows.map((goal) => goal.recordId);
  const recordTargetUserIds = recordGoalRows
    .map((goal) => goal.targetUserId)
    .filter((id): id is string => Boolean(id));
  const tournamentIds = tournamentEntryRows.map((entry) => entry.tournamentId);
  const groupIds = membershipRows.map((membership) => membership.groupId);
  const friendIds = friendshipRows.map((row) =>
    row.userAId === userId ? row.userBId : row.userAId,
  );
  const friendAndTargetIds = [...new Set([...friendIds, ...recordTargetUserIds])];

  const [
    followedCourses,
    followedAliases,
    goalRecords,
    goalResults,
    friendProfileRows,
    tournamentRows,
    tournamentSubmissionRows,
    groupRows,
    groupPostRows,
    groupChallengeRows,
  ] = await Promise.all([
    followedCourseIds.length
      ? db.select().from(courses).where(inArray(courses.id, followedCourseIds))
      : Promise.resolve([]),
    followedCourseIds.length
      ? optionalFeatureRows(
          db
            .select()
            .from(courseProviderAliases)
            .where(inArray(courseProviderAliases.courseId, followedCourseIds)),
        )
      : Promise.resolve([]),
    recordIds.length
      ? db.select().from(courseRecords).where(inArray(courseRecords.id, recordIds))
      : Promise.resolve([]),
    recordIds.length
      ? db
          .select()
          .from(courseRecordResults)
          .where(inArray(courseRecordResults.recordId, recordIds))
      : Promise.resolve([]),
    friendAndTargetIds.length
      ? db.select().from(userProfiles).where(inArray(userProfiles.userId, friendAndTargetIds))
      : Promise.resolve([]),
    tournamentIds.length
      ? db.select().from(tournaments).where(inArray(tournaments.id, tournamentIds))
      : Promise.resolve([]),
    tournamentIds.length
      ? db
          .select()
          .from(tournamentSubmissions)
          .where(
            and(
              inArray(tournamentSubmissions.tournamentId, tournamentIds),
              eq(tournamentSubmissions.userId, userId),
            ),
          )
      : Promise.resolve([]),
    groupIds.length
      ? db.select().from(groups).where(inArray(groups.id, groupIds))
      : Promise.resolve([]),
    groupIds.length
      ? db
          .select()
          .from(groupPosts)
          .where(inArray(groupPosts.groupId, groupIds))
          .orderBy(desc(groupPosts.createdAt))
          .limit(40)
      : Promise.resolve([]),
    groupIds.length
      ? optionalFeatureRows(
          db
            .select()
            .from(groupChallengeLinks)
            .where(inArray(groupChallengeLinks.groupId, groupIds)),
        )
      : Promise.resolve([]),
  ]);

  const preferences = preferenceRows[0] ?? defaultFeaturePreferences(userId);
  const latestShotsByClub = groupShotsByClub(shotRows);
  const latestStockByClub = latestStockRows(stockRows);
  const importQuality = buildImportQuality(
    importFileRows,
    importJobRows,
    shotRows,
    clubRows,
    sessionRows,
  );
  const providerHealth = buildProviderHealth(
    providerAccountRows,
    providerSessionRows,
    importJobRows,
    importFileRows,
  );
  const dataHealth = buildDataHealth({
    sessions: sessionRows,
    shots: shotRows,
    clubs: clubRows,
    stockByClub: latestStockByClub,
    shotsByClub: latestShotsByClub,
    providerHealth,
  });
  const bagAlerts = buildBagAlerts(clubRows, latestStockByClub, latestShotsByClub);
  const targetDistanceOptions = buildTargetDistanceOptions(clubRows, latestStockByClub);
  const savedViews = [
    ...savedViewRows.map((view) => ({
      id: view.id,
      name: view.name,
      description: view.description ?? "Custom shot view",
      href: `/shots?${queryStringFromFilter(view.filterJson)}`,
      pinned: view.pinned,
    })),
    ...defaultSavedViews(shotRows),
  ].slice(0, 8);
  const clubIdentities = buildClubIdentities(clubRows, latestStockByClub, latestShotsByClub);
  const roundOpportunities = buildRoundOpportunities(sessionRows);
  const handicapConfidence = buildHandicapConfidence(sessionRows);
  const weeklyRecap = buildWeeklyRecap({
    shots: shotRows,
    sessions: sessionRows,
    recaps: recapRows,
    week,
  });
  const coachConfidence = buildCoachConfidence(shotRows, clubRows, practiceRows);
  const practicePlan = buildPracticePlan(bagAlerts, clubIdentities, practiceRows);
  const friendTargets = buildFriendTargetOptions(friendIds, friendProfileRows);
  const courseRecordGoalsData = buildCourseRecordGoals(
    recordGoalRows,
    goalRecords,
    goalResults,
    friendTargets,
  );
  const courseFollowsData = buildCourseFollows(courseFollowRows, followedCourses, followedAliases);
  const tournamentChecklist = buildTournamentChecklist(
    tournamentEntryRows,
    tournamentRows,
    tournamentSubmissionRows,
  );
  const roundDueReminders = tournamentChecklist
    .filter((item) => item.status !== "complete")
    .slice(0, 3);
  const waysToClimb = buildWaysToClimb({
    importQuality,
    providerHealth,
    practicePlan,
    tournamentChecklist,
    challengeRows,
  });
  const social = buildSocialFeatures(
    preferences,
    profileRows[0] ?? null,
    feedRows,
    clubIdentities,
    goalRecords.length,
  );
  const groupDigest = buildGroupDigest(groupRows, groupPostRows, groupChallengeRows);

  return {
    generatedAt: now,
    preferences,
    profile: profileRows[0] ?? null,
    importQuality,
    dataHealth,
    providerHealth,
    bagAlerts,
    targetDistanceOptions,
    savedViews,
    savedViewOptions: {
      clubs: [...new Set(clubRows.map((club) => club.type))].map((type) => ({
        value: type,
        label: formatClubType(type),
      })),
      categories: ["tee", "approach", "pitch", "chip", "full", "recovery"].map((category) => ({
        value: category,
        label: titleCase(category),
      })),
    },
    clubIdentities,
    roundOpportunities,
    handicapConfidence,
    weeklyRecap,
    coachConfidence,
    practicePlan,
    practiceCalendar: buildPracticeCalendar(practiceRows, practicePlan),
    courseRecordGoals: courseRecordGoalsData,
    friendTargets,
    courseRecordTargets: availableRecordRows.map((record) => ({
      id: record.id,
      label: `${record.recordType.replace(/_/g, " ")} · ${record.scope}`,
      href: `/course-records/${record.id}`,
    })),
    courseFollows: courseFollowsData,
    tournamentChecklist,
    roundDueReminders,
    waysToClimb,
    dailyMicroChallenges: buildDailyMicroChallenges(practicePlan, challengeRows),
    coachChallengeRecommendation: buildCoachChallengeRecommendation(practicePlan),
    social,
    groupDigest,
    dashboardActions: buildDashboardActions({
      importQuality,
      providerHealth,
      bagAlerts,
      practicePlan,
      tournamentChecklist,
      waysToClimb,
    }),
  };
}

export async function saveShotView(input: {
  name: string;
  description?: string | null;
  filterJson: Record<string, unknown>;
  pinned?: boolean;
}) {
  const userId = await requireCurrentUserId();
  const now = new Date();
  await getDb()
    .insert(shotSavedViews)
    .values({
      userId,
      name: clean(input.name, "Saved view").slice(0, 120),
      description: cleanNullable(input.description),
      filterJson: input.filterJson,
      pinned: Boolean(input.pinned),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [shotSavedViews.userId, shotSavedViews.name],
      set: {
        description: cleanNullable(input.description),
        filterJson: input.filterJson,
        pinned: Boolean(input.pinned),
        updatedAt: now,
      },
    });

  revalidatePath("/shots");
  revalidatePath("/dashboard");
}

export async function completePracticeDrill(input: {
  sourceId?: string | null;
  clubId?: string | null;
  clubType?: string | null;
  title: string;
  focusArea: string;
  targetShots?: number;
  recordedShots?: number;
  notes?: string | null;
}) {
  const userId = await requireCurrentUserId();
  const profile = await ensureSocialProfileForUser(userId);
  const preferences = await ensureFeaturePreferences(userId);
  const now = new Date();
  const title = clean(input.title, "Practice session").slice(0, 180);
  const [session] = await getDb()
    .insert(practiceSessions)
    .values({
      userId,
      sourceType: "coach",
      sourceId: cleanNullable(input.sourceId),
      clubId: cleanNullable(input.clubId),
      clubType: cleanNullable(input.clubType)?.slice(0, 40) ?? null,
      title,
      focusArea: clean(input.focusArea, "practice").slice(0, 80),
      status: "complete",
      plannedAt: now,
      completedAt: now,
      targetShots: boundedInteger(input.targetShots, 12, 1, 200),
      recordedShots: boundedInteger(input.recordedShots, input.targetShots ?? 12, 0, 400),
      notes: cleanNullable(input.notes),
      metadataJson: { completedFrom: "feature-ideas" },
      updatedAt: now,
    })
    .returning();

  if (preferences.autoSharePractice) {
    await createFeedItem({
      userId,
      itemType: "practice_completed",
      headline: `${profile.displayName} completed a coach drill`,
      metricLabel: "Practice",
      metricValue: `${session.recordedShots}/${session.targetShots} shots`,
      context: title,
      proofUrl: "/coach",
      sourceType: "practice_session",
      sourceId: session.id,
      visibility: parseVisibility(profile.feedVisibilityDefault, "private"),
      verificationLabel: "Self reported",
      dedupeKey: `practice:${session.id}`,
    });
  }

  revalidatePath("/today");
  revalidatePath("/coach");
  revalidatePath("/progress");
  revalidatePath("/feed");
}

export async function upsertCourseRecordGoal(input: {
  recordId: string;
  targetUserId?: string | null;
  targetValue?: number | null;
  targetLabel?: string | null;
  notifyWhenBeaten?: boolean;
}) {
  const userId = await requireCurrentUserId();
  const now = new Date();
  const targetUserId = cleanNullable(input.targetUserId);

  if (targetUserId && targetUserId !== userId && !(await areFriends(userId, targetUserId))) {
    throw new Error("Friend targets must be accepted friends.");
  }

  await getDb()
    .insert(courseRecordGoals)
    .values({
      userId,
      recordId: input.recordId,
      targetUserId,
      targetValue: Number.isFinite(input.targetValue) ? (input.targetValue ?? null) : null,
      targetLabel: cleanNullable(input.targetLabel),
      notifyWhenBeaten: input.notifyWhenBeaten !== false,
      status: "active",
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [courseRecordGoals.userId, courseRecordGoals.recordId],
      set: {
        targetUserId,
        targetValue: Number.isFinite(input.targetValue) ? (input.targetValue ?? null) : null,
        targetLabel: cleanNullable(input.targetLabel),
        notifyWhenBeaten: input.notifyWhenBeaten !== false,
        status: "active",
        updatedAt: now,
      },
    });

  revalidatePath("/course-records");
  revalidatePath("/profile");
}

export async function featureCourseRecord(recordId: string) {
  const userId = await requireCurrentUserId();
  const [existing] = await getDb()
    .select()
    .from(userFeaturePreferences)
    .where(eq(userFeaturePreferences.userId, userId))
    .limit(1);
  const now = new Date();
  const featuredRecordIdsJson = [
    recordId,
    ...(existing?.featuredRecordIdsJson ?? []).filter((id) => id !== recordId),
  ].slice(0, 6);

  await getDb()
    .insert(userFeaturePreferences)
    .values({
      userId,
      featuredRecordIdsJson,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userFeaturePreferences.userId,
      set: {
        featuredRecordIdsJson,
        updatedAt: now,
      },
    });

  revalidatePath("/profile");
  revalidatePath("/course-records");
}

export async function followCourse(input: {
  courseId: string;
  notifyRecords?: boolean;
  providerAliases?: Array<{
    provider: string;
    alias: string;
    providerCourseId?: string | null;
    teeName?: string | null;
  }>;
}) {
  const userId = await requireCurrentUserId();
  const now = new Date();
  const aliases = (input.providerAliases ?? [])
    .map((alias) => ({
      provider: clean(alias.provider, "manual").slice(0, 40),
      alias: clean(alias.alias, "").slice(0, 180),
      providerCourseId: cleanNullable(alias.providerCourseId)?.slice(0, 180) ?? null,
      teeName: cleanNullable(alias.teeName)?.slice(0, 120) ?? "",
    }))
    .filter((alias) => alias.alias);

  await getDb()
    .insert(courseFollows)
    .values({
      userId,
      courseId: input.courseId,
      notifyRecords: input.notifyRecords !== false,
      providerAliasesJson: aliases.map(({ provider, alias, providerCourseId, teeName }) => ({
        provider,
        alias,
        providerCourseId,
        teeName,
      })),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [courseFollows.userId, courseFollows.courseId],
      set: {
        notifyRecords: input.notifyRecords !== false,
        providerAliasesJson: aliases.map(({ provider, alias, providerCourseId, teeName }) => ({
          provider,
          alias,
          providerCourseId,
          teeName,
        })),
        updatedAt: now,
      },
    });

  for (const alias of aliases) {
    await getDb()
      .insert(courseProviderAliases)
      .values({
        courseId: input.courseId,
        providerKind: alias.provider,
        providerCourseId:
          alias.providerCourseId ??
          `feature:${input.courseId}:${alias.provider}:${normaliseCourseName(alias.alias)}`,
        providerCourseName: alias.alias,
        providerTeeName: alias.teeName,
        normalisedName: normaliseCourseName(alias.alias),
        confidenceScore: 0.85,
        metadataJson: { source: "course_follow_feature" },
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          courseProviderAliases.providerKind,
          courseProviderAliases.providerCourseId,
          courseProviderAliases.providerCourseName,
          courseProviderAliases.providerTeeName,
        ],
        set: {
          courseId: input.courseId,
          normalisedName: normaliseCourseName(alias.alias),
          confidenceScore: 0.85,
          metadataJson: { source: "course_follow_feature" },
          updatedAt: now,
        },
      });
  }

  revalidatePath("/courses");
  revalidatePath("/course-records");
}

export async function updateFeaturePreferences(input: {
  autoShareRounds?: boolean;
  autoSharePbs?: boolean;
  autoShareAchievements?: boolean;
  autoSharePractice?: boolean;
  publicSharePreview?: boolean;
}) {
  const userId = await requireCurrentUserId();
  const now = new Date();
  await getDb()
    .insert(userFeaturePreferences)
    .values({
      userId,
      autoShareRounds: Boolean(input.autoShareRounds),
      autoSharePbs: Boolean(input.autoSharePbs),
      autoShareAchievements: Boolean(input.autoShareAchievements),
      autoSharePractice: Boolean(input.autoSharePractice),
      publicSharePreview: Boolean(input.publicSharePreview),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userFeaturePreferences.userId,
      set: {
        autoShareRounds: Boolean(input.autoShareRounds),
        autoSharePbs: Boolean(input.autoSharePbs),
        autoShareAchievements: Boolean(input.autoShareAchievements),
        autoSharePractice: Boolean(input.autoSharePractice),
        publicSharePreview: Boolean(input.publicSharePreview),
        updatedAt: now,
      },
    });

  revalidatePath("/feed");
  revalidatePath("/profile");
  revalidatePath("/settings");
}

export async function saveCurrentWeeklyRecap() {
  const userId = await requireCurrentUserId();
  const featureData = await buildFeatureIdeasDataForUser(userId);
  const week = currentWeekWindow(new Date());
  const now = new Date();
  const generated = await generateWeeklyRecapCopy({
    weeklyRecap: featureData.weeklyRecap,
    coachConfidence: featureData.coachConfidence,
    importQuality: featureData.importQuality,
    bagAlerts: featureData.bagAlerts.slice(0, 3),
    practicePlan: featureData.practicePlan,
    handicapConfidence: featureData.handicapConfidence,
    tournamentChecklist: featureData.tournamentChecklist.slice(0, 3),
  });

  await getDb()
    .insert(weeklyRecaps)
    .values({
      userId,
      weekStart: week.start,
      weekEnd: week.end,
      headline: generated.headline.slice(0, 220),
      summaryJson: {
        generatedFrom: generated.generatedFrom,
        coachNote: generated.coachNote,
        practicePlan: generated.practicePlan,
        watchOut: generated.watchOut,
        bestClub: featureData.weeklyRecap.bestClub,
        weakestSignal: featureData.weeklyRecap.weakestSignal,
        newPbs: featureData.weeklyRecap.newPbs,
        nextGoal: featureData.weeklyRecap.nextGoal,
      },
      visibility: "private",
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [weeklyRecaps.userId, weeklyRecaps.weekStart],
      set: {
        weekEnd: week.end,
        headline: generated.headline.slice(0, 220),
        summaryJson: {
          generatedFrom: generated.generatedFrom,
          coachNote: generated.coachNote,
          practicePlan: generated.practicePlan,
          watchOut: generated.watchOut,
          bestClub: featureData.weeklyRecap.bestClub,
          weakestSignal: featureData.weeklyRecap.weakestSignal,
          newPbs: featureData.weeklyRecap.newPbs,
          nextGoal: featureData.weeklyRecap.nextGoal,
        },
        updatedAt: now,
      },
    });

  revalidatePath("/progress");
  revalidatePath("/dashboard");
}

export async function createLatestRoundRecap() {
  const userId = await requireCurrentUserId();
  const db = getDb();
  const [round] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.userId, userId), inArray(sessions.type, [...roundSessionTypes])))
    .orderBy(desc(sessions.date))
    .limit(1);

  if (!round) {
    return;
  }

  const profile = await ensureSocialProfileForUser(userId);
  const score = roundScore(round);
  await createFeedItem({
    userId,
    itemType: "post_round_recap",
    headline: `${profile.displayName} posted a round recap`,
    metricLabel: round.courseName ?? round.location ?? "Round",
    metricValue: score === null ? "Logged" : `${score}`,
    context: round.notes ?? "Latest scorecard recap",
    proofUrl: `/rounds/${round.id}`,
    sourceType: "session",
    sourceId: round.id,
    visibility: parseVisibility(profile.feedVisibilityDefault, "private"),
    verificationLabel: round.source === "manual" ? "Manual" : "Verified import",
    dedupeKey: `round-recap:${round.id}`,
  });

  revalidatePath("/feed");
  revalidatePath("/rounds");
}

export async function createCoachSignalChallenge(input: {
  title: string;
  description: string;
  clubId?: string | null;
  clubType?: string | null;
  focusArea?: string | null;
}) {
  const userId = await requireCurrentUserId();
  const now = new Date();
  const endsAt = new Date(now);
  endsAt.setDate(endsAt.getDate() + 7);
  const [challenge] = await getDb()
    .insert(challenges)
    .values({
      creatorUserId: userId,
      title: clean(input.title, "Coach signal challenge").slice(0, 180),
      description: clean(input.description, "Coach-generated practice challenge"),
      visibility: "friends",
      status: "open",
      startsAt: now,
      endsAt,
      challengeRulesJson: {
        source: "coach_signal",
        clubId: input.clubId ?? null,
        clubType: input.clubType ?? null,
        focusArea: input.focusArea ?? "practice",
      },
      updatedAt: now,
    })
    .returning();

  await getDb()
    .insert(challengeEntries)
    .values({
      challengeId: challenge.id,
      userId,
      status: "joined",
      updatedAt: now,
    })
    .onConflictDoNothing();

  revalidatePath("/challenges");
  revalidatePath("/coach");
}

async function ensureFeaturePreferences(userId: string): Promise<FeaturePreferenceRow> {
  const db = getDb();
  const now = new Date();
  try {
    const [row] = await db
      .insert(userFeaturePreferences)
      .values({ userId, updatedAt: now })
      .onConflictDoUpdate({ target: userFeaturePreferences.userId, set: { updatedAt: now } })
      .returning();

    return row;
  } catch (error) {
    if (isMissingFeaturePreferencesTable(error)) {
      return defaultFeaturePreferences(userId);
    }

    throw error;
  }
}

async function selectFeaturePreferenceRows(
  db: ReturnType<typeof getDb>,
  userId: string,
): Promise<FeaturePreferenceRow[]> {
  return optionalFeatureRows(
    db
      .select()
      .from(userFeaturePreferences)
      .where(eq(userFeaturePreferences.userId, userId))
      .limit(1),
  );
}

async function optionalFeatureRows<T>(query: PromiseLike<T[]>): Promise<T[]> {
  try {
    return await query;
  } catch (error) {
    if (isMissingFeatureTable(error)) {
      return [];
    }

    throw error;
  }
}

function isMissingFeaturePreferencesTable(error: unknown) {
  return isMissingFeatureTable(error);
}

function isMissingFeatureTable(error: unknown) {
  const maybeError = error as {
    code?: string;
    message?: string;
    cause?: { code?: string; message?: string };
  };
  const message = `${maybeError.message ?? ""} ${maybeError.cause?.message ?? ""}`;

  return (
    maybeError.code === "42P01" ||
    maybeError.cause?.code === "42P01" ||
    message.includes("does not exist")
  );
}

function defaultFeaturePreferences(userId: string): FeaturePreferenceRow {
  const now = new Date(0);
  return {
    userId,
    autoShareRounds: false,
    autoSharePbs: false,
    autoShareAchievements: false,
    autoSharePractice: false,
    publicSharePreview: false,
    featuredRecordIdsJson: [],
    highlightSettingsJson: {},
    createdAt: now,
    updatedAt: now,
  };
}

function buildImportQuality(
  files: Array<typeof importFiles.$inferSelect>,
  jobs: Array<typeof importJobs.$inferSelect>,
  shotRows: ShotRow[],
  clubRows: ClubRow[],
  sessionRows: SessionRow[],
): FeatureInsight & {
  score: number;
  checks: FeatureInsight[];
} {
  const latestFile = files[0] ?? null;
  const latestJob = jobs[0] ?? null;
  const duplicateCount = files.filter(
    (file) => file.status === "duplicate" || file.duplicateOfFileId,
  ).length;
  const mappedClubCount = new Set(shotRows.map((shot) => shot.clubId).filter(Boolean)).size;
  const missingCarry = shotRows.filter(
    (shot) => shot.carryYd === null && shot.totalYd === null,
  ).length;
  const missingLaunch = shotRows.filter(
    (shot) => shot.launchAngleDeg === null || shot.ballSpeedMph === null,
  ).length;
  const rowsSaved = shotRows.length;
  const courseDetected = sessionRows.some((session) =>
    Boolean(session.courseId ?? session.courseName),
  );
  const scorecardMatched = sessionRows.some((session) => (session.scorecardJson?.length ?? 0) > 0);
  const score = clamp(
    45 +
      Math.min(25, mappedClubCount * 4) +
      (latestFile ? 15 : 0) -
      Math.min(20, duplicateCount * 4) -
      Math.min(20, Math.round((missingCarry / Math.max(1, shotRows.length)) * 35)) -
      Math.min(15, Math.round((missingLaunch / Math.max(1, shotRows.length)) * 20)) +
      (courseDetected ? 5 : 0) +
      (scorecardMatched ? 5 : 0),
    0,
    100,
  );

  return {
    title: "Import quality score",
    metric: `${score}/100`,
    detail:
      latestJob?.status === "failed"
        ? `Latest ${latestJob.providerKind} import needs attention.`
        : `${integerFormatter.format(mappedClubCount)} clubs mapped, ${integerFormatter.format(rowsSaved)} rows saved, ${integerFormatter.format(duplicateCount)} duplicates, ${courseDetected ? "course detected" : "course not detected"}.`,
    href: "/import",
    tone: score >= 80 ? "green" : score >= 60 ? "amber" : "pink",
    score,
    checks: [
      {
        title: "Clubs mapped",
        metric: `${mappedClubCount}/${Math.max(clubRows.length, mappedClubCount)}`,
        detail: mappedClubCount
          ? "Shot data is tied to bag clubs."
          : "Map clubs after your next import.",
        href: "/bag",
        tone: mappedClubCount ? "green" : "amber",
      },
      {
        title: "Rows saved",
        metric: integerFormatter.format(rowsSaved),
        detail: rowsSaved
          ? "Normalized shot rows are available for stock yardages and progress."
          : "No usable shot rows have been saved yet.",
        href: "/shots",
        tone: rowsSaved ? "green" : "amber",
      },
      {
        title: "Duplicates found",
        metric: integerFormatter.format(duplicateCount),
        detail: duplicateCount
          ? "Review duplicate files before scoring records."
          : "No duplicate files in the recent library.",
        href: "/import",
        tone: duplicateCount ? "amber" : "green",
      },
      {
        title: "Missing metrics",
        metric: integerFormatter.format(missingCarry + missingLaunch),
        detail: "Carry, total, launch and ball speed improve coach confidence.",
        href: "/shots",
        tone: missingCarry + missingLaunch > 20 ? "amber" : "green",
      },
      {
        title: "Distance unit confidence",
        metric: rowsSaved ? "Yards" : "Waiting",
        detail: rowsSaved
          ? "Saved shot distances are normalized to yards for every product surface."
          : "Confirm yards/metres fallback before the first import.",
        href: "/import",
        tone: rowsSaved ? "green" : "amber",
      },
      {
        title: "Course detected",
        metric: courseDetected ? "Yes" : "No",
        detail: courseDetected
          ? "At least one import carries course context."
          : "Course matching is still waiting for a round or simulated-course import.",
        href: "/courses",
        tone: courseDetected ? "green" : "slate",
      },
      {
        title: "Scorecard matched",
        metric: scorecardMatched ? "Yes" : "No",
        detail: scorecardMatched
          ? "Scorecard rows can support round review and proof."
          : "Upload scorecard proof or import a simulated-course file.",
        href: "/rounds",
        tone: scorecardMatched ? "green" : "slate",
      },
      {
        title: "Eligible events",
        metric: latestFile ? "Ready" : "Waiting",
        detail: latestFile
          ? "Recent imports can feed records, tournaments and challenges."
          : "Import a file to unlock submissions.",
        href: "/course-records",
        tone: latestFile ? "green" : "slate",
      },
    ],
  };
}

function buildDataHealth({
  sessions: sessionRows,
  shots: shotRows,
  clubs: clubRows,
  stockByClub,
  shotsByClub,
  providerHealth,
}: {
  sessions: SessionRow[];
  shots: ShotRow[];
  clubs: ClubRow[];
  stockByClub: Map<string, StockRow>;
  shotsByClub: Map<string, ShotRow[]>;
  providerHealth: FeatureInsight[];
}): FeatureInsight & {
  score: number;
  status: string;
  checks: FeatureInsight[];
} {
  const latestSession = sessionRows[0] ?? null;
  const mappedShotCount = shotRows.filter((shot) => shot.clubId).length;
  const unmappedShotCount = shotRows.length - mappedShotCount;
  const weakSampleClubs = clubRows.filter((club) => (shotsByClub.get(club.id)?.length ?? 0) < 8);
  const lowConfidenceClubs = clubRows.filter((club) => {
    const stock = stockByClub.get(club.id);
    return typeof stock?.confidenceScore === "number" ? stock.confidenceScore < 60 : true;
  });
  const roundRows = sessionRows.filter(
    (session) =>
      session.type.toLowerCase().includes("round") || (session.scorecardJson?.length ?? 0) > 0,
  );
  const roundsNeedingVerification = roundRows.filter(
    (session) => !session.teeSetId || (session.scorecardJson?.length ?? 0) === 0,
  );
  const rapsodoHealth =
    providerHealth.find((item) => item.title.toLowerCase().includes("rapsodo")) ??
    providerHealth[0];
  const lastImportAgeDays = latestSession
    ? Math.floor((Date.now() - latestSession.date.getTime()) / (24 * 60 * 60 * 1000))
    : null;
  const staleImport = lastImportAgeDays === null || lastImportAgeDays > 14;
  const score = clamp(
    100 -
      Math.min(25, weakSampleClubs.length * 5) -
      Math.min(30, Math.round((unmappedShotCount / Math.max(1, shotRows.length)) * 30)) -
      Math.min(20, lowConfidenceClubs.length * 4) -
      Math.min(18, roundsNeedingVerification.length * 6) -
      (staleImport ? 10 : 0),
    0,
    100,
  );
  const status = score >= 85 ? "Healthy" : score >= 65 ? "Needs attention" : "Baseline needed";
  const tone = score >= 85 ? "green" : score >= 65 ? "amber" : "pink";

  return {
    title: "Data health score",
    metric: `${score}/100`,
    detail:
      `${integerFormatter.format(weakSampleClubs.length)} clubs need more shots, ` +
      `${integerFormatter.format(roundsNeedingVerification.length)} rounds need rating/slope or scorecard proof, ` +
      `${rapsodoHealth?.title ?? "Provider"} ${rapsodoHealth?.metric?.toLowerCase() ?? "unknown"}.`,
    href: "/settings",
    tone,
    score,
    status,
    checks: [
      {
        title: "Last import",
        metric: latestSession ? relativeDate(latestSession.date) : "None",
        detail: latestSession
          ? `${titleCase((sessionRows[0]?.type ?? "session").replace(/_/g, " "))} data is available.`
          : "Import Rapsodo data to start the product loop.",
        href: "/import",
        tone: staleImport ? "amber" : "green",
      },
      {
        title: "Club sample sizes",
        metric: `${weakSampleClubs.length} weak`,
        detail:
          weakSampleClubs.length > 0
            ? "Add recent shots for clubs under the stock-yardage sample threshold."
            : "Every active club has enough shots for first-pass trust.",
        href: "/bag",
        tone: weakSampleClubs.length > 0 ? "amber" : "green",
      },
      {
        title: "Missing club mappings",
        metric: integerFormatter.format(unmappedShotCount),
        detail:
          unmappedShotCount > 0
            ? "Map imported rows before using stock yardages for decisions."
            : "Saved shots are linked to bag clubs.",
        href: "/import",
        tone: unmappedShotCount > 0 ? "amber" : "green",
      },
      {
        title: "Course rating/slope",
        metric: `${roundsNeedingVerification.length} rounds`,
        detail:
          roundsNeedingVerification.length > 0
            ? "Add tee/rating data or scorecard proof for handicap confidence."
            : "Saved rounds have the main verification hooks.",
        href: "/courses",
        tone: roundsNeedingVerification.length > 0 ? "amber" : "green",
      },
      {
        title: "Low-confidence stock",
        metric: integerFormatter.format(lowConfidenceClubs.length),
        detail:
          lowConfidenceClubs.length > 0
            ? "Retest clubs with low confidence before trusting carry numbers."
            : "Stock-yardage confidence is usable.",
        href: "/coach",
        tone: lowConfidenceClubs.length > 0 ? "amber" : "green",
      },
      {
        title: "Provider sync",
        metric: rapsodoHealth?.metric ?? "Unknown",
        detail: rapsodoHealth?.detail ?? "Connect Rapsodo or upload CSV exports.",
        href: rapsodoHealth?.href ?? "/providers",
        tone: (rapsodoHealth?.tone ?? "slate") as FeatureInsight["tone"],
      },
    ],
  };
}

function buildProviderHealth(
  accounts: Array<typeof providerAccounts.$inferSelect>,
  providerSessionRows: Array<typeof providerSessions.$inferSelect>,
  jobs: Array<typeof importJobs.$inferSelect>,
  files: Array<typeof importFiles.$inferSelect>,
): FeatureInsight[] {
  const providers = ["rapsodo", "square", "trackman", "manual_csv"];

  return providers.map((provider) => {
    const providerAccounts = accounts.filter((account) => account.providerKind === provider);
    const sessionsForProvider = providerSessionRows.filter(
      (session) => session.providerKind === provider,
    );
    const jobsForProvider = jobs.filter((job) => job.providerKind === provider);
    const filesForProvider = files.filter(
      (file) => file.source === provider || file.source.includes(provider),
    );
    const latestError = jobsForProvider.find((job) => job.status === "failed" || job.errorMessage);
    const lastSeen =
      sessionsForProvider[0]?.lastSeenAt ??
      filesForProvider[0]?.createdAt ??
      providerAccounts[0]?.updatedAt ??
      null;
    const live = provider === "rapsodo" || provider === "manual_csv";
    const healthy =
      !latestError &&
      (providerAccounts.length > 0 ||
        sessionsForProvider.length > 0 ||
        filesForProvider.length > 0);

    return {
      title: providerLabel(provider),
      metric: healthy ? "Healthy" : live ? "Ready" : "Beta",
      detail: latestError
        ? (latestError.errorMessage ?? "Latest import job failed.")
        : lastSeen
          ? `Last activity ${relativeDate(lastSeen)}.`
          : live
            ? "Ready for CSV/import setup."
            : "Join the beta when the adapter opens.",
      href: provider === "manual_csv" ? "/import" : "/providers",
      tone: latestError ? "pink" : healthy ? "green" : live ? "amber" : "sky",
    };
  });
}

function buildBagAlerts(
  clubRows: ClubRow[],
  stockByClub: Map<string, StockRow>,
  shotsByClub: Map<string, ShotRow[]>,
): FeatureInsight[] {
  const stockList = clubRows
    .map((club) => ({
      club,
      stock: stockByClub.get(club.id),
      shots: shotsByClub.get(club.id) ?? [],
    }))
    .filter((row) => row.stock?.carryMedianYd !== null)
    .sort((left, right) => (left.stock?.carryMedianYd ?? 0) - (right.stock?.carryMedianYd ?? 0));
  const alerts: FeatureInsight[] = [];

  for (let index = 1; index < stockList.length; index += 1) {
    const previous = stockList[index - 1];
    const current = stockList[index];
    const gap = (current.stock?.carryMedianYd ?? 0) - (previous.stock?.carryMedianYd ?? 0);

    if (gap < 7) {
      alerts.push({
        title: `${formatClubType(previous.club.type)} and ${formatClubType(current.club.type)} overlap`,
        metric: `${numberFormatter.format(gap)} yd`,
        detail: "Bag fitting alert: these clubs may be covering the same stock number.",
        href: "/bag",
        tone: "amber",
      });
    } else if (gap > 18) {
      alerts.push({
        title: `Wide gap into ${formatClubType(current.club.type)}`,
        metric: `${numberFormatter.format(gap)} yd`,
        detail: "Bag fitting alert: consider a choke-down number or a missing club slot.",
        href: "/bag",
        tone: "pink",
      });
    }
  }

  for (const row of stockList) {
    const confidence = row.stock?.confidenceScore ?? 0;
    if (row.shots.length >= 5 && confidence < 55) {
      alerts.push({
        title: `${formatClubType(row.club.type)} trust below bag average`,
        metric: `${Math.round(confidence)}%`,
        detail: "More recent stock shots will tighten the recommendation.",
        href: `/bag/${row.club.id}`,
        tone: "amber",
      });
    }
  }

  return alerts.length
    ? alerts.slice(0, 6)
    : [
        {
          title: "Bag fitting alerts",
          metric: "Clear",
          detail: "No major gapping overlap or wide distance jump in the current stock yardages.",
          href: "/bag",
          tone: "green",
        },
      ];
}

function buildTargetDistanceOptions(clubRows: ClubRow[], stockByClub: Map<string, StockRow>) {
  const stockList = clubRows
    .map((club) => ({ club, stock: stockByClub.get(club.id) }))
    .filter(
      (row) =>
        typeof row.stock?.recommendedPlayNumberYd === "number" ||
        typeof row.stock?.carryMedianYd === "number",
    );
  const targets = [90, 110, 125, 140, 150, 165, 180, 200, 225];

  return targets.map((target) => {
    const best = stockList
      .map((row) => ({
        club: row.club,
        distance: row.stock?.recommendedPlayNumberYd ?? row.stock?.carryMedianYd ?? 0,
      }))
      .sort(
        (left, right) => Math.abs(left.distance - target) - Math.abs(right.distance - target),
      )[0];

    return {
      target,
      clubId: best?.club.id ?? null,
      clubName: best ? formatClubType(best.club.type) : "Build bag data",
      playNumber: best ? Math.round(best.distance) : null,
      gap: best ? Math.round(best.distance - target) : null,
      href: best ? `/bag/${best.club.id}` : "/import",
    };
  });
}

function buildClubIdentities(
  clubRows: ClubRow[],
  stockByClub: Map<string, StockRow>,
  shotsByClub: Map<string, ShotRow[]>,
) {
  return clubRows
    .map((club) => {
      const stock = stockByClub.get(club.id);
      const clubShots = shotsByClub.get(club.id) ?? [];
      const primaryMiss = primaryMissLabel(clubShots);
      const stockCarry = stock?.carryMedianYd ?? null;
      const trust = Math.round(stock?.confidenceScore ?? Math.min(90, clubShots.length * 7));

      return {
        clubId: club.id,
        clubType: club.type,
        name: formatClubType(club.type),
        purpose: clubPurpose(club.type, stockCarry),
        bestDistance: stockCarry === null ? "Needs data" : `${Math.round(stockCarry)} yd`,
        dangerousMiss: primaryMiss,
        confidence: `${clamp(trust, 0, 100)}%`,
        href: `/bag/${club.id}`,
      };
    })
    .sort(
      (left, right) => Number.parseInt(right.confidence, 10) - Number.parseInt(left.confidence, 10),
    )
    .slice(0, 6);
}

function buildRoundOpportunities(sessionRows: SessionRow[]): FeatureInsight[] {
  const rounds = sessionRows.filter((session) => isRoundLike(session));
  const latest = rounds[0] ?? null;
  if (!latest) {
    return [
      {
        title: "Round opportunity detector",
        metric: "No round",
        detail: "Add a real or simulator round to unlock PB, record and tournament prompts.",
        href: "/rounds/new",
        tone: "slate",
      },
    ];
  }

  const score = roundScore(latest);
  return [
    {
      title: "Post-round recap card",
      metric: score === null ? "Ready" : `${score}`,
      detail: `${latest.courseName ?? latest.location ?? "Latest round"} can be shared as a compact feed recap.`,
      href: `/rounds/${latest.id}`,
      tone: "green",
    },
    {
      title: "Course board eligible",
      metric: latest.courseId ? "Yes" : "Course missing",
      detail: latest.courseId
        ? "Mapped course data can feed course records."
        : "Match this round to a course before submitting records.",
      href: latest.courseId ? "/course-records" : `/rounds/${latest.id}`,
      tone: latest.courseId ? "green" : "amber",
    },
    {
      title: "Proof checklist",
      metric: latest.rawCsvHash ? "Import proof" : "Manual",
      detail: latest.rawCsvHash
        ? "CSV hash is available for verification."
        : "Add scorecard evidence before competitions.",
      href: `/rounds/${latest.id}`,
      tone: latest.rawCsvHash ? "green" : "amber",
    },
  ];
}

function buildHandicapConfidence(sessionRows: SessionRow[]) {
  const rounds = sessionRows.filter((session) => isRoundLike(session));
  const realRounds = rounds.filter((session) => session.type !== "sim_round");
  const withCourse = rounds.filter((session) => session.courseId && session.teeSetId).length;
  const withScores = rounds.filter((session) => roundScore(session) !== null).length;
  const score = clamp(realRounds.length * 12 + withCourse * 10 + withScores * 6, 0, 100);

  return {
    title: "Handicap confidence",
    metric: `${score}/100`,
    detail:
      score >= 70
        ? "Estimate has enough round context to be useful."
        : "Add rated tee sets and more real rounds to improve confidence.",
    href: "/handicap",
    tone: score >= 70 ? "green" : score >= 40 ? "amber" : "pink",
    checks: [
      { label: "Add course rating", done: withCourse > 0 },
      { label: "Add slope", done: withCourse > 0 },
      { label: "Add more real rounds", done: realRounds.length >= 5 },
      { label: "Verify scorecard", done: rounds.some((session) => Boolean(session.rawCsvHash)) },
    ],
  };
}

function buildWeeklyRecap({
  shots: shotRows,
  sessions: sessionRows,
  recaps,
  week,
}: {
  shots: ShotRow[];
  sessions: SessionRow[];
  recaps: Array<typeof weeklyRecaps.$inferSelect>;
  week: { start: Date; end: Date };
}) {
  const weekShots = shotRows.filter((shot) => shot.shotAt >= week.start && shot.shotAt <= week.end);
  const weekSessions = sessionRows.filter(
    (session) => session.date >= week.start && session.date <= week.end,
  );
  const bestClub = bestClubThisWeek(weekShots);
  const cached = recaps.find((recap) => sameDateKey(recap.weekStart, week.start));
  const cachedSummary = cached?.summaryJson ?? {};
  const cachedCoachNote = stringFromRecord(cachedSummary, "coachNote");
  const cachedPracticePlan = arrayOfStringsFromRecord(cachedSummary, "practicePlan");
  const cachedGeneratedFrom = stringFromRecord(cachedSummary, "generatedFrom");

  return {
    title: "Weekly data recap",
    metric: `${integerFormatter.format(weekShots.length)} shots`,
    detail:
      cached?.headline ??
      `${integerFormatter.format(weekSessions.length)} sessions this week. Best signal: ${bestClub}.`,
    href: "/progress",
    tone: weekShots.length >= 20 ? "green" : weekShots.length > 0 ? "amber" : "slate",
    bestClub,
    weakestSignal:
      stringFromRecord(cachedSummary, "weakestSignal") ??
      (weekShots.length < 20 ? "Sample size" : "Review coach deltas"),
    newPbs: stringFromRecord(cachedSummary, "newPbs") ?? "PBs appear in Feed and Achievements",
    nextGoal:
      stringFromRecord(cachedSummary, "nextGoal") ??
      (weekShots.length >= 20 ? "Review trends" : "Import or record 20 shots"),
    coachNote:
      cachedCoachNote ??
      `${integerFormatter.format(weekSessions.length)} sessions and ${integerFormatter.format(weekShots.length)} shots are in this week's sample. Keep the next goal tight and measurable.`,
    practicePlan: cachedPracticePlan.length
      ? cachedPracticePlan
      : [
          "Review the top coach signal",
          "Hit one measured 12-shot block",
          "Save the result and compare next week",
        ],
    generatedFrom: cachedGeneratedFrom ?? "rules-live",
  };
}

async function generateWeeklyRecapCopy(input: {
  weeklyRecap: ReturnType<typeof buildWeeklyRecap>;
  coachConfidence: ReturnType<typeof buildCoachConfidence>;
  importQuality: ReturnType<typeof buildImportQuality>;
  bagAlerts: FeatureInsight[];
  practicePlan: ReturnType<typeof buildPracticePlan>;
  handicapConfidence: ReturnType<typeof buildHandicapConfidence>;
  tournamentChecklist: FeatureInsight[];
}) {
  const fallback = {
    headline: input.weeklyRecap.detail,
    coachNote: input.weeklyRecap.coachNote,
    practicePlan: input.weeklyRecap.practicePlan,
    watchOut: input.weeklyRecap.weakestSignal,
    generatedFrom: "rules-v2",
  };
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return { ...fallback, generatedFrom: "rules-v2-missing-openai-key" };
  }

  const payload = {
    productName: "LM World Tour",
    weeklyRecap: input.weeklyRecap,
    coachConfidence: input.coachConfidence,
    importQuality: input.importQuality,
    bagAlerts: input.bagAlerts,
    practicePlan: input.practicePlan,
    handicapConfidence: input.handicapConfidence,
    tournamentChecklist: input.tournamentChecklist,
  };

  try {
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model:
          process.env.OPENAI_WEEKLY_RECAP_MODEL ?? process.env.OPENAI_COACH_MODEL ?? "gpt-4.1-mini",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: buildWeeklyRecapPrompt(payload),
              },
            ],
          },
        ],
        max_output_tokens: 750,
      }),
    });
    const responsePayload = (await upstream.json().catch(() => null)) as unknown;

    if (!upstream.ok) {
      return { ...fallback, generatedFrom: "rules-v2-openai-error" };
    }

    const parsed = parseWeeklyRecapResponse(readResponseText(responsePayload));
    return { ...parsed, generatedFrom: "openai-responses" };
  } catch {
    return { ...fallback, generatedFrom: "rules-v2-openai-error" };
  }
}

function buildWeeklyRecapPrompt(payload: unknown) {
  return `You write LM World Tour weekly golf recaps.

Use only the supplied JSON. Do not invent scores, swing causes, handicap claims, or social facts.
Return strict JSON only:
{
  "headline": "short useful recap headline",
  "coachNote": "80-120 words, direct and specific",
  "practicePlan": ["three concise practice actions"],
  "watchOut": "one risk or data gap"
}

Data:
${JSON.stringify(payload, null, 2)}`;
}

function parseWeeklyRecapResponse(text: string) {
  const parsed = JSON.parse(extractJson(text)) as {
    headline?: unknown;
    coachNote?: unknown;
    practicePlan?: unknown;
    watchOut?: unknown;
  };
  const practicePlan = Array.isArray(parsed.practicePlan)
    ? parsed.practicePlan
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .slice(0, 4)
    : [];

  return {
    headline:
      typeof parsed.headline === "string" && parsed.headline.trim()
        ? parsed.headline.trim()
        : "Weekly data recap",
    coachNote:
      typeof parsed.coachNote === "string" && parsed.coachNote.trim()
        ? parsed.coachNote.trim()
        : "Review this week's LM World Tour data, then keep the next practice block measurable.",
    practicePlan: practicePlan.length
      ? practicePlan
      : [
          "Review the top coach signal",
          "Hit one measured 12-shot block",
          "Save the result and compare next week",
        ],
    watchOut:
      typeof parsed.watchOut === "string" && parsed.watchOut.trim()
        ? parsed.watchOut.trim()
        : "Do not overreact to a small sample.",
  };
}

function buildCoachConfidence(
  shotRows: ShotRow[],
  clubRows: ClubRow[],
  practiceRows: Array<typeof practiceSessions.$inferSelect>,
) {
  const score = clamp(
    Math.round(
      (shotRows.length / 80) * 70 +
        (clubRows.length / 10) * 20 +
        Math.min(10, practiceRows.length * 2),
    ),
    0,
    100,
  );
  const tone: FeatureInsight["tone"] = score >= 80 ? "green" : score >= 45 ? "amber" : "pink";

  return {
    title: "Coach confidence",
    metric: score >= 80 ? "High" : score >= 45 ? "Medium" : "Low",
    detail:
      score >= 80
        ? "80+ shots and practice history make the recommendation reliable."
        : `Needs ${Math.max(0, 80 - shotRows.length)} more shots for high confidence.`,
    href: "/coach",
    tone,
    score,
  };
}

function buildPracticePlan(
  bagAlerts: FeatureInsight[],
  clubIdentities: ReturnType<typeof buildClubIdentities>,
  practiceRows: Array<typeof practiceSessions.$inferSelect>,
) {
  const completedSourceIds = new Set(
    practiceRows.map((session) => session.sourceId).filter(Boolean),
  );
  const primaryClub = clubIdentities[0] ?? null;
  const alerts = bagAlerts.filter((alert) => alert.tone !== "green");
  const plan = [
    {
      id: "twenty-minute-plan",
      title: primaryClub ? `${primaryClub.name} 20-minute plan` : "20-minute baseline plan",
      detail: primaryClub
        ? `Use this club for a tight stock-window drill. Dangerous miss: ${primaryClub.dangerousMiss}.`
        : "Record a clean 12-shot baseline.",
      targetShots: 12,
      focusArea: "stock-window",
      clubId: primaryClub?.clubId ?? null,
      clubType: primaryClub?.clubType ?? null,
      status: completedSourceIds.has("twenty-minute-plan") ? "complete" : "ready",
    },
    ...alerts.slice(0, 2).map((alert, index) => ({
      id: `bag-alert-${index}`,
      title: alert.title,
      detail: alert.detail,
      targetShots: 10,
      focusArea: "bag-fitting",
      clubId: null,
      clubType: null,
      status: completedSourceIds.has(`bag-alert-${index}`) ? "complete" : "ready",
    })),
  ];

  return plan.slice(0, 3);
}

function buildPracticeCalendar(
  practiceRows: Array<typeof practiceSessions.$inferSelect>,
  practicePlan: ReturnType<typeof buildPracticePlan>,
) {
  const planned = practiceRows
    .filter((session) => session.plannedAt || session.completedAt)
    .slice(0, 5)
    .map((session) => ({
      title: session.title,
      date: session.completedAt ?? session.plannedAt ?? session.createdAt,
      status: session.status,
    }));

  if (planned.length > 0) {
    return planned;
  }

  const today = new Date();
  return practicePlan.map((plan, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index * 2);
    return { title: plan.title, date, status: "suggested" };
  });
}

function buildCourseRecordGoals(
  goals: Array<typeof courseRecordGoals.$inferSelect>,
  records: Array<typeof courseRecords.$inferSelect>,
  results: Array<typeof courseRecordResults.$inferSelect>,
  friendTargets: FriendTargetOption[],
) {
  const recordById = new Map(records.map((record) => [record.id, record]));
  const friendById = new Map(friendTargets.map((friend) => [friend.userId, friend]));
  const resultsByRecord = new Map<string, Array<typeof courseRecordResults.$inferSelect>>();
  for (const result of results) {
    resultsByRecord.set(result.recordId, [...(resultsByRecord.get(result.recordId) ?? []), result]);
  }

  if (!goals.length) {
    return [
      {
        title: "Set a course-record goal",
        metric: "No goals",
        detail: "Pick a course record, set a target, and enable notify-when-beaten.",
        href: "/course-records",
        tone: "slate" as const,
      },
    ];
  }

  return goals.map((goal) => {
    const record = recordById.get(goal.recordId);
    const sortedResults = (resultsByRecord.get(goal.recordId) ?? []).sort(
      (left, right) => (left.rank ?? 999) - (right.rank ?? 999),
    );
    const leader = sortedResults[0];
    const targetFriend = goal.targetUserId ? friendById.get(goal.targetUserId) : null;
    const friendResult = goal.targetUserId
      ? sortedResults.find((result) => result.userId === goal.targetUserId)
      : null;
    const targetText = targetFriend
      ? friendResult
        ? `Friend target: ${targetFriend.label} at ${friendResult.scoreLabel}.`
        : `Friend target: ${targetFriend.label}.`
      : goal.targetValue
        ? `Target value: ${numberFormatter.format(goal.targetValue)}.`
        : null;

    return {
      title: goal.targetLabel ?? `Record goal ${record?.recordType ?? ""}`.trim(),
      metric: goal.notifyWhenBeaten ? "Notify on" : "Tracking",
      detail: [
        leader ? `Current leader: ${leader.scoreLabel}.` : "No current result on this board.",
        targetText,
      ]
        .filter(Boolean)
        .join(" "),
      href: `/course-records/${goal.recordId}`,
      tone: "green" as const,
    };
  });
}

function buildFriendTargetOptions(
  friendIds: string[],
  profileRows: Array<typeof userProfiles.$inferSelect>,
): FriendTargetOption[] {
  const friendSet = new Set(friendIds);
  return profileRows
    .filter((profile) => friendSet.has(profile.userId))
    .map((profile) => ({
      userId: profile.userId,
      label: profile.displayName || profile.username,
      username: profile.username,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function buildCourseFollows(
  follows: Array<typeof courseFollows.$inferSelect>,
  courseRows: Array<typeof courses.$inferSelect>,
  aliases: Array<typeof courseProviderAliases.$inferSelect>,
) {
  const courseById = new Map(courseRows.map((course) => [course.id, course]));
  const aliasesByCourse = new Map<string, number>();
  for (const alias of aliases) {
    aliasesByCourse.set(alias.courseId, (aliasesByCourse.get(alias.courseId) ?? 0) + 1);
  }

  return follows.length
    ? follows.map((follow) => ({
        title: courseById.get(follow.courseId)?.name ?? "Followed course",
        metric: follow.notifyRecords ? "Record alerts" : "Following",
        detail: `${integerFormatter.format(aliasesByCourse.get(follow.courseId) ?? follow.providerAliasesJson.length)} provider aliases saved.`,
        href: `/courses/${follow.courseId}/records`,
        tone: "green" as const,
      }))
    : [
        {
          title: "Course follow/favourite",
          metric: "No courses",
          detail: "Follow a course to get beaten-record prompts and provider alias matching.",
          href: "/courses",
          tone: "slate" as const,
        },
      ];
}

function buildTournamentChecklist(
  entries: Array<typeof tournamentEntries.$inferSelect>,
  tournamentRows: Array<typeof tournaments.$inferSelect>,
  submissions: Array<typeof tournamentSubmissions.$inferSelect>,
): Array<FeatureInsight & { status: "empty" | "complete" | "due" }> {
  const tournamentById = new Map(tournamentRows.map((tournament) => [tournament.id, tournament]));

  if (!entries.length) {
    return [
      {
        title: "Tournament proof checklist",
        metric: "Not entered",
        detail: "Enter an event to track Rapsodo import, scorecard, course and date proof.",
        href: "/tournaments",
        tone: "slate",
        status: "empty",
      },
    ];
  }

  return entries.slice(0, 4).map((entry) => {
    const tournament = tournamentById.get(entry.tournamentId);
    const completedRounds = submissions.filter(
      (submission) => submission.entryId === entry.id,
    ).length;
    const requiredRounds = tournament?.roundCount ?? 1;
    const due = Math.max(0, requiredRounds - completedRounds);

    return {
      title: tournament?.title ?? "Tournament entry",
      metric: due === 0 ? "Complete" : `${due} due`,
      detail:
        due === 0
          ? "All required rounds submitted."
          : `${completedRounds}/${requiredRounds} rounds submitted. Check Rapsodo import, scorecard screenshot, course match and date match.`,
      href: "/tournaments",
      tone: due === 0 ? "green" : "amber",
      status: due === 0 ? "complete" : "due",
    };
  });
}

function practicePlanToInsight(plan: ReturnType<typeof buildPracticePlan>[number]): FeatureInsight {
  return {
    title: plan.title,
    metric: plan.status === "complete" ? "Done" : "Practice",
    detail: plan.detail,
    href: plan.clubId ? `/bag/${plan.clubId}/analytics` : "/coach",
    tone: plan.status === "complete" ? "green" : "sky",
  };
}

function buildDashboardActions(input: {
  importQuality: FeatureInsight;
  providerHealth: FeatureInsight[];
  bagAlerts: FeatureInsight[];
  practicePlan: ReturnType<typeof buildPracticePlan>;
  tournamentChecklist: Array<FeatureInsight & { status?: string }>;
  waysToClimb: FeatureInsight[];
}): FeatureInsight[] {
  const rapsodo =
    input.providerHealth.find((item) => /rapsodo/i.test(item.title)) ?? input.providerHealth[0];
  const tournamentDue =
    input.tournamentChecklist.find((item) => /due/i.test(item.metric ?? "")) ??
    input.tournamentChecklist[0];
  const gapAlert =
    input.bagAlerts.find((item) => /wide gap/i.test(item.title)) ?? input.bagAlerts[0];
  const practiceInsight = input.practicePlan[0]
    ? practicePlanToInsight(input.practicePlan[0])
    : null;

  return [
    input.waysToClimb[0],
    gapAlert,
    tournamentDue,
    input.importQuality,
    rapsodo,
    practiceInsight,
  ].filter(Boolean) as FeatureInsight[];
}

function buildWaysToClimb(input: {
  importQuality: FeatureInsight;
  providerHealth: FeatureInsight[];
  practicePlan: ReturnType<typeof buildPracticePlan>;
  tournamentChecklist: FeatureInsight[];
  challengeRows: Array<typeof challenges.$inferSelect>;
}): FeatureInsight[] {
  return [
    {
      title: "Submit latest round",
      metric: input.tournamentChecklist.some((item) => item.metric !== "Complete")
        ? "Due"
        : "Ready",
      detail: "A verified round moves tournament and course-record boards fastest.",
      href: "/rounds",
      tone: input.tournamentChecklist.some((item) => item.metric !== "Complete")
        ? "amber"
        : "green",
    },
    {
      title: "Enter Wedge Window",
      metric: input.challengeRows.some((challenge) => /wedge/i.test(challenge.title))
        ? "Live"
        : "Open",
      detail: "A daily micro-challenge can move your friends board without a full round.",
      href: "/challenges",
      tone: "sky",
    },
    {
      title: "Verify import proof",
      metric: input.importQuality.metric,
      detail: "Higher proof tiers make leaderboard movement stick.",
      href: "/import",
      tone: input.importQuality.tone,
    },
  ];
}

function buildDailyMicroChallenges(
  practicePlan: ReturnType<typeof buildPracticePlan>,
  challengeRows: Array<typeof challenges.$inferSelect>,
) {
  const liveTitles = new Set(
    challengeRows
      .filter((challenge) => challenge.status === "open")
      .map((challenge) => challenge.title),
  );
  return [
    {
      title: "12-shot wedge window",
      detail: "Keep carry inside a 10-yard window.",
      status: liveTitles.has("12-shot wedge window") ? "live" : "suggested",
    },
    {
      title: "10 fairway finders",
      detail: "Score one point for each playable tee shot.",
      status: liveTitles.has("10 fairway finders") ? "live" : "suggested",
    },
    {
      title: practicePlan[0]?.title ?? "7i consistency",
      detail: practicePlan[0]?.detail ?? "Build a clean consistency sample.",
      status: practicePlan[0]?.status ?? "suggested",
    },
  ];
}

function buildCoachChallengeRecommendation(practicePlan: ReturnType<typeof buildPracticePlan>) {
  const top = practicePlan[0];
  return {
    title: top?.title ?? "Coach challenge recommendation",
    detail: top?.detail ?? "Import more shots to generate a challenge from your coach signal.",
    clubId: top?.clubId ?? null,
    clubType: top?.clubType ?? null,
    focusArea: top?.focusArea ?? "practice",
    href: "/challenges",
  };
}

function buildSocialFeatures(
  preferences: FeaturePreferenceRow,
  profile: typeof userProfiles.$inferSelect | null,
  feedRows: Array<typeof feedItems.$inferSelect>,
  clubIdentities: ReturnType<typeof buildClubIdentities>,
  recordGoalCount: number,
) {
  const completenessChecks = [
    Boolean(profile?.avatarUrl),
    Boolean(profile?.headerImageUrl),
    Boolean(profile?.bio),
    Boolean(profile?.homeCourse),
    Boolean(profile?.primaryLaunchMonitor),
    clubIdentities.length > 0,
    recordGoalCount > 0,
  ];
  const completeCount = completenessChecks.filter(Boolean).length;
  const latestHighlight =
    feedRows.find((item) => item.itemType.includes("pb") || item.itemType.includes("record")) ??
    feedRows[0] ??
    null;

  return {
    autoShare: {
      rounds: preferences.autoShareRounds,
      pbs: preferences.autoSharePbs,
      achievements: preferences.autoShareAchievements,
      practice: preferences.autoSharePractice,
    },
    highlightOfWeek: latestHighlight
      ? {
          title: latestHighlight.headline,
          metric: latestHighlight.metricValue ?? latestHighlight.metricLabel ?? "Highlight",
          href: "/feed",
        }
      : {
          title: "Highlight of the week",
          metric: "Waiting",
          href: "/feed",
        },
    profileCompleteness: {
      metric: `${Math.round((completeCount / completenessChecks.length) * 100)}%`,
      detail: `${completeCount}/${completenessChecks.length} identity pieces complete.`,
      href: "/profile",
    },
    featuredRecords: preferences.featuredRecordIdsJson.length,
    publicSharePreview: preferences.publicSharePreview,
  };
}

function buildGroupDigest(
  groupRows: Array<typeof groups.$inferSelect>,
  posts: Array<typeof groupPosts.$inferSelect>,
  challengeLinks: Array<typeof groupChallengeLinks.$inferSelect>,
) {
  return groupRows.length
    ? groupRows.slice(0, 4).map((group) => ({
        title: group.name,
        metric: `${integerFormatter.format(posts.filter((post) => post.groupId === group.id).length)} posts`,
        detail: `${integerFormatter.format(challengeLinks.filter((link) => link.groupId === group.id).length)} linked challenges this week.`,
        href: `/groups/${group.slug}`,
        tone: "green" as const,
      }))
    : [
        {
          title: "Group weekly digest",
          metric: "No groups",
          detail: "Join or create a group to receive PB, challenge and course-champion summaries.",
          href: "/groups",
          tone: "slate" as const,
        },
      ];
}

function groupShotsByClub(shotRows: ShotRow[]) {
  const map = new Map<string, ShotRow[]>();
  for (const shot of shotRows) {
    map.set(shot.clubId, [...(map.get(shot.clubId) ?? []), shot]);
  }
  return map;
}

function latestStockRows(stockRows: StockRow[]) {
  const map = new Map<string, StockRow>();
  for (const row of stockRows) {
    if (!map.has(row.clubId)) {
      map.set(row.clubId, row);
    }
  }
  return map;
}

function defaultSavedViews(shotRows: ShotRow[]) {
  const lastThirty = new Date();
  lastThirty.setDate(lastThirty.getDate() - 30);
  return [
    {
      id: "driver-misses",
      name: "Driver misses",
      description: "Tee shots with meaningful offline movement.",
      href: "/shots?club=driver",
      pinned: false,
    },
    {
      id: "wedge-window",
      name: "Wedge window",
      description: "Short-game and wedge carry control.",
      href: "/shots?q=wedge",
      pinned: false,
    },
    {
      id: "last-30-days",
      name: "Last 30 days",
      description: `${integerFormatter.format(shotRows.filter((shot) => shot.shotAt >= lastThirty).length)} recent shots.`,
      href: `/shots?from=${lastThirty.toISOString().slice(0, 10)}`,
      pinned: false,
    },
  ];
}

function queryStringFromFilter(value: Record<string, unknown>) {
  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "string" && raw.trim()) {
      params.set(key, raw.trim());
    }
  }
  return params.toString();
}

function primaryMissLabel(shotRows: ShotRow[]) {
  const sideValues = shotRows
    .map((shot) => shot.sideCarryYd)
    .filter((value): value is number => typeof value === "number");
  if (!sideValues.length) {
    return "Needs dispersion data";
  }
  const average = sideValues.reduce((sum, value) => sum + value, 0) / sideValues.length;
  if (average > 8) {
    return "Right miss";
  }
  if (average < -8) {
    return "Left miss";
  }
  return "Mostly straight";
}

function clubPurpose(clubType: string, stockCarry: number | null) {
  const normalized = clubType.toLowerCase();
  if (normalized.includes("driver") || normalized.includes("wood")) {
    return "Tee shot distance";
  }
  if (normalized.includes("w") || normalized.includes("pw") || normalized.includes("sw")) {
    return stockCarry ? `${Math.round(stockCarry)} yd scoring window` : "Scoring window";
  }
  if (normalized.includes("putter")) {
    return "Scoring control";
  }
  return stockCarry ? `${Math.round(stockCarry)} yd stock approach` : "Stock approach";
}

function isRoundLike(session: SessionRow) {
  return (
    session.type === "round" ||
    session.type === "course" ||
    session.type === "scorecard" ||
    session.type === "sim_round"
  );
}

function roundScore(session: SessionRow) {
  const holes = session.scorecardJson ?? [];
  const scores = holes
    .map((hole) => hole.score)
    .filter((score): score is number => typeof score === "number");
  return scores.length ? scores.reduce((sum, score) => sum + score, 0) : null;
}

function bestClubThisWeek(shotRows: ShotRow[]) {
  if (!shotRows.length) {
    return "No shots yet";
  }
  const counts = new Map<string, number>();
  for (const shot of shotRows) {
    counts.set(shot.clubType, (counts.get(shot.clubType) ?? 0) + 1);
  }
  const [clubType] = [...counts.entries()].sort((left, right) => right[1] - left[1])[0] ?? ["", 0];
  return clubType ? formatClubType(clubType) : "Mixed bag";
}

function currentWeekWindow(now: Date) {
  const start = new Date(now);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  end.setMilliseconds(-1);
  return { start, end };
}

function sameDateKey(left: Date, right: Date) {
  return left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10);
}

function relativeDate(date: Date) {
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) {
    return "today";
  }
  if (days === 1) {
    return "yesterday";
  }
  return `${days} days ago`;
}

function providerLabel(provider: string) {
  if (provider === "manual_csv") {
    return "Manual CSV";
  }
  return provider.slice(0, 1).toUpperCase() + provider.slice(1);
}

function readResponseText(payload: unknown) {
  if (isRecord(payload) && typeof payload.output_text === "string") {
    return payload.output_text;
  }

  if (!isRecord(payload) || !Array.isArray(payload.output)) {
    throw new Error("OpenAI response did not include text.");
  }

  const chunks: string[] = [];

  for (const item of payload.output) {
    if (!isRecord(item) || !Array.isArray(item.content)) {
      continue;
    }

    for (const content of item.content) {
      if (isRecord(content) && typeof content.text === "string") {
        chunks.push(content.text);
      }
    }
  }

  const text = chunks.join("\n").trim();

  if (!text) {
    throw new Error("OpenAI response did not include text.");
  }

  return text;
}

function extractJson(text: string) {
  const trimmed = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "");
  const jsonText = trimmed.startsWith("{") ? trimmed : trimmed.match(/\{[\s\S]*\}/)?.[0];

  if (!jsonText) {
    throw new Error("Response did not include JSON.");
  }

  return jsonText;
}

function stringFromRecord(value: Record<string, unknown>, key: string) {
  const item = value[key];
  return typeof item === "string" && item.trim() ? item.trim() : null;
}

function arrayOfStringsFromRecord(value: Record<string, unknown>, key: string) {
  const item = value[key];
  return Array.isArray(item)
    ? item.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normaliseCourseName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|golf|club|course|links)\b/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function titleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function clean(value: string | null | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function cleanNullable(value: string | null | undefined) {
  return value?.trim() || null;
}

function boundedInteger(
  value: number | null | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  return clamp(Math.round(Number.isFinite(value) ? Number(value) : fallback), min, max);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
