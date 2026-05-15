import "server-only";

import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  courseProviderAliases,
  courseRecordAttempts,
  courseRecordCategories,
  courseRecordEvidence,
  courseRecordResults,
  courseRecords,
  courses,
  moderationEvents,
  rapsodoSyncSessions,
  sessions,
  teeSets,
  userAchievements,
  userProfiles,
  xpLedger,
} from "@/db/schema";
import { getDb } from "@/db/client";
import { requireCurrentUserId } from "@/lib/current-user";
import { calculateRoundDifferential } from "@/lib/round-handicap";
import { verifyScorecardProofToken } from "@/lib/scorecard-proof-token";
import {
  areFriends,
  createFeedItem,
  ensureSocialProfileForUser,
  getFriendIds,
  parseVisibility,
} from "@/lib/social";

export const courseRecordTypes = [
  "best_gross_score",
  "best_net_score",
  "best_stableford",
  "best_front_nine",
  "best_back_nine",
  "lowest_differential",
  "most_birdies",
  "fewest_putts",
  "longest_drive",
  "closest_to_pin",
  "best_hole_score",
  "wedge_ladder",
  "seven_iron_consistency",
] as const;

export const verificationStates = [
  "pending_evidence",
  "verified",
  "mismatch",
  "needs_review",
  "rejected",
  "manual_only",
] as const;

export const verificationTiers = ["gold", "silver", "bronze", "manual", "unverified"] as const;

export type CourseRecordType = (typeof courseRecordTypes)[number];
export type VerificationState = (typeof verificationStates)[number];
export type VerificationTier = (typeof verificationTiers)[number];
export type RecordScope = "public" | "friends" | "group" | "private";
export type RecordPeriod = "all_time" | "year" | "month" | "week" | "event";
export type ScoringDirection = "asc" | "desc";

export type VerificationInput = {
  expectedScore: number | null;
  extractedScorecardTotal?: number | null;
  hasRapsodoDirect?: boolean;
  hasCsvHash?: boolean;
  hasScorecardScreenshot?: boolean;
  courseMatches?: boolean;
  dateMatches?: boolean;
  teeMatches?: boolean;
  duplicateImport?: boolean;
  manualEdit?: boolean;
  screenshotRequired?: boolean;
  directRapsodoRequired?: boolean;
};

export type VerificationDecision = {
  status: VerificationState;
  tier: VerificationTier;
  proofStatus: VerificationState;
  reasons: string[];
};

export type RankableRecordAttempt = {
  id: string;
  userId: string;
  metricValue: number;
  verificationStatus: string;
  verificationTier: string;
  submittedAt: Date;
};

export type RankedRecordResult = RankableRecordAttempt & {
  rank: number;
};

type SessionRow = typeof sessions.$inferSelect;
type TeeSetRow = typeof teeSets.$inferSelect;
type RapsodoSyncRow = typeof rapsodoSyncSessions.$inferSelect;
type ScorecardHole = NonNullable<SessionRow["scorecardJson"]>[number];

type RoundRecordSummary = {
  totalScore: number | null;
  totalNetScore: number | null;
  stablefordPoints: number | null;
  frontNineScore: number | null;
  backNineScore: number | null;
  birdies: number | null;
  putts: number | null;
  bestHoleScore: number | null;
  differential: number | null;
  holeCount: number;
};

const numberFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
const integerFormatter = new Intl.NumberFormat("en-GB");

const defaultCategories: Array<{
  slug: string;
  name: string;
  description: string;
  recordType: CourseRecordType;
  metricKind: string;
  scoringDirection: ScoringDirection;
  verificationRequired: VerificationTier;
  sortOrder: number;
  unit: string;
}> = [
  {
    slug: "best-gross-score",
    name: "Best gross score",
    description: "Lowest verified gross score for this course and tee.",
    recordType: "best_gross_score",
    metricKind: "strokes",
    scoringDirection: "asc",
    verificationRequired: "silver",
    sortOrder: 10,
    unit: "strokes",
  },
  {
    slug: "best-net-score",
    name: "Best net score",
    description: "Lowest verified net score for this course and tee.",
    recordType: "best_net_score",
    metricKind: "strokes",
    scoringDirection: "asc",
    verificationRequired: "silver",
    sortOrder: 20,
    unit: "strokes",
  },
  {
    slug: "best-stableford",
    name: "Best Stableford",
    description: "Highest verified Stableford points total.",
    recordType: "best_stableford",
    metricKind: "points",
    scoringDirection: "desc",
    verificationRequired: "silver",
    sortOrder: 30,
    unit: "pts",
  },
  {
    slug: "best-front-nine",
    name: "Best front nine",
    description: "Lowest verified front-nine score.",
    recordType: "best_front_nine",
    metricKind: "strokes",
    scoringDirection: "asc",
    verificationRequired: "silver",
    sortOrder: 40,
    unit: "strokes",
  },
  {
    slug: "best-back-nine",
    name: "Best back nine",
    description: "Lowest verified back-nine score.",
    recordType: "best_back_nine",
    metricKind: "strokes",
    scoringDirection: "asc",
    verificationRequired: "silver",
    sortOrder: 50,
    unit: "strokes",
  },
  {
    slug: "lowest-differential",
    name: "Lowest differential",
    description: "Lowest handicap differential on this tee set.",
    recordType: "lowest_differential",
    metricKind: "differential",
    scoringDirection: "asc",
    verificationRequired: "silver",
    sortOrder: 60,
    unit: "diff",
  },
  {
    slug: "most-birdies",
    name: "Most birdies",
    description: "Most birdies in a verified round.",
    recordType: "most_birdies",
    metricKind: "count",
    scoringDirection: "desc",
    verificationRequired: "silver",
    sortOrder: 70,
    unit: "birdies",
  },
  {
    slug: "fewest-putts",
    name: "Fewest putts",
    description: "Fewest putts in a verified round.",
    recordType: "fewest_putts",
    metricKind: "count",
    scoringDirection: "asc",
    verificationRequired: "silver",
    sortOrder: 80,
    unit: "putts",
  },
  {
    slug: "longest-drive",
    name: "Longest drive",
    description: "Longest verified drive on this course.",
    recordType: "longest_drive",
    metricKind: "yards",
    scoringDirection: "desc",
    verificationRequired: "gold",
    sortOrder: 90,
    unit: "yd",
  },
  {
    slug: "closest-to-pin",
    name: "Closest to pin",
    description: "Closest verified approach to the pin.",
    recordType: "closest_to_pin",
    metricKind: "yards",
    scoringDirection: "asc",
    verificationRequired: "gold",
    sortOrder: 100,
    unit: "yd",
  },
  {
    slug: "best-hole-score",
    name: "Best hole score",
    description: "Best score on any mapped hole.",
    recordType: "best_hole_score",
    metricKind: "strokes",
    scoringDirection: "asc",
    verificationRequired: "silver",
    sortOrder: 110,
    unit: "strokes",
  },
  {
    slug: "wedge-ladder",
    name: "Wedge ladder",
    description: "Best verified wedge ladder score.",
    recordType: "wedge_ladder",
    metricKind: "score",
    scoringDirection: "asc",
    verificationRequired: "gold",
    sortOrder: 120,
    unit: "error",
  },
  {
    slug: "seven-iron-consistency",
    name: "7-iron consistency",
    description: "Tightest verified 7-iron carry pattern.",
    recordType: "seven_iron_consistency",
    metricKind: "yards",
    scoringDirection: "asc",
    verificationRequired: "gold",
    sortOrder: 130,
    unit: "yd spread",
  },
];

export function evaluateVerification(input: VerificationInput): VerificationDecision {
  const reasons: string[] = [];
  const hasDirect = Boolean(input.hasRapsodoDirect);
  const hasCsv = Boolean(input.hasCsvHash);
  const hasScreenshot = Boolean(input.hasScorecardScreenshot);
  const expectedScore = input.expectedScore;
  const extractedTotal = input.extractedScorecardTotal ?? null;

  if (input.duplicateImport) {
    reasons.push("Duplicate import hash");
  }

  if (input.courseMatches === false) {
    reasons.push("Course mismatch");
  }

  if (input.dateMatches === false) {
    reasons.push("Date outside event window");
  }

  if (input.teeMatches === false) {
    reasons.push("Tee set mismatch");
  }

  if (typeof expectedScore === "number" && typeof extractedTotal === "number" && expectedScore !== extractedTotal) {
    reasons.push(`Scorecard total ${extractedTotal} does not match submitted ${expectedScore}`);
  }

  if (input.directRapsodoRequired && !hasDirect) {
    reasons.push("Direct Rapsodo import required");
  }

  if (input.screenshotRequired && !hasScreenshot) {
    reasons.push("Scorecard screenshot required");
  }

  if (input.manualEdit) {
    reasons.push("Manual edits flagged");
  }

  if (reasons.some((reason) => /mismatch|does not match|duplicate|outside|required|manual edits/i.test(reason))) {
    return {
      status: /required/i.test(reasons.join(" ")) && !hasDirect && !hasCsv && !hasScreenshot ? "pending_evidence" : "mismatch",
      tier: hasDirect ? "gold" : hasCsv ? "silver" : hasScreenshot ? "bronze" : "manual",
      proofStatus: "needs_review",
      reasons,
    };
  }

  if (hasDirect && hasScreenshot) {
    return { status: "verified", tier: "gold", proofStatus: "verified", reasons: ["Rapsodo Cloud and screenshot matched"] };
  }

  if (hasCsv && hasScreenshot) {
    return { status: "verified", tier: "silver", proofStatus: "verified", reasons: ["CSV hash and screenshot matched"] };
  }

  if (hasScreenshot) {
    return { status: "manual_only", tier: "bronze", proofStatus: "manual_only", reasons: ["Screenshot only"] };
  }

  if (!hasDirect && !hasCsv && !hasScreenshot) {
    return { status: "manual_only", tier: "manual", proofStatus: "manual_only", reasons: ["Manual score only"] };
  }

  return { status: "pending_evidence", tier: "unverified", proofStatus: "pending_evidence", reasons: ["More evidence required"] };
}

export function rankRecordAttempts(
  attempts: RankableRecordAttempt[],
  scoringDirection: ScoringDirection,
): RankedRecordResult[] {
  const verifiedAttempts = attempts.filter((attempt) => isBoardEligibleStatus(attempt.verificationStatus));
  const bestByUser = new Map<string, RankableRecordAttempt>();

  for (const attempt of verifiedAttempts) {
    const current = bestByUser.get(attempt.userId);

    if (!current || compareAttempts(attempt, current, scoringDirection) < 0) {
      bestByUser.set(attempt.userId, attempt);
    }
  }

  return [...bestByUser.values()]
    .sort((left, right) => compareAttempts(left, right, scoringDirection))
    .map((attempt, index) => ({
      ...attempt,
      rank: index + 1,
    }));
}

export function isVerifiedStatus(status: string) {
  return status === "verified";
}

export function isBoardEligibleStatus(status: string) {
  return status === "verified";
}

export function verificationTierLabel(tier: string) {
  switch (tier) {
    case "gold":
      return "Gold verified";
    case "silver":
      return "Silver verified";
    case "bronze":
      return "Bronze review";
    case "manual":
      return "Manual only";
    default:
      return "Unverified";
  }
}

export function verificationTierRank(tier: string) {
  switch (tier) {
    case "gold":
      return 4;
    case "silver":
      return 3;
    case "bronze":
      return 2;
    case "manual":
      return 1;
    default:
      return 0;
  }
}

export async function getCourseRecordsHubData() {
  const viewerUserId = await requireCurrentUserId();
  await ensureDefaultCourseRecordCategories();
  const db = getDb();
  const allCourseRows = await db
    .select()
    .from(courses)
    .where(or(eq(courses.visibility, "shared"), eq(courses.createdByUserId, viewerUserId)))
    .orderBy(asc(courses.name))
    .limit(80);
  const allCourseIds = allCourseRows.map((course) => course.id);
  const sessionCountRows =
    allCourseIds.length > 0
      ? await db
          .select({
            courseId: sessions.courseId,
            count: sql<number>`count(*)::int`,
          })
          .from(sessions)
          .where(and(eq(sessions.userId, viewerUserId), inArray(sessions.courseId, allCourseIds)))
          .groupBy(sessions.courseId)
      : [];
  const sessionCounts = new Map(
    sessionCountRows
      .filter((row): row is { courseId: string; count: number } => Boolean(row.courseId))
      .map((row) => [row.courseId, Number(row.count)]),
  );
  const courseRows = dedupeCoursesByName(allCourseRows, sessionCounts);

  for (const course of courseRows.slice(0, 12)) {
    await ensureCourseRecordBoards(course.id, viewerUserId);
  }

  const visibleCourseIds = courseRows.map((course) => course.id);
  const [recordRows, resultRows, teeRows] =
    visibleCourseIds.length > 0
      ? await Promise.all([
          db.select().from(courseRecords).where(inArray(courseRecords.courseId, visibleCourseIds)),
          db
            .select({
              result: courseRecordResults,
              record: courseRecords,
              profile: userProfiles,
            })
            .from(courseRecordResults)
            .innerJoin(courseRecords, eq(courseRecordResults.recordId, courseRecords.id))
            .leftJoin(userProfiles, eq(courseRecordResults.userId, userProfiles.userId))
            .where(and(inArray(courseRecords.courseId, visibleCourseIds), eq(courseRecordResults.rank, 1))),
          db.select().from(teeSets).where(inArray(teeSets.courseId, visibleCourseIds)),
        ])
      : [[], [], []];
  const recordsByCourse = countBy(recordRows.map((record) => record.courseId));
  const teeByCourse = countBy(teeRows.map((teeSet) => teeSet.courseId));
  const leaderByCourse = new Map<string, (typeof resultRows)[number]>();

  for (const row of resultRows) {
    if (!leaderByCourse.has(row.record.courseId)) {
      leaderByCourse.set(row.record.courseId, row);
    }
  }

  return {
    courses: courseRows.map((course) => {
      const leader = leaderByCourse.get(course.id);

      return {
        ...course,
        recordCount: recordsByCourse.get(course.id) ?? 0,
        teeSetCount: teeByCourse.get(course.id) ?? 0,
        liveAttemptCount: recordRows.filter((record) => record.courseId === course.id).length,
        champion: leader?.profile
          ? {
              displayName: leader.profile.displayName,
              username: leader.profile.username,
              scoreLabel: leader.result.scoreLabel,
              verificationTier: leader.result.verificationTier,
            }
          : null,
      };
    }),
    totalRecords: recordRows.length,
    verifiedChampions: resultRows.filter((row) => row.result.verificationStatus === "verified").length,
  };
}

export async function getCourseRecordCourseData(courseId: string, activeTab: "all_time" | "month" | "friends" | "holes" = "all_time") {
  const viewerUserId = await requireCurrentUserId();
  await ensureDefaultCourseRecordCategories();
  await ensureCourseRecordBoards(courseId, viewerUserId);
  const db = getDb();
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);

  if (!course) {
    return null;
  }

  const [teeRows, categoryRows, recordRows, resultRows, viewerAttemptRows, previousRoundRows, friendIds] = await Promise.all([
    db.select().from(teeSets).where(eq(teeSets.courseId, courseId)).orderBy(asc(teeSets.name)),
    db.select().from(courseRecordCategories).where(eq(courseRecordCategories.active, true)).orderBy(asc(courseRecordCategories.sortOrder)),
    db.select().from(courseRecords).where(eq(courseRecords.courseId, courseId)).orderBy(asc(courseRecords.createdAt)),
    db
      .select({
        result: courseRecordResults,
        record: courseRecords,
        profile: userProfiles,
      })
      .from(courseRecordResults)
      .innerJoin(courseRecords, eq(courseRecordResults.recordId, courseRecords.id))
      .leftJoin(userProfiles, eq(courseRecordResults.userId, userProfiles.userId))
      .where(eq(courseRecords.courseId, courseId))
      .orderBy(asc(courseRecordResults.rank)),
    db
      .select()
      .from(courseRecordAttempts)
      .where(and(eq(courseRecordAttempts.courseId, courseId), eq(courseRecordAttempts.userId, viewerUserId)))
      .orderBy(desc(courseRecordAttempts.submittedAt))
      .limit(40),
    db
      .select({
        session: sessions,
        teeSet: teeSets,
        sync: rapsodoSyncSessions,
      })
      .from(sessions)
      .leftJoin(teeSets, eq(sessions.teeSetId, teeSets.id))
      .leftJoin(rapsodoSyncSessions, eq(sessions.id, rapsodoSyncSessions.importedSessionId))
      .where(and(eq(sessions.userId, viewerUserId), eq(sessions.courseId, courseId)))
      .orderBy(desc(sessions.date))
      .limit(8),
    getFriendIds(viewerUserId),
  ]);
  const categoryById = new Map(categoryRows.map((category) => [category.id, category]));
  const filteredRecords = recordRows.filter((record) => {
    if (activeTab === "month") {
      return record.period === "month";
    }

    if (activeTab === "friends") {
      return record.scope === "friends";
    }

    if (activeTab === "holes") {
      return record.recordType === "best_hole_score" || record.recordType === "closest_to_pin" || record.recordType === "longest_drive";
    }

    return record.period === "all_time" && record.scope === "public";
  });
  const recordCards = filteredRecords
    .map((record) => {
      const category = categoryById.get(record.categoryId);
      const leaders = resultRows.filter((row) => row.record.id === record.id);
      const champion = leaders.find((row) => row.result.rank === 1) ?? leaders[0] ?? null;
      const friendToBeat = leaders.find((row) => row.profile && friendIds.includes(row.profile.userId)) ?? null;
      const viewerBest = leaders.find((row) => row.result.userId === viewerUserId) ?? null;

      return category
        ? {
            record,
            category,
            champion,
            friendToBeat,
            viewerBest,
          }
        : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const championCard = recordCards.find((card) => card.champion?.result.verificationStatus === "verified") ?? recordCards.find((card) => card.champion) ?? null;
  const bestViewerAttempt = viewerAttemptRows[0] ?? null;
  const previousRounds = previousRoundRows
    .map((row) => buildPreviousRoundSubmissionCard(row.session, row.teeSet, row.sync, recordCards))
    .filter((round): round is NonNullable<typeof round> => Boolean(round));

  return {
    viewerUserId,
    course,
    teeSets: teeRows,
    tabs: {
      allTimeCount: recordRows.filter((record) => record.period === "all_time" && record.scope === "public").length,
      monthCount: recordRows.filter((record) => record.period === "month").length,
      friendsCount: recordRows.filter((record) => record.scope === "friends").length,
      holesCount: recordRows.filter((record) => ["best_hole_score", "closest_to_pin", "longest_drive"].includes(record.recordType)).length,
    },
    recordCards,
    championCard,
    viewerBest: bestViewerAttempt,
    previousRounds,
    friendCount: friendIds.length,
  };
}

export async function getCourseRecordDetailData(recordId: string) {
  const viewerUserId = await requireCurrentUserId();
  const db = getDb();
  const [row] = await db
    .select({
      record: courseRecords,
      category: courseRecordCategories,
      course: courses,
      teeSet: teeSets,
    })
    .from(courseRecords)
    .innerJoin(courseRecordCategories, eq(courseRecords.categoryId, courseRecordCategories.id))
    .innerJoin(courses, eq(courseRecords.courseId, courses.id))
    .leftJoin(teeSets, eq(courseRecords.teeSetId, teeSets.id))
    .where(eq(courseRecords.id, recordId))
    .limit(1);

  if (!row || !(await canViewRecord(viewerUserId, row.record))) {
    return null;
  }

  const [resultRows, attemptRows, recentSessions] = await Promise.all([
    db
      .select({
        result: courseRecordResults,
        profile: userProfiles,
      })
      .from(courseRecordResults)
      .leftJoin(userProfiles, eq(courseRecordResults.userId, userProfiles.userId))
      .where(eq(courseRecordResults.recordId, recordId))
      .orderBy(asc(courseRecordResults.rank)),
    db
      .select({
        attempt: courseRecordAttempts,
        profile: userProfiles,
      })
      .from(courseRecordAttempts)
      .leftJoin(userProfiles, eq(courseRecordAttempts.userId, userProfiles.userId))
      .where(eq(courseRecordAttempts.recordId, recordId))
      .orderBy(desc(courseRecordAttempts.submittedAt))
      .limit(20),
    db
      .select({
        session: sessions,
        teeSet: teeSets,
        sync: rapsodoSyncSessions,
      })
      .from(sessions)
      .leftJoin(teeSets, eq(sessions.teeSetId, teeSets.id))
      .leftJoin(rapsodoSyncSessions, eq(sessions.id, rapsodoSyncSessions.importedSessionId))
      .where(and(eq(sessions.userId, viewerUserId), eq(sessions.courseId, row.record.courseId)))
      .orderBy(desc(sessions.date))
      .limit(20),
  ]);
  const recentRounds = recentSessions
    .map(({ session, teeSet, sync }) => {
      const summary = summarizeRound(session, teeSet);
      const metricValue = metricValueForRecordType(row.record.recordType, summary);

      if (metricValue === null) {
        return null;
      }

      return {
        id: session.id,
        date: session.date,
        courseName: session.courseName,
        fileName: session.fileName,
        type: session.type,
        source: session.source,
        teeSetName: teeSet?.name ?? null,
        rawCsvHash: session.rawCsvHash,
        hasRapsodoSync: Boolean(sync),
        totalScore: summary.totalScore,
        totalNetScore: summary.totalNetScore,
        holeCount: summary.holeCount,
        metricValue,
        metricLabel: scoreLabel(metricValue, row.category),
        proofLabel: proofLabelForRound(session, sync),
      };
    })
    .filter((round): round is NonNullable<typeof round> => Boolean(round));

  return {
    ...row,
    viewerUserId,
    results: resultRows,
    attempts: attemptRows,
    recentSessions: recentRounds,
    viewerResult: resultRows.find((result) => result.result.userId === viewerUserId) ?? null,
  };
}

export async function submitCourseRecordAttempt(input: {
  recordId: string;
  metricValue?: number | null;
  grossScore?: number | null;
  netScore?: number | null;
  stablefordPoints?: number | null;
  sessionId?: string | null;
  csvHash?: string | null;
  screenshotPath?: string | null;
  extractedScorecardTotal?: number | null;
  scorecardProofToken?: string | null;
  hasRapsodoDirect?: boolean;
  courseMatches?: boolean;
  dateMatches?: boolean;
  teeMatches?: boolean;
  manualEdit?: boolean;
}) {
  const userId = await requireCurrentUserId();
  const profile = await ensureSocialProfileForUser(userId);
  const db = getDb();
  const [recordRow] = await db
    .select({
      record: courseRecords,
      category: courseRecordCategories,
      course: courses,
    })
    .from(courseRecords)
    .innerJoin(courseRecordCategories, eq(courseRecords.categoryId, courseRecordCategories.id))
    .innerJoin(courses, eq(courseRecords.courseId, courses.id))
    .where(eq(courseRecords.id, input.recordId))
    .limit(1);

  if (!recordRow || !(await canViewRecord(userId, recordRow.record))) {
    throw new Error("Course record not found.");
  }

  const roundSubmission = input.sessionId
    ? await getRoundRecordSubmissionContext({
        userId,
        sessionId: input.sessionId,
        record: recordRow.record,
        category: recordRow.category,
      })
    : null;
  const metricValue = roundSubmission?.metricValue ?? input.metricValue ?? null;
  const grossScore = roundSubmission?.grossScore ?? input.grossScore ?? null;
  const netScore = roundSubmission?.netScore ?? input.netScore ?? null;
  const stablefordPoints = roundSubmission?.stablefordPoints ?? input.stablefordPoints ?? null;
  const csvHash = input.csvHash ?? roundSubmission?.csvHash ?? null;
  const rapsodoSyncSessionId = roundSubmission?.rapsodoSyncSessionId ?? null;
  const scorecardProof = verifyScorecardProofToken(input.scorecardProofToken, userId);
  const extractedScorecardTotal = scorecardProof?.totalScore ?? input.extractedScorecardTotal ?? null;
  const hasScorecardProof =
    Boolean(scorecardProof) &&
    typeof scorecardProof?.totalScore === "number" &&
    (input.extractedScorecardTotal === null ||
      input.extractedScorecardTotal === undefined ||
      input.extractedScorecardTotal === scorecardProof.totalScore);
  const hasRapsodoDirect = Boolean(rapsodoSyncSessionId) || (!roundSubmission && Boolean(input.hasRapsodoDirect));
  const manualEdit = input.manualEdit || (roundSubmission ? roundSubmission.session.source !== "rapsodo" : false);
  const courseMatches = roundSubmission?.courseMatches ?? input.courseMatches ?? true;
  const teeMatches = roundSubmission?.teeMatches ?? input.teeMatches ?? true;
  const dateMatches = input.dateMatches ?? true;

  if (typeof metricValue !== "number" || !Number.isFinite(metricValue)) {
    throw new Error("Choose a previous scored round for this record.");
  }
  const submittedMetricValue = metricValue;

  const [previousLeader] = await db
    .select()
    .from(courseRecordResults)
    .where(and(eq(courseRecordResults.recordId, recordRow.record.id), eq(courseRecordResults.rank, 1)))
    .limit(1);
  const previousLeaderWasFriend =
    previousLeader && previousLeader.userId !== userId ? await areFriends(userId, previousLeader.userId) : false;
  const duplicateImport = csvHash ? await hasDuplicateRecordEvidence(userId, csvHash) : false;
  const verification = evaluateVerification({
    expectedScore: scoreExpectedForRecord(recordRow.record.recordType, {
      metricValue: submittedMetricValue,
      grossScore,
      netScore,
      stablefordPoints,
    }),
    extractedScorecardTotal,
    hasRapsodoDirect,
    hasCsvHash: Boolean(csvHash),
    hasScorecardScreenshot: hasScorecardProof,
    courseMatches,
    dateMatches,
    teeMatches,
    duplicateImport,
    manualEdit,
    screenshotRequired: ["best_gross_score", "best_net_score", "best_front_nine", "best_back_nine"].includes(recordRow.record.recordType),
    directRapsodoRequired: recordRow.record.verificationRequired === "gold",
  });
  const now = new Date();
  const [attempt] = await db
    .insert(courseRecordAttempts)
    .values({
      recordId: recordRow.record.id,
      categoryId: recordRow.record.categoryId,
      courseId: recordRow.record.courseId,
      teeSetId: recordRow.record.teeSetId,
      userId,
      sessionId: roundSubmission?.session.id ?? input.sessionId ?? null,
      roundId: roundSubmission?.session.id ?? input.sessionId ?? null,
      score: grossScore,
      netScore,
      stablefordPoints,
      metricValue,
      metricLabel: metricLabelForCategory(recordRow.category),
      verificationStatus: verification.status,
      verificationTier: verification.tier,
      proofStatus: verification.proofStatus,
      sourceKind: hasRapsodoDirect ? "rapsodo_cloud" : csvHash ? "rapsodo_csv" : "manual_scorecard",
      metadataJson: {
        verificationReasons: verification.reasons,
        manualEdit: Boolean(manualEdit),
        derivedFromRound: Boolean(roundSubmission),
        roundScore: roundSubmission?.summary.totalScore ?? null,
      },
      submittedAt: now,
      updatedAt: now,
    })
    .returning();

  const evidenceRows = [
    hasRapsodoDirect
      ? {
          attemptId: attempt.id,
          evidenceType: "rapsodo_import",
          rapsodoSyncSessionId,
          metadataJson: { source: "rapsodo_cloud" },
          reviewStatus: verification.status === "verified" ? "approved" : "pending",
          updatedAt: now,
        }
      : null,
    csvHash
      ? {
          attemptId: attempt.id,
          evidenceType: "csv_hash",
          csvHash,
          metadataJson: { duplicateImport },
          reviewStatus: verification.status === "verified" ? "approved" : "pending",
          updatedAt: now,
        }
      : null,
    input.screenshotPath
      ? {
          attemptId: attempt.id,
          evidenceType: "scorecard_screenshot",
          storagePath: input.screenshotPath,
          extractedScorecardTotal,
          metadataJson: {
            extractedScorecardTotal,
            courseName: scorecardProof?.courseName ?? null,
            teeName: scorecardProof?.teeName ?? null,
            dateIso: scorecardProof?.dateIso ?? null,
            proofToken: Boolean(scorecardProof),
          },
          reviewStatus: verification.status === "verified" ? "approved" : "pending",
          updatedAt: now,
        }
      : null,
  ].filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (evidenceRows.length > 0) {
    await db.insert(courseRecordEvidence).values(evidenceRows);
  }

  if (verification.status === "mismatch" || verification.status === "needs_review") {
    await createRecordModerationEvent({
      attemptId: attempt.id,
      userId,
      courseName: recordRow.course.name,
      importedScore: grossScore ?? submittedMetricValue,
      extractedScore: extractedScorecardTotal,
      reasons: verification.reasons,
    });
  }

  const results = await recalculateCourseRecordResults(recordRow.record.id);
  const result = results.find((item) => item.userId === userId);

  if (verification.status === "verified" && result?.rank === 1) {
    const defendedOwnRecord = previousLeader?.userId === userId;
    const beatenExistingRecord = Boolean(previousLeader && previousLeader.userId !== userId);
    const itemType = defendedOwnRecord
      ? "course_record_defended"
      : beatenExistingRecord
        ? "course_record_beaten"
        : "course_record_set";
    const headline = defendedOwnRecord
      ? `${profile.displayName} defended Course Champion at ${recordRow.course.name}`
      : beatenExistingRecord
        ? `${profile.displayName} beat the Course Champion at ${recordRow.course.name}`
        : `${profile.displayName} became Course Champion at ${recordRow.course.name}`;

    await createFeedItem({
      userId,
      itemType,
      headline,
      metricLabel: recordRow.category.name,
      metricValue: scoreLabel(submittedMetricValue, recordRow.category),
      context: `${verificationTierLabel(verification.tier)} on the ${scopeLabel(recordRow.record.scope)} board`,
      proofUrl: `/course-records/${recordRow.record.id}`,
      sourceType: "course_record",
      sourceId: recordRow.record.id,
      visibility: parseVisibility(recordRow.record.scope, "friends"),
      verificationLabel: verificationTierLabel(verification.tier),
      dedupeKey: `course-record-${itemType}:${recordRow.record.id}:${userId}:${attempt.id}`,
    });
    await awardCourseRecordAchievement(userId, "course_champion", attempt.id, 250);
    await awardCourseRecordAchievement(userId, "first_verified_record", attempt.id, 150);
    if (defendedOwnRecord) {
      await awardCourseRecordAchievement(userId, "defended_champion", attempt.id, 300);
    }
    if (previousLeaderWasFriend) {
      await awardCourseRecordAchievement(userId, "beat_friend_record", attempt.id, 200);
    }
  }

  revalidateCourseRecordPaths(recordRow.record.courseId, recordRow.record.id);
  return attempt.id;
}

export async function recalculateCourseRecordResults(recordId: string) {
  const db = getDb();
  const [recordRow] = await db
    .select({
      record: courseRecords,
      category: courseRecordCategories,
    })
    .from(courseRecords)
    .innerJoin(courseRecordCategories, eq(courseRecords.categoryId, courseRecordCategories.id))
    .where(eq(courseRecords.id, recordId))
    .limit(1);

  if (!recordRow) {
    return [];
  }

  const attempts = await db.select().from(courseRecordAttempts).where(eq(courseRecordAttempts.recordId, recordId));
  const ranked = rankRecordAttempts(attempts, recordRow.category.scoringDirection === "desc" ? "desc" : "asc");
  const now = new Date();
  const results: Array<typeof courseRecordResults.$inferSelect> = [];

  for (const attempt of ranked) {
    const [result] = await db
      .insert(courseRecordResults)
      .values({
        recordId,
        userId: attempt.userId,
        bestAttemptId: attempt.id,
        rank: attempt.rank,
        metricValue: attempt.metricValue,
        scoreLabel: scoreLabel(attempt.metricValue, recordRow.category),
        verificationStatus: attempt.verificationStatus,
        verificationTier: attempt.verificationTier,
        status: isVerifiedStatus(attempt.verificationStatus) ? "verified" : "manual",
        tieBreakerJson: {
          verificationTier: attempt.verificationTier,
          submittedAt: attempt.submittedAt.toISOString(),
        },
        calculatedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [courseRecordResults.recordId, courseRecordResults.userId],
        set: {
          bestAttemptId: attempt.id,
          rank: attempt.rank,
          metricValue: attempt.metricValue,
          scoreLabel: scoreLabel(attempt.metricValue, recordRow.category),
          verificationStatus: attempt.verificationStatus,
          verificationTier: attempt.verificationTier,
          status: isVerifiedStatus(attempt.verificationStatus) ? "verified" : "manual",
          tieBreakerJson: {
            verificationTier: attempt.verificationTier,
            submittedAt: attempt.submittedAt.toISOString(),
          },
          calculatedAt: now,
          updatedAt: now,
        },
      })
      .returning();
    results.push(result);
  }

  await db
    .update(courseRecords)
    .set({
      bestResultId: results[0]?.id ?? null,
      updatedAt: now,
    })
    .where(eq(courseRecords.id, recordId));

  return results;
}

export async function getEligibleBoardsForSession(sessionId: string) {
  const userId = await requireCurrentUserId();
  const db = getDb();
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .limit(1);

  if (!session?.courseId) {
    return {
      courseRecords: [],
      monthlyBoards: [],
    };
  }

  await ensureCourseRecordBoards(session.courseId, userId);
  const records = await db
    .select({
      record: courseRecords,
      category: courseRecordCategories,
      course: courses,
    })
    .from(courseRecords)
    .innerJoin(courseRecordCategories, eq(courseRecords.categoryId, courseRecordCategories.id))
    .innerJoin(courses, eq(courseRecords.courseId, courses.id))
    .where(
      and(
        eq(courseRecords.courseId, session.courseId),
        session.teeSetId ? eq(courseRecords.teeSetId, session.teeSetId) : isNull(courseRecords.teeSetId),
      ),
    )
    .orderBy(asc(courseRecordCategories.sortOrder))
    .limit(12);

  return {
    courseRecords: records.filter((row) => row.record.period === "all_time").slice(0, 4),
    monthlyBoards: records.filter((row) => row.record.period === "month").slice(0, 4),
  };
}

export async function ensureDefaultCourseRecordCategories() {
  const now = new Date();
  await getDb()
    .insert(courseRecordCategories)
    .values(
      defaultCategories.map((category) => ({
        slug: category.slug,
        name: category.name,
        description: category.description,
        recordType: category.recordType,
        metricKind: category.metricKind,
        scoringDirection: category.scoringDirection,
        verificationRequired: category.verificationRequired,
        sortOrder: category.sortOrder,
        metadataJson: { unit: category.unit },
        updatedAt: now,
      })),
    )
    .onConflictDoUpdate({
      target: courseRecordCategories.slug,
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        recordType: sql`excluded.record_type`,
        metricKind: sql`excluded.metric_kind`,
        scoringDirection: sql`excluded.scoring_direction`,
        verificationRequired: sql`excluded.verification_required`,
        sortOrder: sql`excluded.sort_order`,
        metadataJson: sql`excluded.metadata_json`,
        active: true,
        updatedAt: now,
      },
    });
}

export async function ensureCourseRecordBoards(courseId: string, createdByUserId?: string) {
  const db = getDb();
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);

  if (!course) {
    return [];
  }

  const [categories, teeRows] = await Promise.all([
    db.select().from(courseRecordCategories).where(eq(courseRecordCategories.active, true)).orderBy(asc(courseRecordCategories.sortOrder)),
    db.select().from(teeSets).where(eq(teeSets.courseId, courseId)).orderBy(asc(teeSets.name)).limit(1),
  ]);
  const teeSetId = teeRows[0]?.id ?? null;
  const existing = await db.select().from(courseRecords).where(eq(courseRecords.courseId, courseId));
  const existingKeys = new Set(existing.map(recordKey));
  const now = new Date();
  const monthStart = currentMonthStart();
  const monthEnd = new Date(monthStart);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
  const values = categories.flatMap((category) => {
    const base = {
      categoryId: category.id,
      courseId,
      teeSetId,
      createdByUserId: createdByUserId ?? course.createdByUserId ?? null,
      recordType: category.recordType,
      verificationRequired: category.verificationRequired,
      status: "active",
      updatedAt: now,
    };

    return [
      {
        ...base,
        scope: "public",
        period: "all_time",
        periodStart: null,
        periodEnd: null,
      },
      {
        ...base,
        scope: "public",
        period: "month",
        periodStart: monthStart,
        periodEnd: monthEnd,
      },
      {
        ...base,
        scope: "friends",
        period: "all_time",
        periodStart: null,
        periodEnd: null,
      },
    ];
  });
  const missingValues = values.filter((value) => !existingKeys.has(recordKey(value)));

  if (missingValues.length > 0) {
    await db.insert(courseRecords).values(missingValues);
  }

  await db
    .insert(courseProviderAliases)
    .values({
      courseId,
      providerKind: course.provider,
      providerCourseId: course.externalId,
      providerCourseName: course.name,
      providerTeeName: teeRows[0]?.name ?? null,
      normalisedName: normaliseCourseName(course.name),
      confidenceScore: 1,
      updatedAt: now,
    })
    .onConflictDoNothing();

  return db.select().from(courseRecords).where(eq(courseRecords.courseId, courseId));
}

async function canViewRecord(viewerUserId: string, record: typeof courseRecords.$inferSelect) {
  if (record.scope === "public") {
    return true;
  }

  if (record.createdByUserId === viewerUserId) {
    return true;
  }

  if (record.scope === "friends" && record.createdByUserId && (await areFriends(viewerUserId, record.createdByUserId))) {
    return true;
  }

  return false;
}

async function hasDuplicateRecordEvidence(userId: string, csvHash: string) {
  const [row] = await getDb()
    .select({ value: sql<number>`count(*)::int` })
    .from(courseRecordEvidence)
    .innerJoin(courseRecordAttempts, eq(courseRecordEvidence.attemptId, courseRecordAttempts.id))
    .where(and(eq(courseRecordAttempts.userId, userId), eq(courseRecordEvidence.csvHash, csvHash)))
    .limit(1);

  return (row?.value ?? 0) > 0;
}

async function createRecordModerationEvent(input: {
  attemptId: string;
  userId: string;
  courseName: string;
  importedScore: number;
  extractedScore: number | null;
  reasons: string[];
}) {
  await getDb().insert(moderationEvents).values({
    targetType: "course_record_attempt",
    targetId: input.attemptId,
    actorUserId: input.userId,
    eventType: "record_score_mismatch",
    severity: "medium",
    status: "open",
    reason: input.reasons.join("; ").slice(0, 1000),
    metadataJson: {
      course: input.courseName,
      imported: input.importedScore,
      screenshot: input.extractedScore,
      reasons: input.reasons,
    },
  });
}

async function awardCourseRecordAchievement(userId: string, achievementId: string, sourceId: string, xp: number) {
  const now = new Date();
  await getDb()
    .insert(userAchievements)
    .values({
      userId,
      achievementId,
      firstUnlockedAt: now,
      lastUnlockedAt: now,
      unlockCount: 1,
      xpAwarded: xp,
      metadataJson: {
        source: "course_record",
        sourceId,
      },
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [userAchievements.userId, userAchievements.achievementId],
      set: {
        lastUnlockedAt: now,
        unlockCount: sql`${userAchievements.unlockCount} + 1`,
        updatedAt: now,
      },
    });

  await getDb()
    .insert(xpLedger)
    .values({
      userId,
      amount: xp,
      reason: `Course record achievement: ${achievementId}`,
      achievementId,
      dedupeKey: `course-record-achievement:${achievementId}:${sourceId}`,
      metadataJson: {
        source: "course_record",
        sourceId,
      },
    })
    .onConflictDoNothing({
      target: [xpLedger.userId, xpLedger.dedupeKey],
    });
}

function compareAttempts(left: RankableRecordAttempt, right: RankableRecordAttempt, scoringDirection: ScoringDirection) {
  const scoreDiff =
    scoringDirection === "desc" ? right.metricValue - left.metricValue : left.metricValue - right.metricValue;

  if (scoreDiff !== 0) {
    return scoreDiff;
  }

  const verificationDiff = verificationTierRank(right.verificationTier) - verificationTierRank(left.verificationTier);

  if (verificationDiff !== 0) {
    return verificationDiff;
  }

  return left.submittedAt.getTime() - right.submittedAt.getTime();
}

function scoreExpectedForRecord(
  recordType: string,
  input: {
    metricValue: number;
    grossScore?: number | null;
    netScore?: number | null;
    stablefordPoints?: number | null;
  },
) {
  if (recordType === "best_gross_score") {
    return input.grossScore ?? input.metricValue;
  }

  if (recordType === "best_net_score") {
    return input.netScore ?? input.metricValue;
  }

  if (recordType === "best_stableford") {
    return input.stablefordPoints ?? input.metricValue;
  }

  return Number.isInteger(input.metricValue) ? input.metricValue : null;
}

function buildPreviousRoundSubmissionCard(
  session: SessionRow,
  teeSet: TeeSetRow | null,
  sync: RapsodoSyncRow | null,
  recordCards: Array<{
    record: typeof courseRecords.$inferSelect;
    category: typeof courseRecordCategories.$inferSelect;
  }>,
) {
  const summary = summarizeRound(session, teeSet);

  if (summary.totalScore === null) {
    return null;
  }

  const suggestions = recordCards
    .map(({ record, category }) => {
      if (record.teeSetId && session.teeSetId && record.teeSetId !== session.teeSetId) {
        return null;
      }

      const metricValue = metricValueForRecordType(record.recordType, summary);

      return typeof metricValue === "number"
        ? {
            recordId: record.id,
            label: category.name,
            value: scoreLabel(metricValue, category),
          }
        : null;
    })
    .filter((suggestion): suggestion is NonNullable<typeof suggestion> => Boolean(suggestion))
    .slice(0, 4);

  if (suggestions.length === 0) {
    return null;
  }

  return {
    id: session.id,
    date: session.date,
    title: session.courseName ?? session.fileName ?? "Previous round",
    teeSetName: teeSet?.name ?? null,
    totalScore: summary.totalScore,
    holeCount: summary.holeCount,
    proofLabel: proofLabelForRound(session, sync),
    suggestions,
  };
}

async function getRoundRecordSubmissionContext({
  userId,
  sessionId,
  record,
  category,
}: {
  userId: string;
  sessionId: string;
  record: typeof courseRecords.$inferSelect;
  category: typeof courseRecordCategories.$inferSelect;
}) {
  const [row] = await getDb()
    .select({
      session: sessions,
      teeSet: teeSets,
      sync: rapsodoSyncSessions,
    })
    .from(sessions)
    .leftJoin(teeSets, eq(sessions.teeSetId, teeSets.id))
    .leftJoin(rapsodoSyncSessions, eq(sessions.id, rapsodoSyncSessions.importedSessionId))
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .limit(1);

  if (!row) {
    throw new Error("Selected round was not found.");
  }

  const summary = summarizeRound(row.session, row.teeSet);
  const metricValue = metricValueForRecordType(record.recordType, summary);

  if (metricValue === null) {
    throw new Error(`${category.name} cannot be derived from this round.`);
  }

  return {
    session: row.session,
    summary,
    metricValue,
    grossScore: summary.totalScore,
    netScore: summary.totalNetScore,
    stablefordPoints: summary.stablefordPoints,
    csvHash: row.session.rawCsvHash ?? row.sync?.exportRawCsvHash ?? null,
    rapsodoSyncSessionId: row.sync?.id ?? null,
    courseMatches: row.session.courseId === record.courseId,
    teeMatches: !record.teeSetId || !row.session.teeSetId || row.session.teeSetId === record.teeSetId,
  };
}

function summarizeRound(session: SessionRow, teeSet: TeeSetRow | null): RoundRecordSummary {
  const holes = Array.isArray(session.scorecardJson) ? session.scorecardJson : [];
  const scoredHoles = holes.filter((hole) => typeof hole.score === "number");
  const netScoredHoles = holes.filter((hole) => typeof hole.netScore === "number");
  const totalScore = sumHoleValues(scoredHoles, "score");
  const totalNetScore = netScoredHoles.length > 0 ? sumHoleValues(netScoredHoles, "netScore") : null;
  const totalPar = sumNullable(holes.map((hole) => hole.par));
  const holeCount = scoredHoles.length;
  const putts = sumNullable(holes.map((hole) => hole.putts ?? null));

  return {
    totalScore,
    totalNetScore,
    stablefordPoints: stablefordPoints(holes),
    frontNineScore: sumScoreRange(holes, 1, 9),
    backNineScore: sumScoreRange(holes, 10, 18),
    birdies: birdieCount(holes),
    putts,
    bestHoleScore: minNullable(holes.map((hole) => hole.score ?? null)),
    differential: calculateRoundDifferential({
      totalScore,
      totalPar,
      courseRating: teeSet?.courseRating ?? null,
      slopeRating: teeSet?.slopeRating ?? null,
      holesPlayed: holeCount,
    }),
    holeCount,
  };
}

function metricValueForRecordType(recordType: string, summary: RoundRecordSummary) {
  switch (recordType) {
    case "best_gross_score":
      return summary.totalScore;
    case "best_net_score":
      return summary.totalNetScore ?? summary.totalScore;
    case "best_stableford":
      return summary.stablefordPoints;
    case "best_front_nine":
      return summary.frontNineScore;
    case "best_back_nine":
      return summary.backNineScore;
    case "lowest_differential":
      return summary.differential;
    case "most_birdies":
      return summary.birdies;
    case "fewest_putts":
      return summary.putts;
    case "best_hole_score":
      return summary.bestHoleScore;
    default:
      return null;
  }
}

function proofLabelForRound(session: SessionRow, sync: RapsodoSyncRow | null) {
  if (sync) {
    return "Rapsodo Cloud round";
  }

  if (session.rawCsvHash) {
    return "Rapsodo CSV round";
  }

  return "Manual round - review only";
}

function dedupeCoursesByName<T extends { id: string; name: string; createdByUserId: string | null }>(
  courseRows: T[],
  sessionCounts: Map<string, number>,
) {
  const byName = new Map<string, T>();

  for (const course of courseRows) {
    const key = normalisedCourseName(course.name);
    const current = byName.get(key);

    if (!current || coursePreference(course, sessionCounts) > coursePreference(current, sessionCounts)) {
      byName.set(key, course);
    }
  }

  return [...byName.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function coursePreference(course: { id: string; createdByUserId: string | null }, sessionCounts: Map<string, number>) {
  return (sessionCounts.get(course.id) ?? 0) * 10 + (course.createdByUserId ? 1 : 0);
}

function normalisedCourseName(name: string) {
  return name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
}

function sumScoreRange(holes: ScorecardHole[], start: number, end: number) {
  const range = holes.filter((hole) => hole.holeNumber >= start && hole.holeNumber <= end);
  return range.length > 0 ? sumHoleValues(range, "score") : null;
}

function sumHoleValues(holes: ScorecardHole[], key: "score" | "netScore") {
  return sumNullable(holes.map((hole) => hole[key] ?? null));
}

function sumNullable(values: Array<number | null | undefined>) {
  const present = values.filter((value): value is number => typeof value === "number");
  return present.length > 0 ? present.reduce((total, value) => total + value, 0) : null;
}

function minNullable(values: Array<number | null | undefined>) {
  const present = values.filter((value): value is number => typeof value === "number");
  return present.length > 0 ? Math.min(...present) : null;
}

function birdieCount(holes: ScorecardHole[]) {
  const scored = holes.filter((hole) => typeof hole.score === "number" && typeof hole.par === "number");

  if (scored.length === 0) {
    return null;
  }

  return scored.filter((hole) => (hole.score ?? 0) <= hole.par - 1).length;
}

function stablefordPoints(holes: ScorecardHole[]) {
  const scored = holes.filter((hole) => typeof (hole.netScore ?? hole.score) === "number" && typeof hole.par === "number");

  if (scored.length === 0) {
    return null;
  }

  return scored.reduce((total, hole) => {
    const score = hole.netScore ?? hole.score ?? 0;
    return total + Math.max(0, 2 + hole.par - score);
  }, 0);
}

function metricLabelForCategory(category: Pick<typeof courseRecordCategories.$inferSelect, "metricKind" | "metadataJson">) {
  const unit = typeof category.metadataJson.unit === "string" ? category.metadataJson.unit : category.metricKind;
  return unit;
}

export function scoreLabel(value: number, category: Pick<typeof courseRecordCategories.$inferSelect, "metricKind" | "metadataJson" | "recordType">) {
  const unit = typeof category.metadataJson.unit === "string" ? category.metadataJson.unit : "";

  if (category.metricKind === "strokes" || category.recordType.includes("score")) {
    return integerFormatter.format(value);
  }

  if (unit === "yd" || unit.includes("yd")) {
    return `${numberFormatter.format(value)} ${unit}`;
  }

  if (unit) {
    return `${numberFormatter.format(value)} ${unit}`;
  }

  return numberFormatter.format(value);
}

function recordKey(record: {
  categoryId: string;
  courseId: string;
  teeSetId: string | null;
  scope: string;
  period: string;
  groupId?: string | null;
}) {
  return [record.categoryId, record.courseId, record.teeSetId ?? "none", record.scope, record.period, record.groupId ?? "none"].join(":");
}

function countBy(values: string[]) {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return counts;
}

function currentMonthStart() {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  return monthStart;
}

function normaliseCourseName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|golf|club|course|links)\b/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function scopeLabel(scope: string) {
  if (scope === "public") {
    return "public";
  }

  if (scope === "friends") {
    return "friends";
  }

  if (scope === "group") {
    return "group";
  }

  return "private";
}

function revalidateCourseRecordPaths(courseId: string, recordId: string) {
  revalidatePath("/course-records");
  revalidatePath(`/course-records/${recordId}`);
  revalidatePath(`/courses/${courseId}/records`);
  revalidatePath("/courses");
  revalidatePath("/feed");
  revalidatePath("/leaderboard");
  revalidatePath("/profile");
}
