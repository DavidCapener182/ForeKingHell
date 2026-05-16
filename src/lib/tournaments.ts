import "server-only";

import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  courses,
  moderationEvents,
  sessions,
  teeSets,
  tournamentComments,
  tournamentEntries,
  tournamentEvidence,
  tournamentRounds,
  tournamentStandings,
  tournamentSubmissions,
  tournaments,
  userAchievements,
  userProfiles,
  xpLedger,
} from "@/db/schema";
import { getDb } from "@/db/client";
import { requireCurrentUserId } from "@/lib/current-user";
import { evaluateVerification, verificationTierLabel, type VerificationDecision } from "@/lib/course-records";
import { areFriends, createFeedItem, ensureSocialProfileForUser, getFriendIds, parseVisibility } from "@/lib/social";
import { hasCurrentTournamentEntryTermsMetadata } from "@/lib/tournament-entry-terms";
import { dailyTournamentCourseCount, getScheduledTournamentSet, type ScheduledTournament, type ScheduledTournamentKind } from "@/lib/tournament-calendar";

export const tournamentFormats = [
  "four_round_major",
  "two_round_open",
  "course_record_sprint",
  "matchplay",
  "order_of_merit",
] as const;

export type TournamentFormat = (typeof tournamentFormats)[number];

export type RankableTournamentStanding = {
  entryId: string;
  userId: string;
  grossTotal: number;
  netTotal: number | null;
  roundsCompleted: number;
  latestSubmissionAt: Date;
};

export type RankedTournamentStanding = RankableTournamentStanding & {
  rank: number;
};

const integerFormatter = new Intl.NumberFormat("en-GB");

export function rankTournamentStandings(rows: RankableTournamentStanding[]): RankedTournamentStanding[] {
  return [...rows]
    .sort((left, right) => {
      const completedDiff = right.roundsCompleted - left.roundsCompleted;

      if (completedDiff !== 0) {
        return completedDiff;
      }

      const grossDiff = left.grossTotal - right.grossTotal;

      if (grossDiff !== 0) {
        return grossDiff;
      }

      const netDiff = (left.netTotal ?? left.grossTotal) - (right.netTotal ?? right.grossTotal);

      if (netDiff !== 0) {
        return netDiff;
      }

      return left.latestSubmissionAt.getTime() - right.latestSubmissionAt.getTime();
    })
    .map((row, index) => ({
      ...row,
      rank: index + 1,
    }));
}

export async function getTournamentsPageData() {
  const viewerUserId = await requireCurrentUserId();
  await ensureSocialProfileForUser(viewerUserId);
  const db = getDb();
  const scheduledSet = getScheduledTournamentSet();
  await ensureScheduledTournaments(viewerUserId, scheduledSet);
  const friendIds = await getFriendIds(viewerUserId);
  const visibleCreatorIds = [viewerUserId, ...friendIds];
  const tournamentRows = await db
    .select()
    .from(tournaments)
    .where(or(eq(tournaments.visibility, "public"), inArray(tournaments.createdByUserId, visibleCreatorIds)))
    .orderBy(desc(tournaments.startsAt))
    .limit(80);

  if (tournamentRows.length === 0) {
    return {
      tournaments: [],
      featured: null,
      scheduled: {
        daily: null,
        weekly: null,
        monthly: null,
      },
      myEntries: [],
      templates: tournamentTemplates(),
      courseOptions: await getCourseOptions(),
      dailyCourseCount: dailyTournamentCourseCount,
    };
  }

  const tournamentIds = tournamentRows.map((tournament) => tournament.id);
  const courseIds = tournamentRows.map((tournament) => tournament.courseId).filter((id): id is string => Boolean(id));
  const teeSetIds = tournamentRows.map((tournament) => tournament.teeSetId).filter((id): id is string => Boolean(id));
  const [entryRows, standingsRows, courseRows, teeRows] = await Promise.all([
    db.select().from(tournamentEntries).where(inArray(tournamentEntries.tournamentId, tournamentIds)),
    db.select().from(tournamentStandings).where(inArray(tournamentStandings.tournamentId, tournamentIds)),
    courseIds.length > 0 ? db.select().from(courses).where(inArray(courses.id, courseIds)) : Promise.resolve([]),
    teeSetIds.length > 0 ? db.select().from(teeSets).where(inArray(teeSets.id, teeSetIds)) : Promise.resolve([]),
  ]);
  const courseById = new Map(courseRows.map((course) => [course.id, course]));
  const teeById = new Map(teeRows.map((teeSet) => [teeSet.id, teeSet]));
  const profiles = await profilesByUserId([...new Set(standingsRows.map((standing) => standing.userId))]);
  const items = tournamentRows.map((tournament) => hydrateTournamentListItem({
    tournament,
    entries: entryRows.filter((entry) => entry.tournamentId === tournament.id),
    standings: standingsRows.filter((standing) => standing.tournamentId === tournament.id),
    course: tournament.courseId ? courseById.get(tournament.courseId) ?? null : null,
    teeSet: tournament.teeSetId ? teeById.get(tournament.teeSetId) ?? null : null,
    profiles,
    viewerUserId,
  }));

  return {
    tournaments: items,
    featured: items.find((item) => item.status === "open") ?? items[0] ?? null,
    scheduled: {
      daily: items.find((item) => item.scheduleKind === "daily") ?? null,
      weekly: items.find((item) => item.scheduleKind === "weekly") ?? null,
      monthly: items.find((item) => item.scheduleKind === "monthly") ?? null,
    },
    myEntries: items.filter((item) => item.viewerEntered),
    templates: tournamentTemplates(),
    courseOptions: await getCourseOptions(),
    dailyCourseCount: dailyTournamentCourseCount,
  };
}

export async function getTournamentDetailData(tournamentId: string) {
  const viewerUserId = await requireCurrentUserId();
  await ensureSocialProfileForUser(viewerUserId);
  await ensureScheduledTournaments(viewerUserId, getScheduledTournamentSet());
  const db = getDb();
  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);

  if (!tournament || !(await canViewTournament(viewerUserId, tournament))) {
    return null;
  }

  const [roundRows, entryRows, submissionRows, standingRows, commentRows, courseRows, teeRows] = await Promise.all([
    db.select().from(tournamentRounds).where(eq(tournamentRounds.tournamentId, tournament.id)).orderBy(asc(tournamentRounds.roundNumber)),
    db.select().from(tournamentEntries).where(eq(tournamentEntries.tournamentId, tournament.id)).orderBy(asc(tournamentEntries.joinedAt)),
    db.select().from(tournamentSubmissions).where(eq(tournamentSubmissions.tournamentId, tournament.id)).orderBy(desc(tournamentSubmissions.submittedAt)),
    db.select().from(tournamentStandings).where(eq(tournamentStandings.tournamentId, tournament.id)).orderBy(asc(tournamentStandings.rank)),
    db
      .select()
      .from(tournamentComments)
      .where(and(eq(tournamentComments.tournamentId, tournament.id), isNull(tournamentComments.deletedAt)))
      .orderBy(asc(tournamentComments.createdAt)),
    tournament.courseId ? db.select().from(courses).where(eq(courses.id, tournament.courseId)).limit(1) : Promise.resolve([]),
    tournament.teeSetId ? db.select().from(teeSets).where(eq(teeSets.id, tournament.teeSetId)).limit(1) : Promise.resolve([]),
  ]);
  const userIds = [
    ...new Set([
      tournament.createdByUserId,
      ...entryRows.map((entry) => entry.userId),
      ...submissionRows.map((submission) => submission.userId),
      ...standingRows.map((standing) => standing.userId),
      ...commentRows.map((comment) => comment.userId),
    ]),
  ];
  const profiles = await profilesByUserId(userIds);
  const viewerEntry = entryRows.find((entry) => entry.userId === viewerUserId) ?? null;
  const viewerSubmissions = submissionRows.filter((submission) => submission.userId === viewerUserId);

  return {
    viewerUserId,
    tournament,
    course: courseRows[0] ?? null,
    teeSet: teeRows[0] ?? null,
    rounds: roundRows,
    entries: entryRows.map((entry) => ({ entry, profile: profiles.get(entry.userId) ?? null })),
    submissions: submissionRows.map((submission) => ({ submission, profile: profiles.get(submission.userId) ?? null })),
    standings: standingRows.map((standing) => ({ standing, profile: profiles.get(standing.userId) ?? null })),
    comments: commentRows.map((comment) => ({ comment, profile: profiles.get(comment.userId) ?? null })),
    viewerEntry,
    viewerSubmissions,
    nextRoundNumber: nextRoundNumber(tournament.roundCount, viewerSubmissions),
    viewerEntered: Boolean(viewerEntry),
  };
}

export async function createTournament(input: {
  title: string;
  description?: string | null;
  courseId?: string | null;
  teeSetId?: string | null;
  format: TournamentFormat;
  visibility: string;
  startsAt?: Date | null;
  endsAt?: Date | null;
  roundCount?: number | null;
  directRapsodoRequired?: boolean;
  screenshotRequired?: boolean;
}) {
  const userId = await requireCurrentUserId();
  const profile = await ensureSocialProfileForUser(userId);
  const format = tournamentFormats.includes(input.format) ? input.format : "two_round_open";
  const roundCount = Math.min(Math.max(input.roundCount ?? defaultRoundCount(format), 1), 12);
  const now = new Date();
  const [tournament] = await getDb().transaction(async (tx) => {
    const [created] = await tx
      .insert(tournaments)
      .values({
        title: cleanText(input.title, "Spring Major Week").slice(0, 180),
        description: cleanOptional(input.description) ?? descriptionForFormat(format),
        courseId: input.courseId ?? null,
        teeSetId: input.teeSetId ?? null,
        format,
        visibility: parseVisibility(input.visibility, "friends"),
        status: "open",
        startsAt: input.startsAt ?? now,
        endsAt: input.endsAt ?? defaultTournamentEnd(now, roundCount),
        roundCount,
        verificationPolicy: input.directRapsodoRequired ? "gold" : "silver",
        directRapsodoRequired: Boolean(input.directRapsodoRequired),
        screenshotRequired: Boolean(input.screenshotRequired),
        cutRuleJson:
          format === "four_round_major"
            ? { enabled: true, afterRound: 2, topAndTies: 50, optional: true }
            : {},
        playoffRuleJson:
          format === "four_round_major"
            ? { type: "sudden_death", holes: [18, 10], netTieBreakers: ["back_nine", "last_six", "earliest_submission"] }
            : { tieBreakers: ["net_total", "final_round", "earliest_submission"] },
        createdByUserId: userId,
        metadataJson: {
          template: format === "four_round_major" ? "spring_major_week" : null,
        },
        updatedAt: now,
      })
      .returning();

    await tx.insert(tournamentEntries).values({
      tournamentId: created.id,
      userId,
      status: "entered",
      updatedAt: now,
    });

    await tx.insert(tournamentRounds).values(
      Array.from({ length: roundCount }, (_, index) => ({
        tournamentId: created.id,
        roundNumber: index + 1,
        title: `Round ${index + 1}`,
        startsAt: input.startsAt ?? now,
        endsAt: input.endsAt ?? defaultTournamentEnd(now, roundCount),
        status: index === 0 ? "open" : "scheduled",
        updatedAt: now,
      })),
    );

    return [created];
  });

  await createFeedItem({
    userId,
    itemType: "tournament_created",
    headline: `${profile.displayName} opened ${tournament.title}`,
    metricLabel: "Tournament",
    metricValue: formatLabel(format),
    context: tournament.description,
    proofUrl: `/tournaments/${tournament.id}`,
    sourceType: "tournament",
    sourceId: tournament.id,
    visibility: parseVisibility(tournament.visibility, "friends"),
    verificationLabel: tournament.directRapsodoRequired ? "Gold required" : "Silver required",
    dedupeKey: `tournament-created:${tournament.id}`,
  });
  await awardTournamentAchievement(userId, "major_contender", tournament.id, 150);

  revalidateTournamentPaths(tournament.id);
  return tournament.id;
}

export async function joinTournament(
  tournamentId: string,
  termsAcceptance: {
    accepted: true;
    acceptedAt: Date;
    version: string;
  },
) {
  if (!termsAcceptance.accepted) {
    throw new Error("Tournament entry terms must be accepted before registering.");
  }

  const userId = await requireCurrentUserId();
  const profile = await ensureSocialProfileForUser(userId);
  const tournament = await requireVisibleTournament(userId, tournamentId);
  const now = new Date();
  const termsMetadata = {
    entryTermsAccepted: true,
    entryTermsAcceptedAt: termsAcceptance.acceptedAt.toISOString(),
    entryTermsVersion: termsAcceptance.version,
  };

  await getDb()
    .insert(tournamentEntries)
    .values({
      tournamentId,
      userId,
      status: "entered",
      metadataJson: termsMetadata,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [tournamentEntries.tournamentId, tournamentEntries.userId],
      set: {
        status: "entered",
        withdrawnAt: null,
        metadataJson: sql`${tournamentEntries.metadataJson} || ${JSON.stringify(termsMetadata)}::jsonb`,
        updatedAt: now,
      },
    });

  await createFeedItem({
    userId,
    itemType: "tournament_joined",
    headline: `${profile.displayName} entered ${tournament.title}`,
    metricLabel: "Tournament",
    metricValue: formatLabel(tournament.format),
    context: tournament.description,
    proofUrl: `/tournaments/${tournament.id}`,
    sourceType: "tournament",
    sourceId: tournament.id,
    visibility: parseVisibility(tournament.visibility, "friends"),
    verificationLabel: "Entry",
    dedupeKey: `tournament-entry:${tournament.id}:${userId}`,
  });
  await awardTournamentAchievement(userId, "major_contender", tournament.id, 150);

  revalidateTournamentPaths(tournamentId);
}

export async function submitTournamentRound(input: {
  tournamentId: string;
  roundNumber: number;
  grossScore: number;
  netScore?: number | null;
  stablefordPoints?: number | null;
  sessionId?: string | null;
  csvHash?: string | null;
  scorecardScreenshotPath?: string | null;
  extractedScorecardTotal?: number | null;
  hasRapsodoDirect?: boolean;
  courseMatches?: boolean;
  dateMatches?: boolean;
  teeMatches?: boolean;
  manualEdit?: boolean;
}) {
  const userId = await requireCurrentUserId();
  const profile = await ensureSocialProfileForUser(userId);
  const tournament = await requireVisibleTournament(userId, input.tournamentId);

  if (!Number.isFinite(input.grossScore) || input.grossScore < 1) {
    throw new Error("Gross score is required.");
  }

  const roundNumber = Math.min(Math.max(Math.floor(input.roundNumber), 1), tournament.roundCount);
  const duplicateImport = input.csvHash ? await hasDuplicateTournamentEvidence(userId, input.csvHash) : false;
  const verification = evaluateVerification({
    expectedScore: input.grossScore,
    extractedScorecardTotal: input.extractedScorecardTotal,
    hasRapsodoDirect: input.hasRapsodoDirect,
    hasCsvHash: Boolean(input.csvHash),
    hasScorecardScreenshot: Boolean(input.scorecardScreenshotPath),
    courseMatches: input.courseMatches ?? true,
    dateMatches: input.dateMatches ?? true,
    teeMatches: input.teeMatches ?? true,
    duplicateImport,
    manualEdit: input.manualEdit,
    screenshotRequired: tournament.screenshotRequired,
    directRapsodoRequired: tournament.directRapsodoRequired,
  });
  const now = new Date();
  const [entry] = await getDb()
    .select()
    .from(tournamentEntries)
    .where(and(eq(tournamentEntries.tournamentId, tournament.id), eq(tournamentEntries.userId, userId)))
    .limit(1);

  if (!entry || entry.status !== "entered") {
    throw new Error("Enter the tournament and accept the terms before submitting a round.");
  }

  if (!hasCurrentTournamentEntryTermsMetadata(entry.metadataJson)) {
    throw new Error("Accept the current no-mulligans tournament terms before submitting a round.");
  }

  const [submission] = await getDb()
    .insert(tournamentSubmissions)
    .values({
      tournamentId: tournament.id,
      entryId: entry.id,
      userId,
      roundNumber,
      sessionId: input.sessionId ?? null,
      scorecardSessionId: input.sessionId ?? null,
      grossScore: input.grossScore,
      netScore: input.netScore ?? null,
      stablefordPoints: input.stablefordPoints ?? null,
      scorecardScreenshotPath: input.scorecardScreenshotPath ?? null,
      extractedScorecardTotal: input.extractedScorecardTotal ?? null,
      verificationStatus: verification.status,
      verificationTier: verification.tier,
      proofStatus: verification.proofStatus,
      metadataJson: {
        csvHash: input.csvHash ?? null,
        verificationReasons: verification.reasons,
        duplicateImport,
      },
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [tournamentSubmissions.entryId, tournamentSubmissions.roundNumber],
      set: {
        sessionId: input.sessionId ?? null,
        scorecardSessionId: input.sessionId ?? null,
        grossScore: input.grossScore,
        netScore: input.netScore ?? null,
        stablefordPoints: input.stablefordPoints ?? null,
        scorecardScreenshotPath: input.scorecardScreenshotPath ?? null,
        extractedScorecardTotal: input.extractedScorecardTotal ?? null,
        verificationStatus: verification.status,
        verificationTier: verification.tier,
        proofStatus: verification.proofStatus,
        metadataJson: {
          csvHash: input.csvHash ?? null,
          verificationReasons: verification.reasons,
          duplicateImport,
        },
        submittedAt: now,
        updatedAt: now,
      },
    })
    .returning();

  await saveTournamentEvidence(submission.id, verification, input, duplicateImport);

  if (verification.status === "mismatch" || verification.status === "needs_review") {
    await createTournamentModerationEvent({
      submissionId: submission.id,
      userId,
      tournamentTitle: tournament.title,
      importedScore: input.grossScore,
      extractedScore: input.extractedScorecardTotal ?? null,
      reasons: verification.reasons,
    });
  }

  const standings = await recalculateTournamentStandings(tournament.id);
  const standing = standings.find((item) => item.userId === userId);
  if (tournament.format === "four_round_major" && standing && standing.roundsCompleted >= 4) {
    await awardTournamentAchievement(userId, "four_round_finisher", tournament.id, 350);
  }

  await createFeedItem({
    userId,
    itemType: verification.status === "verified" ? "tournament_round_submitted" : "tournament_round_pending",
    headline: `${profile.displayName} submitted round ${roundNumber} for ${tournament.title}`,
    metricLabel: "Gross",
    metricValue: integerFormatter.format(input.grossScore),
    context: standing?.rank ? `Current standing #${standing.rank}` : verification.reasons.join("; "),
    proofUrl: `/tournaments/${tournament.id}`,
    sourceType: "tournament_submission",
    sourceId: submission.id,
    visibility: parseVisibility(tournament.visibility, "friends"),
    verificationLabel: verificationTierLabel(verification.tier),
    dedupeKey: `tournament-submission:${submission.id}:${verification.status}`,
  });

  revalidateTournamentPaths(tournament.id);
  return submission.id;
}

export async function addTournamentComment(tournamentId: string, body: string) {
  const userId = await requireCurrentUserId();
  await requireVisibleTournament(userId, tournamentId);
  const cleanBody = body.trim();

  if (!cleanBody) {
    throw new Error("Comment cannot be empty.");
  }

  await getDb().insert(tournamentComments).values({
    tournamentId,
    userId,
    body: cleanBody.slice(0, 1200),
    updatedAt: new Date(),
  });

  revalidateTournamentPaths(tournamentId);
}

export async function recalculateTournamentStandings(tournamentId: string) {
  const db = getDb();
  const submissions = await db.select().from(tournamentSubmissions).where(eq(tournamentSubmissions.tournamentId, tournamentId));
  const accepted = submissions.filter((submission) => submission.verificationStatus === "verified" || submission.verificationStatus === "manual_only");
  const byEntry = new Map<string, typeof accepted>();

  for (const submission of accepted) {
    const rows = byEntry.get(submission.entryId) ?? [];
    rows.push(submission);
    byEntry.set(submission.entryId, rows);
  }

  const ranked = rankTournamentStandings(
    [...byEntry.entries()].map(([entryId, rows]) => ({
      entryId,
      userId: rows[0].userId,
      grossTotal: rows.reduce((total, row) => total + row.grossScore, 0),
      netTotal: rows.some((row) => row.netScore !== null)
        ? rows.reduce((total, row) => total + (row.netScore ?? row.grossScore), 0)
        : null,
      roundsCompleted: rows.length,
      latestSubmissionAt: rows
        .map((row) => row.submittedAt)
        .sort((left, right) => right.getTime() - left.getTime())[0],
    })),
  );
  const now = new Date();
  const standings: Array<typeof tournamentStandings.$inferSelect> = [];

  for (const row of ranked) {
    const [standing] = await db
      .insert(tournamentStandings)
      .values({
        tournamentId,
        entryId: row.entryId,
        userId: row.userId,
        grossTotal: row.grossTotal,
        netTotal: row.netTotal,
        roundsCompleted: row.roundsCompleted,
        rank: row.rank,
        tieBreakerJson: {
          latestSubmissionAt: row.latestSubmissionAt.toISOString(),
          netTotal: row.netTotal,
        },
        status: "active",
        calculatedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: tournamentStandings.entryId,
        set: {
          grossTotal: row.grossTotal,
          netTotal: row.netTotal,
          roundsCompleted: row.roundsCompleted,
          rank: row.rank,
          tieBreakerJson: {
            latestSubmissionAt: row.latestSubmissionAt.toISOString(),
            netTotal: row.netTotal,
          },
          status: "active",
          calculatedAt: now,
          updatedAt: now,
        },
      })
      .returning();
    standings.push(standing);
  }

  return standings;
}

export async function getEligibleTournamentsForSession(sessionId: string) {
  const userId = await requireCurrentUserId();
  const db = getDb();
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .limit(1);

  if (!session) {
    return [];
  }

  const rows = await db
    .select({
      tournament: tournaments,
      course: courses,
    })
    .from(tournaments)
    .leftJoin(courses, eq(tournaments.courseId, courses.id))
    .where(
      and(
        eq(tournaments.status, "open"),
        session.courseId ? or(eq(tournaments.courseId, session.courseId), isNull(tournaments.courseId)) : isNull(tournaments.courseId),
      ),
    )
    .orderBy(asc(tournaments.endsAt))
    .limit(8);

  return rows.filter((row) => row.tournament.visibility === "public" || row.tournament.createdByUserId === userId);
}

async function saveTournamentEvidence(
  submissionId: string,
  verification: VerificationDecision,
  input: {
    csvHash?: string | null;
    scorecardScreenshotPath?: string | null;
    extractedScorecardTotal?: number | null;
    hasRapsodoDirect?: boolean;
  },
  duplicateImport: boolean,
) {
  const now = new Date();
  const rows = [
    input.hasRapsodoDirect
      ? {
          submissionId,
          evidenceType: "rapsodo_import",
          metadataJson: { source: "rapsodo_cloud" },
          reviewStatus: verification.status === "verified" ? "approved" : "pending",
          updatedAt: now,
        }
      : null,
    input.csvHash
      ? {
          submissionId,
          evidenceType: "csv_hash",
          csvHash: input.csvHash,
          metadataJson: { duplicateImport },
          reviewStatus: verification.status === "verified" ? "approved" : "pending",
          updatedAt: now,
        }
      : null,
    input.scorecardScreenshotPath
      ? {
          submissionId,
          evidenceType: "scorecard_screenshot",
          storagePath: input.scorecardScreenshotPath,
          extractedScorecardTotal: input.extractedScorecardTotal ?? null,
          metadataJson: { extractedScorecardTotal: input.extractedScorecardTotal ?? null },
          reviewStatus: verification.status === "verified" ? "approved" : "pending",
          updatedAt: now,
        }
      : null,
  ].filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (rows.length > 0) {
    await getDb().insert(tournamentEvidence).values(rows);
  }
}

async function hasDuplicateTournamentEvidence(userId: string, csvHash: string) {
  const [row] = await getDb()
    .select({ value: sql<number>`count(*)::int` })
    .from(tournamentEvidence)
    .innerJoin(tournamentSubmissions, eq(tournamentEvidence.submissionId, tournamentSubmissions.id))
    .where(and(eq(tournamentSubmissions.userId, userId), eq(tournamentEvidence.csvHash, csvHash)))
    .limit(1);

  return (row?.value ?? 0) > 0;
}

async function createTournamentModerationEvent(input: {
  submissionId: string;
  userId: string;
  tournamentTitle: string;
  importedScore: number;
  extractedScore: number | null;
  reasons: string[];
}) {
  await getDb().insert(moderationEvents).values({
    targetType: "tournament_submission",
    targetId: input.submissionId,
    actorUserId: input.userId,
    eventType: "tournament_score_mismatch",
    severity: "medium",
    status: "open",
    reason: input.reasons.join("; ").slice(0, 1000),
    metadataJson: {
      tournament: input.tournamentTitle,
      imported: input.importedScore,
      screenshot: input.extractedScore,
      reasons: input.reasons,
    },
  });
}

async function awardTournamentAchievement(userId: string, achievementId: string, sourceId: string, xp: number) {
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
        source: "tournament",
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
      reason: `Tournament achievement: ${achievementId}`,
      achievementId,
      dedupeKey: `tournament-achievement:${achievementId}:${sourceId}`,
      metadataJson: {
        source: "tournament",
        sourceId,
      },
    })
    .onConflictDoNothing({
      target: [xpLedger.userId, xpLedger.dedupeKey],
    });
}

async function requireVisibleTournament(viewerUserId: string, tournamentId: string) {
  const [tournament] = await getDb().select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);

  if (!tournament || !(await canViewTournament(viewerUserId, tournament))) {
    throw new Error("Tournament not found.");
  }

  return tournament;
}

async function canViewTournament(viewerUserId: string, tournament: typeof tournaments.$inferSelect) {
  if (tournament.visibility === "public" || tournament.createdByUserId === viewerUserId) {
    return true;
  }

  if (tournament.visibility === "friends" && (await areFriends(viewerUserId, tournament.createdByUserId))) {
    return true;
  }

  const [entry] = await getDb()
    .select({ id: tournamentEntries.id })
    .from(tournamentEntries)
    .where(and(eq(tournamentEntries.tournamentId, tournament.id), eq(tournamentEntries.userId, viewerUserId)))
    .limit(1);

  return Boolean(entry);
}

async function profilesByUserId(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, typeof userProfiles.$inferSelect>();
  }

  const rows = await getDb().select().from(userProfiles).where(inArray(userProfiles.userId, userIds));
  return new Map(rows.map((profile) => [profile.userId, profile]));
}

async function getCourseOptions() {
  const userId = await requireCurrentUserId();
  const courseRows = await getDb()
    .select({
      courseId: courses.id,
      courseName: courses.name,
      teeSetId: teeSets.id,
      teeSetName: teeSets.name,
    })
    .from(courses)
    .leftJoin(teeSets, eq(courses.id, teeSets.courseId))
    .where(or(eq(courses.visibility, "shared"), eq(courses.createdByUserId, userId)))
    .orderBy(asc(courses.name), asc(teeSets.name))
    .limit(80);

  return courseRows;
}

async function ensureScheduledTournaments(userId: string, scheduledSet: ScheduledTournament[]) {
  for (const scheduled of scheduledSet) {
    const existing = await findScheduledTournament(scheduled.key);

    if (existing) {
      await syncScheduledTournament(existing, userId, scheduled);
      continue;
    }

    const { course, teeSet } = await ensureScheduledCourse(userId, scheduled.course);
    const now = new Date();
    const [tournament] = await getDb()
      .insert(tournaments)
      .values({
        title: scheduledTournamentTitle(scheduled),
        description: scheduled.description,
        courseId: course.id,
        teeSetId: teeSet.id,
        format: scheduled.format,
        visibility: "public",
        status: "open",
        startsAt: scheduled.startsAt,
        endsAt: scheduled.endsAt,
        roundCount: scheduled.roundCount,
        verificationPolicy: scheduled.verificationPolicy,
        screenshotRequired: true,
        directRapsodoRequired: scheduled.verificationPolicy === "gold",
        cutRuleJson:
          scheduled.kind === "monthly"
            ? { enabled: true, afterRound: 2, topAndTies: 50 }
            : {},
        playoffRuleJson:
          scheduled.kind === "monthly"
            ? { type: "sudden_death", holes: [18, 10] }
            : { type: "countback", order: ["back_nine", "last_six", "last_three"] },
        createdByUserId: userId,
        metadataJson: scheduledTournamentMetadata(scheduled),
        updatedAt: now,
      })
      .returning();

    await getDb().insert(tournamentRounds).values(
      Array.from({ length: scheduled.roundCount }, (_, index) => ({
        tournamentId: tournament.id,
        roundNumber: index + 1,
        title: scheduled.roundCount === 1 ? "Daily round" : `Round ${index + 1}`,
        startsAt: scheduled.startsAt,
        endsAt: scheduled.endsAt,
        status: index === 0 ? "open" : "scheduled",
        updatedAt: now,
      })),
    );
  }
}

async function syncScheduledTournament(
  existing: typeof tournaments.$inferSelect,
  userId: string,
  scheduled: ScheduledTournament,
) {
  const existingMetadata = isRecord(existing.metadataJson) ? existing.metadataJson : {};
  const existingCourseName =
    typeof existingMetadata.scheduledCourseName === "string"
      ? existingMetadata.scheduledCourseName
      : null;
  const existingRotationSize =
    typeof existingMetadata.courseRotationSize === "number"
      ? existingMetadata.courseRotationSize
      : null;
  const title = scheduledTournamentTitle(scheduled);

  if (
    existing.title === title &&
    existing.description === scheduled.description &&
    existingCourseName === scheduled.course.name &&
    existingRotationSize === dailyTournamentCourseCount
  ) {
    return;
  }

  const db = getDb();
  const [submission] = await db
    .select({ id: tournamentSubmissions.id })
    .from(tournamentSubmissions)
    .where(eq(tournamentSubmissions.tournamentId, existing.id))
    .limit(1);

  if (submission) {
    return;
  }

  const { course, teeSet } = await ensureScheduledCourse(userId, scheduled.course);
  const now = new Date();
  await db
    .update(tournaments)
    .set({
      title,
      description: scheduled.description,
      courseId: course.id,
      teeSetId: teeSet.id,
      startsAt: scheduled.startsAt,
      endsAt: scheduled.endsAt,
      roundCount: scheduled.roundCount,
      verificationPolicy: scheduled.verificationPolicy,
      screenshotRequired: true,
      directRapsodoRequired: scheduled.verificationPolicy === "gold",
      metadataJson: {
        ...existingMetadata,
        ...scheduledTournamentMetadata(scheduled),
        previousScheduledCourseName: existingCourseName,
      },
      updatedAt: now,
    })
    .where(eq(tournaments.id, existing.id));

  const roundRows = await db
    .select()
    .from(tournamentRounds)
    .where(eq(tournamentRounds.tournamentId, existing.id))
    .orderBy(asc(tournamentRounds.roundNumber));

  for (const round of roundRows) {
    await db
      .update(tournamentRounds)
      .set({
        title: scheduled.roundCount === 1 ? "Daily round" : `Round ${round.roundNumber}`,
        startsAt: scheduled.startsAt,
        endsAt: scheduled.endsAt,
        updatedAt: now,
      })
      .where(eq(tournamentRounds.id, round.id));
  }
}

function scheduledTournamentTitle(scheduled: ScheduledTournament) {
  return `${scheduled.title}: ${scheduled.course.name}`;
}

function scheduledTournamentMetadata(scheduled: ScheduledTournament) {
  return {
    scheduled: true,
    scheduledKey: scheduled.key,
    scheduledKind: scheduled.kind,
    scheduleEyebrow: scheduled.eyebrow,
    scheduledCourseName: scheduled.course.name,
    courseRotationSize: dailyTournamentCourseCount,
    rapsodoCoursePolicy: "tour-venue-curated",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function findScheduledTournament(scheduledKey: string) {
  const [existing] = await getDb()
    .select()
    .from(tournaments)
    .where(sql`${tournaments.metadataJson}->>'scheduledKey' = ${scheduledKey}`)
    .limit(1);

  return existing ?? null;
}

async function ensureScheduledCourse(userId: string, scheduledCourse: ScheduledTournament["course"]) {
  const now = new Date();
  const externalId = `scheduled-${slugify(scheduledCourse.name)}`;
  const [course] = await getDb()
    .insert(courses)
    .values({
      name: scheduledCourse.name,
      country: scheduledCourse.country,
      provider: "schedule",
      externalId,
      visibility: "shared",
      createdByUserId: userId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [courses.provider, courses.externalId],
      set: {
        name: scheduledCourse.name,
        country: scheduledCourse.country,
        updatedAt: now,
      },
    })
    .returning();
  const [teeSet] = await getDb()
    .insert(teeSets)
    .values({
      courseId: course.id,
      name: "Tournament tees",
      par: 72,
      courseRating: 72,
      slopeRating: 130,
      yards: 7000,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [teeSets.courseId, teeSets.name],
      set: {
        updatedAt: now,
      },
    })
    .returning();

  return { course, teeSet };
}

function hydrateTournamentListItem(input: {
  tournament: typeof tournaments.$inferSelect;
  entries: Array<typeof tournamentEntries.$inferSelect>;
  standings: Array<typeof tournamentStandings.$inferSelect>;
  course: typeof courses.$inferSelect | null;
  teeSet: typeof teeSets.$inferSelect | null;
  profiles: Map<string, typeof userProfiles.$inferSelect>;
  viewerUserId: string;
}) {
  const leader = input.standings.find((standing) => standing.rank === 1) ?? null;
  const leaderProfile = leader ? input.profiles.get(leader.userId) ?? null : null;
  const viewerStanding = input.standings.find((standing) => standing.userId === input.viewerUserId) ?? null;
  const scheduleKind = typeof input.tournament.metadataJson.scheduledKind === "string"
    ? (input.tournament.metadataJson.scheduledKind as ScheduledTournamentKind)
    : null;
  const scheduledKey = typeof input.tournament.metadataJson.scheduledKey === "string"
    ? input.tournament.metadataJson.scheduledKey
    : null;
  const scheduleEyebrow = typeof input.tournament.metadataJson.scheduleEyebrow === "string"
    ? input.tournament.metadataJson.scheduleEyebrow
    : null;

  return {
    id: input.tournament.id,
    title: input.tournament.title,
    description: input.tournament.description,
    format: input.tournament.format,
    visibility: input.tournament.visibility,
    status: input.tournament.status,
    startsAt: input.tournament.startsAt,
    endsAt: input.tournament.endsAt,
    roundCount: input.tournament.roundCount,
    directRapsodoRequired: input.tournament.directRapsodoRequired,
    screenshotRequired: input.tournament.screenshotRequired,
    scheduleKind,
    scheduledKey,
    scheduleEyebrow,
    courseName: input.course?.name ?? "Course TBD",
    teeSetName: input.teeSet?.name ?? "Any tee",
    entryCount: input.entries.length,
    viewerEntered: input.entries.some((entry) => entry.userId === input.viewerUserId),
    viewerRank: viewerStanding?.rank ?? null,
    leader:
      leader && leaderProfile
        ? {
            displayName: leaderProfile.displayName,
            username: leaderProfile.username,
            grossTotal: leader.grossTotal,
            roundsCompleted: leader.roundsCompleted,
          }
        : null,
  };
}

function tournamentTemplates() {
  return [
    {
      id: "spring-major-week",
      title: "Spring Major Week",
      format: "four_round_major" as const,
      roundCount: 4,
      description: "Four rounds, one course, one tee set, gross and net standings, optional cut after round two.",
      directRapsodoRequired: true,
      screenshotRequired: true,
    },
    {
      id: "weekend-open",
      title: "Weekend Open",
      format: "two_round_open" as const,
      roundCount: 2,
      description: "Two verified rounds with gross and net standings.",
      directRapsodoRequired: false,
      screenshotRequired: true,
    },
    {
      id: "course-record-sprint",
      title: "Course Record Sprint",
      format: "course_record_sprint" as const,
      roundCount: 1,
      description: "One-round board that can award a course champion badge.",
      directRapsodoRequired: false,
      screenshotRequired: true,
    },
  ];
}

function nextRoundNumber(roundCount: number, submissions: Array<typeof tournamentSubmissions.$inferSelect>) {
  const submitted = new Set(submissions.map((submission) => submission.roundNumber));

  for (let round = 1; round <= roundCount; round += 1) {
    if (!submitted.has(round)) {
      return round;
    }
  }

  return null;
}

function defaultRoundCount(format: string) {
  switch (format) {
    case "four_round_major":
      return 4;
    case "course_record_sprint":
      return 1;
    default:
      return 2;
  }
}

function defaultTournamentEnd(start: Date, roundCount: number) {
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + Math.max(2, roundCount * 2));
  return end;
}

function descriptionForFormat(format: string) {
  switch (format) {
    case "four_round_major":
      return "Four-round major-style event with verified Rapsodo evidence, scorecard screenshot proof and gross/net standings.";
    case "course_record_sprint":
      return "One-round sprint where the winner can take the course champion board.";
    case "matchplay":
      return "Head-to-head bracket competition.";
    case "order_of_merit":
      return "Season-long society table with points per event.";
    default:
      return "Two-round open event with verified submissions.";
  }
}

export function formatLabel(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 150);
}

function cleanText(value: string | null | undefined, fallback: string) {
  const clean = value?.trim();
  return clean || fallback;
}

function cleanOptional(value: string | null | undefined) {
  const clean = value?.trim();
  return clean ? clean.slice(0, 1200) : null;
}

function revalidateTournamentPaths(tournamentId: string) {
  revalidatePath("/tournaments");
  revalidatePath(`/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}/leaderboard`);
  revalidatePath(`/tournaments/${tournamentId}/submit`);
  revalidatePath("/feed");
  revalidatePath("/leaderboard");
  revalidatePath("/profile");
}
