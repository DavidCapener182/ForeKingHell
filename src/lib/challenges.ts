import "server-only";

import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  challengeAttempts,
  challengeComments,
  challengeEntries,
  challengeInvites,
  challengeResults,
  challengeTemplates,
  challenges,
  userProfiles,
} from "@/db/schema";
import { getDb } from "@/db/client";
import { requireCurrentUserId } from "@/lib/current-user";
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

export const challengeVerificationLabels = ["Rapsodo CSV", "Rapsodo Cloud", "Manual", "Unverified"] as const;
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
  leader: {
    userId: string;
    username: string;
    displayName: string;
    scoreLabel: string;
    verificationLabel: string;
  } | null;
};

export type ChallengeDetailData = {
  challenge: ChallengeListItem & {
    creatorUserId: string;
    rulesJson: Record<string, unknown>;
    coachNote: string;
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
    getDb().select().from(challengeTemplates).where(eq(challengeTemplates.active, true)).orderBy(asc(challengeTemplates.name)),
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
        : or(inArray(challenges.creatorUserId, visibleCreatorIds), eq(challenges.visibility, "public")),
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

export async function getChallengeDetailData(challengeId: string): Promise<ChallengeDetailData | null> {
  const viewerUserId = await requireCurrentUserId();
  await ensureSocialProfileForUser(viewerUserId);
  const db = getDb();
  const [challenge] = await db.select().from(challenges).where(eq(challenges.id, challengeId)).limit(1);

  if (!challenge || !(await canViewChallenge(viewerUserId, challenge))) {
    return null;
  }

  const [templates, templateRows, entryRows, attemptRows, resultRows, commentRows, friendIds] = await Promise.all([
    db.select().from(challengeTemplates).where(eq(challengeTemplates.active, true)).orderBy(asc(challengeTemplates.name)),
    challenge.templateId
      ? db.select().from(challengeTemplates).where(eq(challengeTemplates.id, challenge.templateId)).limit(1)
      : Promise.resolve([]),
    db.select().from(challengeEntries).where(eq(challengeEntries.challengeId, challengeId)).orderBy(asc(challengeEntries.joinedAt)),
    db.select().from(challengeAttempts).where(eq(challengeAttempts.challengeId, challengeId)).orderBy(desc(challengeAttempts.attemptedAt)),
    db.select().from(challengeResults).where(eq(challengeResults.challengeId, challengeId)).orderBy(asc(challengeResults.rank)),
    db
      .select()
      .from(challengeComments)
      .where(and(eq(challengeComments.challengeId, challengeId), isNull(challengeComments.deletedAt)))
      .orderBy(asc(challengeComments.createdAt)),
    getFriendIds(viewerUserId),
  ]);
  const template = templateRows[0] ?? defaultTemplateForChallenge(challenge);
  const userIds = [
    ...new Set([
      challenge.creatorUserId,
      ...entryRows.map((entry) => entry.userId),
      ...attemptRows.map((attempt) => attempt.userId),
      ...resultRows.map((result) => result.userId),
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
    challenge: {
      ...listItem,
      creatorUserId: challenge.creatorUserId,
      rulesJson: normalizedRules(challenge, template),
      coachNote: challengeCoachNote(template),
    },
    templates,
    entries: entryRows
      .map((entry) => {
        const profile = profileMap.get(entry.userId);
        return profile ? { entry, profile } : null;
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row)),
    attempts: attemptRows
      .map((attempt) => {
        const profile = profileMap.get(attempt.userId);
        return profile ? { attempt, profile } : null;
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row)),
    results: resultRows
      .map((result) => {
        const profile = profileMap.get(result.userId);
        const attempt = attemptRows.find((item) => item.id === result.bestAttemptId);
        return profile ? { result, verificationLabel: attempt?.verificationLabel ?? "Unverified", profile } : null;
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
  const [template] = await getDb().select().from(challengeTemplates).where(eq(challengeTemplates.id, input.templateId)).limit(1);

  if (!template) {
    throw new Error("Challenge template not found.");
  }

  const visibility = parseVisibility(input.visibility, "friends");
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
    ? await getDb().select().from(challengeTemplates).where(eq(challengeTemplates.id, challenge.templateId)).limit(1)
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

  await getDb().insert(challengeComments).values({
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
  const [challenge] = await db.select().from(challenges).where(eq(challenges.id, challengeId)).limit(1);
  const [template] = challenge?.templateId
    ? await db.select().from(challengeTemplates).where(eq(challengeTemplates.id, challenge.templateId)).limit(1)
    : [];

  if (!challenge) {
    return [];
  }

  const attempts = await db.select().from(challengeAttempts).where(eq(challengeAttempts.challengeId, challengeId));
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
  const [entryRows, resultRows, attemptRows] = await Promise.all([
    getDb().select().from(challengeEntries).where(inArray(challengeEntries.challengeId, challengeIds)),
    getDb().select().from(challengeResults).where(inArray(challengeResults.challengeId, challengeIds)),
    getDb().select().from(challengeAttempts).where(inArray(challengeAttempts.challengeId, challengeIds)),
  ]);
  const userIds = [...new Set(resultRows.map((result) => result.userId))];
  const profileMap = await challengeProfilesByUserId(userIds);
  const templateMap = new Map(templates.map((template) => [template.id, template]));

  return challengeRows.map((challenge) => {
    const template = (challenge.templateId ? templateMap.get(challenge.templateId) : null) ?? defaultTemplateForChallenge(challenge);
    const entries = entryRows.filter((entry) => entry.challengeId === challenge.id);
    const results = resultRows.filter((result) => result.challengeId === challenge.id);
    const leader = results.find((result) => result.rank === 1) ?? results.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))[0];
    const leaderProfile = leader ? profileMap.get(leader.userId) : null;
    const leaderAttempt = leader ? attemptRows.find((attempt) => attempt.id === leader.bestAttemptId) : null;
    const viewerResult = results.find((result) => result.userId === viewerUserId);

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
  });
}

async function requireVisibleChallenge(viewerUserId: string, challengeId: string) {
  const [challenge] = await getDb().select().from(challenges).where(eq(challenges.id, challengeId)).limit(1);

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

  if (challenge.visibility === "friends" && (await areFriends(viewerUserId, challenge.creatorUserId))) {
    return true;
  }

  const [entry, invite] = await Promise.all([
    getDb()
      .select({ id: challengeEntries.id })
      .from(challengeEntries)
      .where(and(eq(challengeEntries.challengeId, challenge.id), eq(challengeEntries.userId, viewerUserId)))
      .limit(1),
    getDb()
      .select({ id: challengeInvites.id })
      .from(challengeInvites)
      .where(and(eq(challengeInvites.challengeId, challenge.id), eq(challengeInvites.inviteeUserId, viewerUserId)))
      .limit(1),
  ]);

  return Boolean(entry[0] || invite[0]);
}

async function challengeProfilesByUserId(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, { userId: string; username: string; displayName: string; avatarUrl: string | null }>();
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

function scoringDirection(template: ChallengeTemplateRow | undefined | null): "asc" | "desc" {
  return template?.scoringDirection === "asc" ? "asc" : "desc";
}

function isBetterScore(candidate: number, current: number, direction: "asc" | "desc") {
  return direction === "desc" ? candidate > current : candidate < current;
}

function metricLabelForTemplate(template: ChallengeTemplateRow | undefined | null) {
  switch (template?.slug) {
    case "longest-drive":
      return "Total distance";
    case "wedge-window":
      return "Average error";
    case "7i-consistency":
      return "Carry spread";
    case "closest-to-pin":
      return "Distance to pin";
    case "monthly-practice-streak":
      return "Practice days";
    default:
      return "Score";
  }
}

function scoreLabel(score: number, template: ChallengeTemplateRow | undefined | null) {
  switch (template?.slug) {
    case "longest-drive":
      return `${score.toFixed(1)} yd`;
    case "wedge-window":
    case "closest-to-pin":
      return `${score.toFixed(1)} yd error`;
    case "7i-consistency":
      return `${score.toFixed(1)} yd spread`;
    case "monthly-practice-streak":
      return `${Math.round(score)} days`;
    default:
      return score.toFixed(1);
  }
}

function challengeCoachNote(template: ChallengeTemplateRow) {
  switch (template.slug) {
    case "longest-drive":
      return "Use your normal gamer driver, keep the attempt count tight, and avoid chasing speed after contact quality drops.";
    case "wedge-window":
      return "Pick one landing window, alternate clubs only when the carry number demands it, and reject outliers from poor contact.";
    case "7i-consistency":
      return "Warm up with half swings, then keep tempo fixed; the winning number is usually the smallest spread, not the longest shot.";
    case "closest-to-pin":
      return "Choose the shot that removes the big miss first. Distance control matters more than flag hunting.";
    case "monthly-practice-streak":
      return "Keep sessions short enough to repeat. A clean 20-shot session is better than one long session that disrupts the week.";
    default:
      return "Submit a clean, repeatable attempt and use verified launch-monitor data when possible.";
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
