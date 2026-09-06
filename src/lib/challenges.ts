import "server-only";
import { directionalMetricSql } from "@/lib/directional-confidence-sql";

import { and, asc, desc, eq, gte, inArray, isNull, lte, ne, or, type SQL } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  challengeAttempts,
  challengeComments,
  challengeEntries,
  challengeInvites,
  challengeResults,
  challengeTemplates,
  challenges,
  sessions,
  shots,
  userProfiles,
} from "@/db/schema";
import { getDb } from "@/db/client";
import { getActivePlanKeyForUser, planAllowsPrivateChallenges } from "@/lib/billing";
import { requireCurrentUserId } from "@/lib/current-user";
import { isShotEvidenceEligible, type ShotReviewStatus } from "@/lib/shot-review";
import {
  areFriends,
  createFeedItem,
  ensureSocialProfileForUser,
  getBlockedUserIds,
  getFriendIds,
  isBlockedBetween,
  parseVisibility,
  type SocialVisibility,
} from "@/lib/social";

export const challengeVerificationLabels = [
  "Rapsodo CSV",
  "Rapsodo Cloud",
  "Manual",
  "Unverified",
] as const;
export type ChallengeVerificationLabel = (typeof challengeVerificationLabels)[number];

type ChallengeRow = typeof challenges.$inferSelect;
type ChallengeTemplateRow = typeof challengeTemplates.$inferSelect;
type ChallengeAttemptRow = typeof challengeAttempts.$inferSelect;
type ChallengeEntryRow = typeof challengeEntries.$inferSelect;
type ChallengeResultRow = typeof challengeResults.$inferSelect;

export type ChallengeListItem = {
  id: string;
  title: string;
  description: string | null;
  visibility: SocialVisibility;
  status: string;
  startsAt: Date;
  endsAt: Date | null;
  templateName: string;
  templateSlug: string;
  scoringDirection: "asc" | "desc";
  participantCount: number;
  viewerJoined: boolean;
  viewerRank: number | null;
  viewerScore: number | null;
  viewerScoreLabel: string | null;
  viewerVerificationLabel: string | null;
  viewerEvidenceCount: number;
  evidenceTargetCount: number;
  evidenceRequirement: string;
  difficulty: "Starter" | "Progressing" | "Stretch";
  rulesSummary: string;
  rulesBullets: string[];
  leader: {
    userId: string;
    username: string;
    displayName: string;
    scoreLabel: string;
    verificationLabel: string;
  } | null;
};

export type ChallengeDetailData = {
  viewerUserId: string;
  challenge: ChallengeListItem & {
    creatorUserId: string;
    rulesJson: Record<string, unknown>;
    coachNote: string;
    rulesSummary: string;
    rulesBullets: string[];
  };
  templates: ChallengeTemplateRow[];
  entries: Array<{
    entry: ChallengeEntryRow;
    profile: {
      userId: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
    };
  }>;
  attempts: Array<{
    attempt: ChallengeAttemptRow;
    profile: {
      userId: string;
      username: string;
      displayName: string;
    };
  }>;
  results: Array<{
    result: ChallengeResultRow;
    verificationLabel: string;
    profile: {
      userId: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
    };
  }>;
  comments: Array<{
    id: string;
    body: string;
    createdAt: Date;
    profile: {
      username: string;
      displayName: string;
    };
  }>;
  friendOptions: Array<{
    userId: string;
    username: string;
    displayName: string;
  }>;
};

export async function getChallengesPageData() {
  const viewerUserId = await requireCurrentUserId();
  await ensureSocialProfileForUser(viewerUserId);
  const [templates, friendIds, blockedIds, joinedEntries] = await Promise.all([
    getDb()
      .select()
      .from(challengeTemplates)
      .where(eq(challengeTemplates.active, true))
      .orderBy(asc(challengeTemplates.name)),
    getFriendIds(viewerUserId),
    getBlockedUserIds(viewerUserId),
    getDb().select().from(challengeEntries).where(eq(challengeEntries.userId, viewerUserId)),
  ]);
  const joinedChallengeIds = joinedEntries.map((entry) => entry.challengeId);
  const visibleCreatorIds = [viewerUserId, ...friendIds].filter((id) => !blockedIds.has(id));
  const challengeRows = await getDb()
    .select()
    .from(challenges)
    .where(
      joinedChallengeIds.length > 0
        ? or(
            inArray(challenges.creatorUserId, visibleCreatorIds),
            eq(challenges.visibility, "public"),
            inArray(challenges.id, joinedChallengeIds),
          )
        : or(
            inArray(challenges.creatorUserId, visibleCreatorIds),
            eq(challenges.visibility, "public"),
          ),
    )
    .orderBy(desc(challenges.createdAt))
    .limit(80);
  const items = await hydrateChallengeListItems(challengeRows, viewerUserId, templates);

  return {
    templates,
    challenges: items,
    active: items.filter((item) => item.status === "open"),
    mine: items.filter((item) => item.viewerJoined),
  };
}

export async function getChallengeDetailData(
  challengeId: string,
): Promise<ChallengeDetailData | null> {
  const viewerUserId = await requireCurrentUserId();
  await ensureSocialProfileForUser(viewerUserId);
  const db = getDb();
  const [challenge] = await db
    .select()
    .from(challenges)
    .where(eq(challenges.id, challengeId))
    .limit(1);

  if (!challenge || !(await canViewChallenge(viewerUserId, challenge))) {
    return null;
  }

  const [templates, templateRows, entryRows, commentRows, friendIds] = await Promise.all([
    db
      .select()
      .from(challengeTemplates)
      .where(eq(challengeTemplates.active, true))
      .orderBy(asc(challengeTemplates.name)),
    challenge.templateId
      ? db
          .select()
          .from(challengeTemplates)
          .where(eq(challengeTemplates.id, challenge.templateId))
          .limit(1)
      : Promise.resolve([]),
    db
      .select()
      .from(challengeEntries)
      .where(eq(challengeEntries.challengeId, challengeId))
      .orderBy(asc(challengeEntries.joinedAt)),
    db
      .select()
      .from(challengeComments)
      .where(
        and(eq(challengeComments.challengeId, challengeId), isNull(challengeComments.deletedAt)),
      )
      .orderBy(asc(challengeComments.createdAt)),
    getFriendIds(viewerUserId),
  ]);
  const template = templateRows[0] ?? defaultTemplateForChallenge(challenge);
  const importedAttempts = await calculateImportedChallengeAttempts(challenge, template, entryRows);
  const importedResults = rankImportedChallengeAttempts(challenge, template, importedAttempts);
  const userIds = [
    ...new Set([
      challenge.creatorUserId,
      ...entryRows.map((entry) => entry.userId),
      ...importedAttempts.map((attempt) => attempt.userId),
      ...importedResults.map((result) => result.userId),
      ...commentRows.map((comment) => comment.userId),
      ...friendIds,
    ]),
  ];
  const profileMap = await challengeProfilesByUserId(userIds);
  const listItem = (await hydrateChallengeListItems([challenge], viewerUserId, templates))[0];

  if (!listItem) {
    return null;
  }

  return {
    viewerUserId,
    challenge: {
      ...listItem,
      creatorUserId: challenge.creatorUserId,
      rulesJson: normalizedRules(challenge, template),
      coachNote: challengeCoachNote(template),
      rulesSummary: challengeRulesSummary(challenge, template),
      rulesBullets: challengeRuleBullets(challenge, template),
    },
    templates,
    entries: entryRows
      .map((entry) => {
        const profile = profileMap.get(entry.userId);
        return profile ? { entry, profile } : null;
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row)),
    attempts: importedAttempts
      .map((attempt) => {
        const profile = profileMap.get(attempt.userId);
        return profile ? { attempt, profile } : null;
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row)),
    results: importedResults
      .map((result) => {
        const profile = profileMap.get(result.userId);
        const attempt = importedAttempts.find((item) => item.userId === result.userId);
        return profile
          ? { result, verificationLabel: attempt?.verificationLabel ?? "Imported shots", profile }
          : null;
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row)),
    comments: commentRows
      .map((comment) => {
        const profile = profileMap.get(comment.userId);
        return profile
          ? {
              id: comment.id,
              body: comment.body,
              createdAt: comment.createdAt,
              profile: {
                username: profile.username,
                displayName: profile.displayName,
              },
            }
          : null;
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row)),
    friendOptions: friendIds
      .map((friendId) => profileMap.get(friendId))
      .filter((profile): profile is NonNullable<typeof profile> => Boolean(profile))
      .map((profile) => ({
        userId: profile.userId,
        username: profile.username,
        displayName: profile.displayName,
      })),
  };
}

export async function createChallenge(input: {
  templateId: string;
  title: string;
  description?: string | null;
  visibility: SocialVisibility;
  startsAt?: Date | null;
  endsAt?: Date | null;
  inviteeUserIds?: string[];
}) {
  const creatorUserId = await requireCurrentUserId();
  const creatorProfile = await ensureSocialProfileForUser(creatorUserId);
  const [template] = await getDb()
    .select()
    .from(challengeTemplates)
    .where(eq(challengeTemplates.id, input.templateId))
    .limit(1);
  const visibility = parseVisibility(input.visibility, "friends");

  if (!template) {
    throw new Error("Challenge template not found.");
  }

  if (visibility !== "public") {
    const planKey = await getActivePlanKeyForUser(creatorUserId);

    if (!planAllowsPrivateChallenges(planKey)) {
      throw new Error("Private challenges require Plus, Pro, Coach / Club or Lifetime Full.");
    }
  }

  const title = input.title.trim() || template.name;
  const now = new Date();
  const [challenge] = await getDb().transaction(async (tx) => {
    const [created] = await tx
      .insert(challenges)
      .values({
        templateId: template.id,
        creatorUserId,
        title: title.slice(0, 180),
        description: cleanOptional(input.description),
        visibility,
        status: "open",
        challengeRulesJson: template.rulesJson,
        startsAt: input.startsAt ?? now,
        endsAt: input.endsAt ?? defaultChallengeEnd(now),
        updatedAt: now,
      })
      .returning();

    await tx.insert(challengeEntries).values({
      challengeId: created.id,
      userId: creatorUserId,
      status: "joined",
      updatedAt: now,
    });

    for (const inviteeUserId of new Set(input.inviteeUserIds ?? [])) {
      if (inviteeUserId === creatorUserId || !(await areFriends(creatorUserId, inviteeUserId))) {
        continue;
      }

      await tx
        .insert(challengeInvites)
        .values({
          challengeId: created.id,
          inviterUserId: creatorUserId,
          inviteeUserId,
        })
        .onConflictDoNothing({
          target: [challengeInvites.challengeId, challengeInvites.inviteeUserId],
        });
    }

    return [created];
  });

  await createFeedItem({
    userId: creatorUserId,
    itemType: "challenge_joined",
    headline: `${creatorProfile.displayName} started ${challenge.title}`,
    metricLabel: "Challenge",
    metricValue: template.name,
    context: challenge.description ?? template.description,
    proofUrl: `/challenges/${challenge.id}`,
    sourceType: "challenge",
    sourceId: challenge.id,
    visibility,
    verificationLabel: "Manual",
    dedupeKey: `challenge-started:${challenge.id}`,
  });

  revalidateChallengePaths(challenge.id);
  return challenge.id;
}

export async function joinChallenge(challengeId: string) {
  const userId = await requireCurrentUserId();
  const profile = await ensureSocialProfileForUser(userId);
  const challenge = await requireVisibleChallenge(userId, challengeId);
  const now = new Date();

  await getDb()
    .insert(challengeEntries)
    .values({
      challengeId,
      userId,
      status: "joined",
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [challengeEntries.challengeId, challengeEntries.userId],
      set: {
        status: "joined",
        updatedAt: now,
      },
    });

  await createFeedItem({
    userId,
    itemType: "challenge_joined",
    headline: `${profile.displayName} joined ${challenge.title}`,
    metricLabel: "Challenge",
    metricValue: "Joined",
    context: challenge.description,
    proofUrl: `/challenges/${challenge.id}`,
    sourceType: "challenge",
    sourceId: challenge.id,
    visibility: parseVisibility(challenge.visibility, "friends"),
    verificationLabel: "Manual",
    dedupeKey: `challenge-joined:${challenge.id}:${userId}`,
  });

  revalidateChallengePaths(challenge.id);
}

export async function leaveChallenge(challengeId: string) {
  const userId = await requireCurrentUserId();
  const challenge = await requireVisibleChallenge(userId, challengeId);

  if (challenge.creatorUserId === userId) {
    throw new Error("Challenge creators cannot leave their own challenge.");
  }

  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .delete(challengeResults)
      .where(
        and(eq(challengeResults.challengeId, challengeId), eq(challengeResults.userId, userId)),
      );
    await tx
      .delete(challengeEntries)
      .where(
        and(eq(challengeEntries.challengeId, challengeId), eq(challengeEntries.userId, userId)),
      );
  });

  revalidateChallengePaths(challengeId);
}

export async function submitChallengeAttempt(input: {
  challengeId: string;
  metricValue: number;
  verificationLabel: ChallengeVerificationLabel;
  notes?: string | null;
}) {
  const userId = await requireCurrentUserId();
  const profile = await ensureSocialProfileForUser(userId);
  const challenge = await requireVisibleChallenge(userId, input.challengeId);
  const [template] = challenge.templateId
    ? await getDb()
        .select()
        .from(challengeTemplates)
        .where(eq(challengeTemplates.id, challenge.templateId))
        .limit(1)
    : [];

  if (!Number.isFinite(input.metricValue)) {
    throw new Error("Attempt score must be a number.");
  }

  const now = new Date();
  const [entry] = await getDb()
    .insert(challengeEntries)
    .values({
      challengeId: challenge.id,
      userId,
      status: "completed",
      completedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [challengeEntries.challengeId, challengeEntries.userId],
      set: {
        status: "completed",
        completedAt: now,
        updatedAt: now,
      },
    })
    .returning();

  const [attempt] = await getDb()
    .insert(challengeAttempts)
    .values({
      challengeId: challenge.id,
      entryId: entry.id,
      userId,
      sourceType: input.verificationLabel === "Manual" ? "manual" : "launch_monitor",
      metricValue: input.metricValue,
      metricLabel: metricLabelForTemplate(template),
      verificationLabel: input.verificationLabel,
      notes: cleanOptional(input.notes),
    })
    .returning();

  const results = await recalculateChallengeResults(challenge.id);
  const result = results.find((item) => item.userId === userId);
  const visibility = parseVisibility(challenge.visibility, "friends");

  await createFeedItem({
    userId,
    itemType: "challenge_completed",
    headline: `${profile.displayName} completed ${challenge.title}`,
    metricLabel: attempt.metricLabel,
    metricValue: scoreLabel(input.metricValue, template),
    context: result?.rank ? `Current rank #${result.rank}` : "Attempt submitted",
    proofUrl: `/challenges/${challenge.id}`,
    sourceType: "challenge_attempt",
    sourceId: attempt.id,
    visibility,
    verificationLabel: input.verificationLabel,
    dedupeKey: `challenge-completed:${challenge.id}:${userId}:${attempt.id}`,
  });

  if (result?.rank === 1) {
    await createFeedItem({
      userId,
      itemType: "challenge_won",
      headline: `${profile.displayName} leads ${challenge.title}`,
      metricLabel: attempt.metricLabel,
      metricValue: scoreLabel(input.metricValue, template),
      context: "Top challenge result",
      proofUrl: `/challenges/${challenge.id}`,
      sourceType: "challenge_result",
      sourceId: `${challenge.id}:${userId}`,
      visibility,
      verificationLabel: input.verificationLabel,
      dedupeKey: `challenge-leader:${challenge.id}:${userId}`,
    });
  }

  revalidateChallengePaths(challenge.id);
}

export async function addChallengeComment(challengeId: string, body: string) {
  const userId = await requireCurrentUserId();
  await requireVisibleChallenge(userId, challengeId);
  const cleanBody = body.trim();

  if (!cleanBody) {
    throw new Error("Comment cannot be empty.");
  }

  await getDb()
    .insert(challengeComments)
    .values({
      challengeId,
      userId,
      body: cleanBody.slice(0, 1200),
      updatedAt: new Date(),
    });

  revalidateChallengePaths(challengeId);
}

export async function inviteFriendToChallenge(challengeId: string, inviteeUserId: string) {
  const inviterUserId = await requireCurrentUserId();
  const challenge = await requireVisibleChallenge(inviterUserId, challengeId);

  if (challenge.creatorUserId !== inviterUserId) {
    throw new Error("Only the challenge creator can invite friends.");
  }

  if (!(await areFriends(inviterUserId, inviteeUserId))) {
    throw new Error("You can only invite friends.");
  }

  await getDb()
    .insert(challengeInvites)
    .values({
      challengeId,
      inviterUserId,
      inviteeUserId,
      status: "pending",
    })
    .onConflictDoUpdate({
      target: [challengeInvites.challengeId, challengeInvites.inviteeUserId],
      set: {
        status: "pending",
        respondedAt: null,
      },
    });

  revalidateChallengePaths(challengeId);
}

export async function recalculateChallengeResults(challengeId: string) {
  const db = getDb();
  const [challenge] = await db
    .select()
    .from(challenges)
    .where(eq(challenges.id, challengeId))
    .limit(1);
  const [template] = challenge?.templateId
    ? await db
        .select()
        .from(challengeTemplates)
        .where(eq(challengeTemplates.id, challenge.templateId))
        .limit(1)
    : [];

  if (!challenge) {
    return [];
  }

  const attempts = await db
    .select()
    .from(challengeAttempts)
    .where(eq(challengeAttempts.challengeId, challengeId));
  const bestByUser = new Map<string, ChallengeAttemptRow>();
  const direction = scoringDirection(template);

  for (const attempt of attempts) {
    const current = bestByUser.get(attempt.userId);

    if (!current || isBetterScore(attempt.metricValue, current.metricValue, direction)) {
      bestByUser.set(attempt.userId, attempt);
    }
  }

  const ranked = [...bestByUser.values()].sort((a, b) =>
    direction === "desc" ? b.metricValue - a.metricValue : a.metricValue - b.metricValue,
  );
  const results: ChallengeResultRow[] = [];
  let rank = 1;

  for (const attempt of ranked) {
    const [row] = await db
      .insert(challengeResults)
      .values({
        challengeId,
        userId: attempt.userId,
        bestAttemptId: attempt.id,
        rank,
        score: attempt.metricValue,
        scoreLabel: scoreLabel(attempt.metricValue, template),
        metadataJson: {
          verificationLabel: attempt.verificationLabel,
        },
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [challengeResults.challengeId, challengeResults.userId],
        set: {
          bestAttemptId: attempt.id,
          rank,
          score: attempt.metricValue,
          scoreLabel: scoreLabel(attempt.metricValue, template),
          metadataJson: {
            verificationLabel: attempt.verificationLabel,
          },
          calculatedAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning();
    results.push(row);
    rank += 1;
  }

  return results;
}

async function hydrateChallengeListItems(
  challengeRows: ChallengeRow[],
  viewerUserId: string,
  templates: ChallengeTemplateRow[],
): Promise<ChallengeListItem[]> {
  if (challengeRows.length === 0) {
    return [];
  }

  const challengeIds = challengeRows.map((challenge) => challenge.id);
  const entryRows = await getDb()
    .select()
    .from(challengeEntries)
    .where(inArray(challengeEntries.challengeId, challengeIds));
  const userIds = [...new Set(entryRows.map((entry) => entry.userId))];
  const profileMap = await challengeProfilesByUserId(userIds);
  const templateMap = new Map(templates.map((template) => [template.id, template]));

  return Promise.all(
    challengeRows.map(async (challenge) => {
      const template =
        (challenge.templateId ? templateMap.get(challenge.templateId) : null) ??
        defaultTemplateForChallenge(challenge);
      const entries = entryRows.filter((entry) => entry.challengeId === challenge.id);
      const { attempts, evidenceCounts } = await calculateImportedChallengeAttemptState(
        challenge,
        template,
        entries,
      );
      const results = rankImportedChallengeAttempts(challenge, template, attempts);
      const leader =
        results.find((result) => result.rank === 1) ??
        results.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))[0];
      const leaderProfile = leader ? profileMap.get(leader.userId) : null;
      const leaderAttempt = leader
        ? attempts.find((attempt) => attempt.userId === leader.userId)
        : null;
      const viewerResult = results.find((result) => result.userId === viewerUserId);
      const viewerAttempt = attempts.find((attempt) => attempt.userId === viewerUserId);
      const rules = normalizedRules(challenge, template);
      const evidenceTargetCount = ruleNumber(rules, "minShots", 1);
      const viewerEvidenceCount = evidenceCounts.get(viewerUserId) ?? 0;

      return {
        id: challenge.id,
        title: challenge.title,
        description: challenge.description,
        visibility: parseVisibility(challenge.visibility, "friends"),
        status: challenge.status,
        startsAt: challenge.startsAt,
        endsAt: challenge.endsAt,
        templateName: template.name,
        templateSlug: template.slug,
        scoringDirection: scoringDirection(template),
        participantCount: entries.length,
        viewerJoined: entries.some((entry) => entry.userId === viewerUserId),
        viewerRank: viewerResult?.rank ?? null,
        viewerScore: viewerResult?.score ?? null,
        viewerScoreLabel: viewerResult?.scoreLabel ?? null,
        viewerVerificationLabel: viewerAttempt?.verificationLabel ?? null,
        viewerEvidenceCount,
        evidenceTargetCount,
        evidenceRequirement: challengeEvidenceRequirement(challenge, template),
        difficulty: challengeDifficulty(evidenceTargetCount),
        rulesSummary: challengeRulesSummary(challenge, template),
        rulesBullets: challengeRuleBullets(challenge, template),
        leader:
          leader && leaderProfile
            ? {
                userId: leader.userId,
                username: leaderProfile.username,
                displayName: leaderProfile.displayName,
                scoreLabel: leader.scoreLabel,
                verificationLabel: leaderAttempt?.verificationLabel ?? "Unverified",
              }
            : null,
      };
    }),
  );
}

function challengeDifficulty(minimumEvidence: number): ChallengeListItem["difficulty"] {
  if (minimumEvidence <= 5) return "Starter";
  if (minimumEvidence <= 12) return "Progressing";
  return "Stretch";
}

function challengeEvidenceRequirement(challenge: ChallengeRow, template: ChallengeTemplateRow) {
  const rules = normalizedRules(challenge, template);
  const minimumEvidence = ruleNumber(rules, "minShots", 1);
  const clubs = clubRuleLabel(ruleStringArray(rules, "clubTypes"));
  const shotLabel = minimumEvidence === 1 ? "shot" : "shots";

  return `${minimumEvidence} qualifying imported ${clubs ? `${clubs.toLowerCase()} ` : ""}${shotLabel}`;
}

async function calculateImportedChallengeAttempts(
  challenge: ChallengeRow,
  template: ChallengeTemplateRow,
  entries: ChallengeEntryRow[],
): Promise<ChallengeAttemptRow[]> {
  const { attempts } = await calculateImportedChallengeAttemptState(challenge, template, entries);
  return attempts;
}

async function calculateImportedChallengeAttemptState(
  challenge: ChallengeRow,
  template: ChallengeTemplateRow,
  entries: ChallengeEntryRow[],
) {
  const userIds = [...new Set(entries.map((entry) => entry.userId))];

  if (userIds.length === 0) {
    return { attempts: [] as ChallengeAttemptRow[], evidenceCounts: new Map<string, number>() };
  }

  const clauses: SQL[] = [
    inArray(shots.userId, userIds),
    ne(sessions.source, "manual"),
    gte(shots.shotAt, challenge.startsAt),
    inArray(shots.reviewStatus, ["included", "restored"]),
  ];

  if (challenge.endsAt) {
    clauses.push(lte(shots.shotAt, challenge.endsAt));
  }

  const shotRows = await getDb()
    .select({
      id: shots.id,
      userId: shots.userId,
      sessionId: shots.sessionId,
      shotAt: shots.shotAt,
      clubType: shots.clubType,
      carryYd: shots.carryYd,
      totalYd: shots.totalYd,
      sideCarryYd: directionalMetricSql(shots.sideCarryYd),
      launchDirectionDeg: directionalMetricSql(shots.launchDirectionDeg),
      shotCategory: shots.shotCategory,
      qualityTag: shots.qualityTag,
      reviewStatus: shots.reviewStatus,
      source: sessions.source,
      sessionDate: sessions.date,
    })
    .from(shots)
    .innerJoin(sessions, eq(shots.sessionId, sessions.id))
    .where(and(...clauses))
    .orderBy(asc(shots.shotAt));

  const eligibleShotRows = filterImportedChallengeEvidenceRows(shotRows);
  const rowsByUserId = new Map<string, typeof eligibleShotRows>();
  for (const row of eligibleShotRows) {
    const rows = rowsByUserId.get(row.userId) ?? [];
    rows.push(row);
    rowsByUserId.set(row.userId, rows);
  }

  const attempts: ChallengeAttemptRow[] = [];
  const evidenceCounts = new Map<string, number>();
  const rules = normalizedRules(challenge, template);
  const clubTypes = ruleStringArray(rules, "clubTypes");
  const practiceStreak = challengeTemplateKind(template) === "practice_streak";

  for (const entry of entries) {
    const userRows = rowsByUserId.get(entry.userId) ?? [];
    const eligibleRows = userRows.filter(
      (row) => clubTypes.length === 0 || clubMatches(row.clubType, clubTypes),
    );
    evidenceCounts.set(
      entry.userId,
      practiceStreak
        ? new Set(eligibleRows.map((row) => row.shotAt.toISOString().slice(0, 10))).size
        : eligibleRows.length,
    );
    const scored = scoreImportedChallengeRows(challenge, template, userRows);

    if (!scored) {
      continue;
    }

    attempts.push({
      id: `imported:${challenge.id}:${entry.userId}`,
      challengeId: challenge.id,
      entryId: entry.id,
      userId: entry.userId,
      sourceType: "imported_shots",
      sourceId: scored.latestSessionId,
      metricValue: scored.score,
      metricLabel: metricLabelForTemplate(template),
      verificationLabel: scored.verificationLabel,
      notes: `${scored.shotCount} imported shots counted from ${scored.sessionCount} session${scored.sessionCount === 1 ? "" : "s"}.`,
      metadataJson: {
        source: "imported_shots",
        shotCount: scored.shotCount,
        sessionCount: scored.sessionCount,
        latestSessionId: scored.latestSessionId,
        latestShotAt: scored.latestShotAt.toISOString(),
        rulesSummary: challengeRulesSummary(challenge, template),
      },
      attemptedAt: scored.latestShotAt,
      createdAt: scored.latestShotAt,
    });
  }

  return { attempts, evidenceCounts };
}

export function filterImportedChallengeEvidenceRows<
  T extends {
    reviewStatus?: ShotReviewStatus | null;
    qualityTag?: string | null;
    shotCategory?: string | null;
  },
>(rows: readonly T[]): T[] {
  return rows.filter(isShotEvidenceEligible);
}

function rankImportedChallengeAttempts(
  challenge: ChallengeRow,
  template: ChallengeTemplateRow,
  attempts: ChallengeAttemptRow[],
): ChallengeResultRow[] {
  const direction = scoringDirection(template);
  const now = new Date();

  return [...attempts]
    .sort((a, b) => {
      const scoreDelta =
        direction === "desc" ? b.metricValue - a.metricValue : a.metricValue - b.metricValue;
      return scoreDelta || a.attemptedAt.getTime() - b.attemptedAt.getTime();
    })
    .map((attempt, index) => ({
      id: `imported-result:${challenge.id}:${attempt.userId}`,
      challengeId: challenge.id,
      userId: attempt.userId,
      bestAttemptId: null,
      rank: index + 1,
      score: attempt.metricValue,
      scoreLabel: scoreLabel(attempt.metricValue, template),
      status: "active",
      metadataJson: {
        source: "imported_shots",
        attemptId: attempt.id,
        ...attempt.metadataJson,
      },
      calculatedAt: now,
      createdAt: attempt.createdAt,
      updatedAt: now,
    }));
}

function scoreImportedChallengeRows(
  challenge: ChallengeRow,
  template: ChallengeTemplateRow,
  rows: Array<{
    userId: string;
    sessionId: string;
    shotAt: Date;
    clubType: string;
    carryYd: number | null;
    totalYd: number | null;
    sideCarryYd: number | null;
    launchDirectionDeg: number | null;
    source: string;
  }>,
) {
  const rules = normalizedRules(challenge, template);
  const kind = challengeTemplateKind(template);
  const metric = typeof rules.metric === "string" ? rules.metric : "";
  const minShots = ruleNumber(rules, "minShots", kind === "practice_streak" ? 1 : 1);
  const clubTypes = ruleStringArray(rules, "clubTypes");
  const eligibleRows = rows.filter(
    (row) => clubTypes.length === 0 || clubMatches(row.clubType, clubTypes),
  );

  if (kind === "practice_streak") {
    const dayCount = new Set(eligibleRows.map((row) => row.shotAt.toISOString().slice(0, 10))).size;
    if (dayCount <= 0) {
      return null;
    }
    return importedScore(dayCount, eligibleRows);
  }

  if (eligibleRows.length < minShots) {
    return null;
  }

  if (kind === "longest_drive") {
    const distances = eligibleRows.map((row) => row.totalYd ?? row.carryYd).filter(isNumber);
    return distances.length >= minShots
      ? importedScore(Math.max(...distances), eligibleRows)
      : null;
  }

  if (kind === "straightest_drive") {
    const offlineValues = eligibleRows.map(offlineYards).filter(isNumber);
    return offlineValues.length >= minShots
      ? importedScore(Math.min(...offlineValues), eligibleRows)
      : null;
  }

  if (kind === "wedge_ladder") {
    const carries = eligibleRows.map((row) => row.carryYd).filter(isNumber);
    const targets = ladderTargets(rules);
    const errors = carries.map((carry) =>
      Math.min(...targets.map((target) => Math.abs(carry - target))),
    );
    return errors.length >= minShots ? importedScore(average(errors), eligibleRows) : null;
  }

  if (kind === "wedge_window") {
    const carries = eligibleRows.map((row) => row.carryYd).filter(isNumber);
    const [low, high] = targetRange(rules, [50, 90]);
    const errors = carries.map((carry) => {
      if (carry < low) return low - carry;
      if (carry > high) return carry - high;
      return 0;
    });
    return errors.length >= minShots ? importedScore(average(errors), eligibleRows) : null;
  }

  if (kind === "consistency") {
    const carries = eligibleRows.map((row) => row.carryYd).filter(isNumber);
    if (carries.length < minShots) {
      return null;
    }
    const score =
      metric === "carry_stddev"
        ? standardDeviation(carries)
        : Math.max(...carries) - Math.min(...carries);
    return importedScore(score, eligibleRows);
  }

  if (kind === "closest_to_pin") {
    const target = ruleNumber(rules, "targetYards", ruleNumber(rules, "targetYardage", 0));
    const distances = eligibleRows
      .map((row) => {
        const offline = offlineYards(row) ?? 0;
        if (target > 0 && isNumber(row.carryYd)) {
          return Math.hypot(row.carryYd - target, offline);
        }
        return offlineYards(row);
      })
      .filter(isNumber);
    return distances.length >= minShots
      ? importedScore(Math.min(...distances), eligibleRows)
      : null;
  }

  return null;
}

function importedScore(
  score: number,
  rows: Array<{
    sessionId: string;
    shotAt: Date;
    source: string;
  }>,
) {
  const latestRow = rows.reduce(
    (latest, row) => (row.shotAt > latest.shotAt ? row : latest),
    rows[0],
  );

  if (!latestRow) {
    return null;
  }

  return {
    score: roundMetric(score),
    verificationLabel: verificationLabelForImportedShots(rows),
    shotCount: rows.length,
    sessionCount: new Set(rows.map((row) => row.sessionId)).size,
    latestSessionId: latestRow.sessionId,
    latestShotAt: latestRow.shotAt,
  };
}

async function requireVisibleChallenge(viewerUserId: string, challengeId: string) {
  const [challenge] = await getDb()
    .select()
    .from(challenges)
    .where(eq(challenges.id, challengeId))
    .limit(1);

  if (!challenge || !(await canViewChallenge(viewerUserId, challenge))) {
    throw new Error("Challenge not found.");
  }

  return challenge;
}

async function canViewChallenge(viewerUserId: string, challenge: ChallengeRow) {
  if (challenge.creatorUserId === viewerUserId) {
    return true;
  }

  if (await isBlockedBetween(viewerUserId, challenge.creatorUserId)) {
    return false;
  }

  if (challenge.visibility === "public") {
    return true;
  }

  if (
    challenge.visibility === "friends" &&
    (await areFriends(viewerUserId, challenge.creatorUserId))
  ) {
    return true;
  }

  const [entry, invite] = await Promise.all([
    getDb()
      .select({ id: challengeEntries.id })
      .from(challengeEntries)
      .where(
        and(
          eq(challengeEntries.challengeId, challenge.id),
          eq(challengeEntries.userId, viewerUserId),
        ),
      )
      .limit(1),
    getDb()
      .select({ id: challengeInvites.id })
      .from(challengeInvites)
      .where(
        and(
          eq(challengeInvites.challengeId, challenge.id),
          eq(challengeInvites.inviteeUserId, viewerUserId),
        ),
      )
      .limit(1),
  ]);

  return Boolean(entry[0] || invite[0]);
}

async function challengeProfilesByUserId(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<
      string,
      { userId: string; username: string; displayName: string; avatarUrl: string | null }
    >();
  }

  const rows = await getDb()
    .select({
      userId: userProfiles.userId,
      username: userProfiles.username,
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
    })
    .from(userProfiles)
    .where(inArray(userProfiles.userId, userIds));

  return new Map(rows.map((row) => [row.userId, row]));
}

function normalizedRules(challenge: ChallengeRow, template: ChallengeTemplateRow) {
  return {
    ...template.rulesJson,
    ...challenge.challengeRulesJson,
  };
}

function challengeRulesSummary(challenge: ChallengeRow, template: ChallengeTemplateRow) {
  const rules = normalizedRules(challenge, template);
  const clubs = clubRuleLabel(ruleStringArray(rules, "clubTypes"));
  const minShots = ruleNumber(rules, "minShots", 1);

  switch (challengeTemplateKind(template)) {
    case "straightest_drive":
      return `Only ${clubs || "driver"} shots imported while the challenge is active count. The closest drive to the centre line wins automatically.`;
    case "wedge_ladder":
      return `Only ${clubs || "wedge"} shots imported while the challenge is active count. Each carry is scored against the ${ladderTargets(rules).join(", ")} yd ladder; lowest average error wins.`;
    case "wedge_window": {
      const [low, high] = targetRange(rules, [50, 90]);
      return `Only ${clubs || "wedge"} shots imported while the challenge is active count. Carries inside ${low}-${high} yd score best; lowest average miss wins.`;
    }
    case "consistency":
      return `Only ${clubs || "7i"} shots imported while the challenge is active count. You need ${minShots} qualifying shots; tightest carry window wins.`;
    case "longest_drive":
      return `Only ${clubs || "driver"} shots imported while the challenge is active count. The longest qualifying drive wins automatically.`;
    case "closest_to_pin":
      return "Only imported shots inside the challenge window count. Closest combined carry and side miss wins automatically.";
    case "practice_streak":
      return "Imported practice sessions inside the challenge window count automatically. Most active days wins.";
    default:
      return "Imported launch-monitor shots inside the challenge window count automatically. There is no separate challenge upload.";
  }
}

function challengeRuleBullets(challenge: ChallengeRow, template: ChallengeTemplateRow) {
  const rules = normalizedRules(challenge, template);
  const clubs = clubRuleLabel(ruleStringArray(rules, "clubTypes"));
  const minShots = ruleNumber(rules, "minShots", 1);
  const activeWindow = challenge.endsAt
    ? `${formatShortDate(challenge.startsAt)} to ${formatShortDate(challenge.endsAt)}`
    : `from ${formatShortDate(challenge.startsAt)}`;
  const bullets = [
    `Active window: ${activeWindow}. Only imported Rapsodo or launch-monitor shots in this window count.`,
    "New imports update the board automatically. There is no manual challenge upload or submit attempt.",
  ];

  switch (challengeTemplateKind(template)) {
    case "straightest_drive":
      bullets.unshift(
        `${clubs || "Driver"} shots only. Your score is the smallest side miss from the centre line; lowest score wins.`,
      );
      break;
    case "wedge_ladder":
      bullets.unshift(
        `${clubs || "Wedge"} shots only. Score each carry against the ${ladderTargets(rules).join(", ")} yd ladder; lowest average error wins.`,
      );
      break;
    case "wedge_window": {
      const [low, high] = targetRange(rules, [50, 90]);
      bullets.unshift(
        `${clubs || "Wedge"} shots only. Carries inside ${low}-${high} yd are on target; lowest average miss wins.`,
      );
      break;
    }
    case "consistency": {
      const metric = rules.metric === "carry_stddev" ? "carry standard deviation" : "carry spread";
      bullets.unshift(`${clubs || "7i"} shots only. Your score is ${metric}; lowest score wins.`);
      break;
    }
    case "longest_drive":
      bullets.unshift(`${clubs || "Driver"} shots only. Longest total distance wins.`);
      break;
    case "practice_streak":
      bullets.unshift(
        "Each day with at least one imported practice shot counts once; most days wins.",
      );
      break;
    default:
      bullets.unshift(
        `${clubs ? `${clubs} shots only. ` : ""}The template metric decides the score from imported shot data.`,
      );
      break;
  }

  if (minShots > 1) {
    bullets.splice(
      1,
      0,
      `Minimum requirement: ${minShots} qualifying shots before a player appears on the board.`,
    );
  }

  return bullets;
}

function scoringDirection(template: ChallengeTemplateRow | undefined | null): "asc" | "desc" {
  return template?.scoringDirection === "asc" ? "asc" : "desc";
}

function isBetterScore(candidate: number, current: number, direction: "asc" | "desc") {
  return direction === "desc" ? candidate > current : candidate < current;
}

function metricLabelForTemplate(template: ChallengeTemplateRow | undefined | null) {
  switch (challengeTemplateKind(template)) {
    case "longest_drive":
      return "Total distance";
    case "straightest_drive":
      return "Offline miss";
    case "wedge_window":
    case "wedge_ladder":
      return "Average error";
    case "consistency":
      return "Carry spread";
    case "closest_to_pin":
      return "Distance to pin";
    case "practice_streak":
      return "Practice days";
    default:
      return "Score";
  }
}

function scoreLabel(score: number, template: ChallengeTemplateRow | undefined | null) {
  switch (challengeTemplateKind(template)) {
    case "longest_drive":
      return `${score.toFixed(1)} yd`;
    case "straightest_drive":
      return `${score.toFixed(1)} yd offline`;
    case "wedge_window":
    case "wedge_ladder":
    case "closest_to_pin":
      return `${score.toFixed(1)} yd error`;
    case "consistency":
      return `${score.toFixed(1)} yd spread`;
    case "practice_streak":
      return `${Math.round(score)} days`;
    default:
      return score.toFixed(1);
  }
}

function ruleStringArray(rules: Record<string, unknown>, key: string) {
  const value = rules[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function ruleNumber(rules: Record<string, unknown>, key: string, fallback: number) {
  const value = rules[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function ruleNumberArray(rules: Record<string, unknown>, key: string) {
  const value = rules[key];
  return Array.isArray(value) ? value.filter(isNumber) : [];
}

function clubMatches(clubType: string, allowedClubTypes: string[]) {
  const club = normalizeClubType(clubType);
  const allowed = allowedClubTypes.map(normalizeClubType);

  return allowed.some((allowedClub) => {
    if (allowedClub === "wedge") {
      return ["pw", "gw", "aw", "sw", "lw", "wedge"].includes(club);
    }
    return club === allowedClub;
  });
}

function normalizeClubType(value: string) {
  const normalized = value.toLowerCase().replace(/[\s_-]+/g, "");
  const ironMatch = normalized.match(/^([1-9])iron$/);

  if (ironMatch) {
    return `${ironMatch[1]}i`;
  }

  if (normalized === "1w" || normalized === "dr" || normalized === "drv") {
    return "driver";
  }

  return normalized;
}

function clubRuleLabel(clubTypes: string[]) {
  if (clubTypes.length === 0) {
    return "";
  }

  const labels = [...new Set(clubTypes.map(formatClubLabel))];
  return labels.length <= 2
    ? labels.join(" and ")
    : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

function formatClubLabel(clubType: string) {
  const normalized = normalizeClubType(clubType);
  if (normalized === "driver") return "Driver";
  if (normalized === "wedge") return "wedge";
  if (/^[1-9]i$/.test(normalized)) return normalized;
  return clubType.toUpperCase();
}

function ladderTargets(rules: Record<string, unknown>) {
  const explicit = ruleNumberArray(rules, "targetLadderYards");
  if (explicit.length > 0) {
    return explicit;
  }

  const [low, high] = targetRange(rules, [50, 100]);
  const targets: number[] = [];
  for (let target = low; target <= high; target += 10) {
    targets.push(target);
  }
  return targets;
}

function targetRange(rules: Record<string, unknown>, fallback: [number, number]): [number, number] {
  const range = ruleNumberArray(rules, "targetRangeYards");
  if (range.length >= 2) {
    return [Math.min(range[0], range[1]), Math.max(range[0], range[1])];
  }
  return fallback;
}

function offlineYards(row: { sideCarryYd: number | null; launchDirectionDeg: number | null }) {
  if (isNumber(row.sideCarryYd)) {
    return Math.abs(row.sideCarryYd);
  }

  if (isNumber(row.launchDirectionDeg)) {
    return Math.abs(row.launchDirectionDeg * 2);
  }

  return null;
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]) {
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
}

function roundMetric(value: number) {
  return Math.round(value * 10) / 10;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function verificationLabelForImportedShots(rows: Array<{ source: string }>) {
  const sources = new Set(rows.map((row) => row.source));

  if (sources.has("rapsodo_cloud")) {
    return "Rapsodo Cloud";
  }

  if (sources.has("rapsodo")) {
    return "Rapsodo CSV";
  }

  return "Imported shots";
}

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(value);
}

function challengeCoachNote(template: ChallengeTemplateRow) {
  switch (challengeTemplateKind(template)) {
    case "longest_drive":
      return "Use your normal gamer driver, keep the attempt count tight, and avoid chasing speed after contact quality drops.";
    case "straightest_drive":
      return "Pick a clear start line and avoid steering it. Straight wins only when contact and launch are repeatable.";
    case "wedge_window":
      return "Pick one landing window, alternate clubs only when the carry number demands it, and reject outliers from poor contact.";
    case "wedge_ladder":
      return "Move through the ladder in order and record every target. The best score usually comes from tempo control, not one perfect wedge.";
    case "consistency":
      return "Warm up with half swings, then keep tempo fixed; the winning number is usually the smallest spread, not the longest shot.";
    case "closest_to_pin":
      return "Choose the shot that removes the big miss first. Distance control matters more than flag hunting.";
    case "practice_streak":
      return "Keep sessions short enough to repeat. A clean 20-shot session is better than one long session that disrupts the week.";
    default:
      return "Import qualifying launch-monitor shots during the challenge window; the board updates from those rows automatically.";
  }
}

function challengeTemplateKind(template: ChallengeTemplateRow | undefined | null) {
  if (!template) {
    return "custom";
  }

  switch (template.slug) {
    case "longest-drive":
      return "longest_drive";
    case "straightest-drive":
    case "demo-straightest-drive":
      return "straightest_drive";
    case "wedge-window":
      return "wedge_window";
    case "wedge-ladder":
    case "demo-wedge-ladder":
      return "wedge_ladder";
    case "7i-consistency":
    case "demo-7i-consistency":
      return "consistency";
    case "closest-to-pin":
      return "closest_to_pin";
    case "monthly-practice-streak":
      return "practice_streak";
    default:
      return template.challengeType;
  }
}

function defaultTemplateForChallenge(challenge: ChallengeRow): ChallengeTemplateRow {
  return {
    id: challenge.templateId ?? "custom",
    slug: "custom",
    name: "Custom challenge",
    description: "Custom challenge",
    challengeType: "custom",
    rulesJson: challenge.challengeRulesJson,
    scoringDirection: "desc",
    active: true,
    createdAt: challenge.createdAt,
    updatedAt: challenge.updatedAt,
  };
}

function defaultChallengeEnd(now: Date) {
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + 30);
  return end;
}

function cleanOptional(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function revalidateChallengePaths(challengeId: string) {
  revalidatePath("/challenges");
  revalidatePath(`/challenges/${challengeId}`);
  revalidatePath("/feed");
  revalidatePath("/leaderboard");
  revalidatePath("/dashboard");
}
