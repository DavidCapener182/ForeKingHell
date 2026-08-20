"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, ne } from "drizzle-orm";

import { clubs, courses, holes, sessions, shareLinks, shots, teeSets, users } from "@/db/schema";
import { getDb } from "@/db/client";
import { setAchievementUnlockFlash } from "@/lib/achievements/notification-flash";
import { evaluateRoundAchievementsForSession } from "@/lib/achievements/service";
import {
  inferCourseShots,
  inferCourseShotsFromHoleShotCounts,
  type CourseScorecardHole,
} from "@/lib/course-scorecard";
import { requireCurrentUserId } from "@/lib/current-user";
import { buildClubKey, normalizeClubType, type ParsedRapsodoShot } from "@/lib/rapsodo/parser";
import { createShareToken, getShareExpiry, hashShareToken } from "@/lib/share-links";
import { isShotEvidenceEligible } from "@/lib/shot-review";
import { recordRoundCompletedFeedItem } from "@/lib/social";

type StoredScorecardHole = NonNullable<(typeof sessions.$inferSelect)["scorecardJson"]>[number];

export async function createManualRoundAction(formData: FormData) {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const teeSetId = requiredString(formData, "teeSetId");
  const notes = nullableString(formData, "notes");
  const equipmentNotes = nullableString(formData, "equipmentNotes");
  const roundStatus = parseRoundStatus(formData);
  const date = dateFromForm(formData, "date");
  const holeCount = numberFromForm(formData, "holeCount") ?? 18;
  const now = new Date();

  const [teeSet] = await db
    .select({
      id: teeSets.id,
      name: teeSets.name,
      courseId: teeSets.courseId,
      courseName: courses.name,
    })
    .from(teeSets)
    .innerJoin(courses, eq(teeSets.courseId, courses.id))
    .where(eq(teeSets.id, teeSetId))
    .limit(1);

  if (!teeSet) {
    throw new Error("Tee set not found.");
  }

  const scorecardJson = Array.from({ length: holeCount }, (_, index): StoredScorecardHole => {
    const holeNumber = numberFromForm(formData, `holeNumber-${index}`) ?? index + 1;

    return {
      holeNumber,
      par: numberFromForm(formData, `par-${index}`) ?? 4,
      yards: numberFromForm(formData, `yards-${index}`) ?? 0,
      name: null,
      strokeIndex: numberFromForm(formData, `strokeIndex-${index}`),
      score: numberFromForm(formData, `score-${index}`),
      putts: numberFromForm(formData, `putts-${index}`),
      penalties: numberFromForm(formData, `penalties-${index}`),
      chipShots: numberFromForm(formData, `chipShots-${index}`),
      greensideSandShots: numberFromForm(formData, `greensideSandShots-${index}`),
      fairwayHit: booleanFromForm(formData, `fairwayHit-${index}`),
      gir: booleanFromForm(formData, `gir-${index}`),
      csvShotCount: 0,
      progressYd: 0,
      distanceRemainingYd: numberFromForm(formData, `yards-${index}`) ?? 0,
    };
  });

  const [session] = await db.transaction(async (tx) => {
    await tx
      .insert(users)
      .values({
        id: userId,
        preferredUnits: "yards",
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          updatedAt: now,
        },
      });

    return tx
      .insert(sessions)
      .values({
        userId,
        source: "manual",
        type: "real_round",
        date,
        courseId: teeSet.courseId,
        teeSetId: teeSet.id,
        location: teeSet.courseName,
        courseName: teeSet.courseName,
        roundStatus,
        weatherJson: parseWeather(formData),
        scorecardJson,
        notes,
        equipmentNotes,
        rawUploadId: `manual-round-${randomUUID()}`,
        fileName: `${teeSet.courseName} ${date.toISOString().slice(0, 10)}.scorecard`,
        rawCsvText: "",
        createdAt: now,
      })
      .returning({ id: sessions.id });
  });

  await evaluateRoundAchievementsForSessionWithFlash(session.id, userId);
  await recordRoundCompletedFeedItem({
    userId,
    sessionId: session.id,
    courseName: teeSet.courseName,
    score: scorecardTotal(scorecardJson),
    source: "manual",
  });
  revalidateRound(session.id);
  redirect(`/rounds/${session.id}`);
}

export async function updateRoundContextAction(formData: FormData) {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const sessionId = requiredString(formData, "sessionId");

  await db
    .update(sessions)
    .set({
      roundStatus: parseRoundStatus(formData),
      weatherJson: parseWeather(formData),
      equipmentNotes: nullableString(formData, "equipmentNotes"),
      notes: nullableString(formData, "notes"),
    })
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));

  revalidateRound(sessionId);
}

export async function createRoundShareLinkAction(formData: FormData) {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const sessionId = requiredString(formData, "sessionId");
  const expiryDays = numberFromForm(formData, "expiryDays");
  const token = createShareToken();
  const now = new Date();
  const [round] = await db
    .select({ id: sessions.id, courseName: sessions.courseName, fileName: sessions.fileName })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .limit(1);

  if (!round) {
    throw new Error("Round not found.");
  }

  await db.insert(shareLinks).values({
    userId,
    tokenHash: hashShareToken(token),
    resourceType: "round",
    resourceId: round.id,
    title: round.courseName ?? round.fileName ?? "Shared round",
    expiresAt: getShareExpiry(expiryDays, now),
    updatedAt: now,
  });

  revalidateRound(sessionId);
  redirect(`/rounds/${sessionId}?share=${encodeURIComponent(token)}`);
}

export async function createCourseTwinReplayShareLinkAction(formData: FormData) {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const sessionId = requiredString(formData, "sessionId");
  const token = createShareToken();
  const now = new Date();
  const [round] = await db
    .select({
      id: sessions.id,
      courseId: sessions.courseId,
      courseName: sessions.courseName,
      fileName: sessions.fileName,
    })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .limit(1);

  if (!round?.courseId) {
    throw new Error("This round is not linked to a playable Course Twin.");
  }

  await db.insert(shareLinks).values({
    userId,
    tokenHash: hashShareToken(token),
    resourceType: "course_twin_replay",
    resourceId: round.id,
    title: `${round.courseName ?? round.fileName ?? "Round"} 3D replay`,
    expiresAt: getShareExpiry(30, now),
    updatedAt: now,
  });

  revalidateRound(sessionId);
  redirect(`/share/course-twin/${encodeURIComponent(token)}`);
}

export async function revokeRoundShareLinkAction(formData: FormData) {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const sessionId = requiredString(formData, "sessionId");
  const shareLinkId = requiredString(formData, "shareLinkId");

  await db
    .update(shareLinks)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(shareLinks.id, shareLinkId),
        eq(shareLinks.userId, userId),
        eq(shareLinks.resourceId, sessionId),
      ),
    );

  revalidateRound(sessionId);
}

export async function updateRoundCourseLinkAction(formData: FormData) {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const sessionId = requiredString(formData, "sessionId");
  const teeSetId = requiredString(formData, "teeSetId");

  const [session, teeSet, holeRows] = await Promise.all([
    db
      .select({ scorecardJson: sessions.scorecardJson })
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({
        id: teeSets.id,
        courseId: teeSets.courseId,
        courseName: courses.name,
      })
      .from(teeSets)
      .innerJoin(courses, eq(teeSets.courseId, courses.id))
      .where(eq(teeSets.id, teeSetId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({
        holeNumber: holes.holeNumber,
        par: holes.par,
        yards: holes.yards,
        strokeIndex: holes.strokeIndex,
      })
      .from(holes)
      .where(eq(holes.teeSetId, teeSetId))
      .orderBy(asc(holes.holeNumber)),
  ]);

  if (!session || !teeSet) {
    throw new Error("Round or tee set not found.");
  }

  await db
    .update(sessions)
    .set({
      courseId: teeSet.courseId,
      teeSetId: teeSet.id,
      courseName: teeSet.courseName,
      location: teeSet.courseName,
      scorecardJson: mergeScorecardForTee(session.scorecardJson ?? [], holeRows),
    })
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));

  await recalculateRoundAssignments(sessionId);
  await evaluateRoundAchievementsForSessionWithFlash(sessionId, userId);
  revalidateRound(sessionId);
}

export async function updateShotClubAction(formData: FormData) {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const sessionId = requiredString(formData, "sessionId");
  const shotId = requiredString(formData, "shotId");
  const clubId = requiredString(formData, "clubId");

  const [club] = await db
    .select({ id: clubs.id, type: clubs.type })
    .from(clubs)
    .where(and(eq(clubs.id, clubId), eq(clubs.userId, userId)))
    .limit(1);

  if (!club) {
    throw new Error("Club not found.");
  }

  const [updatedShot] = await db
    .update(shots)
    .set({
      clubId: club.id,
      clubType: club.type,
    })
    .where(and(eq(shots.id, shotId), eq(shots.sessionId, sessionId), eq(shots.userId, userId)))
    .returning({ id: shots.id });

  if (!updatedShot) {
    throw new Error("Shot not found.");
  }

  await evaluateRoundAchievementsForSessionWithFlash(sessionId, userId);
  revalidateRound(sessionId);
}

export async function updateClubAction(formData: FormData) {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const sessionId = requiredString(formData, "sessionId");
  const clubId = requiredString(formData, "clubId");
  const clubType = normalizeClubType(requiredString(formData, "clubType"));
  const brand = nullableString(formData, "brand");
  const model = nullableString(formData, "model");
  const normalizedClubKey = buildClubKey(clubType, brand, model);
  const now = new Date();
  const [session] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .limit(1);

  if (!session) {
    throw new Error("Round not found.");
  }

  const [currentClub] = await db
    .select({ id: clubs.id, userId: clubs.userId })
    .from(clubs)
    .where(and(eq(clubs.id, clubId), eq(clubs.userId, userId)))
    .limit(1);

  if (!currentClub) {
    throw new Error("Club not found.");
  }

  const [duplicateClub] = await db
    .select({ id: clubs.id, type: clubs.type })
    .from(clubs)
    .where(
      and(
        eq(clubs.userId, currentClub.userId),
        eq(clubs.normalizedClubKey, normalizedClubKey),
        ne(clubs.id, clubId),
      ),
    )
    .limit(1);

  if (duplicateClub) {
    await db.transaction(async (tx) => {
      await tx
        .update(shots)
        .set({ clubId: duplicateClub.id, clubType: duplicateClub.type })
        .where(and(eq(shots.clubId, clubId), eq(shots.userId, userId)));
      await tx
        .update(clubs)
        .set({ active: false, updatedAt: now })
        .where(and(eq(clubs.id, clubId), eq(clubs.userId, userId)));
    });
  } else {
    await db.transaction(async (tx) => {
      await tx
        .update(clubs)
        .set({
          type: clubType,
          brand,
          model,
          normalizedClubKey,
          active: true,
          updatedAt: now,
        })
        .where(and(eq(clubs.id, clubId), eq(clubs.userId, userId)));
      await tx
        .update(shots)
        .set({ clubType })
        .where(and(eq(shots.clubId, clubId), eq(shots.userId, userId)));
    });
  }

  await evaluateRoundAchievementsForSessionWithFlash(sessionId, userId);
  revalidateRound(sessionId);
}

export async function updateRoundHoleAction(formData: FormData) {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const sessionId = requiredString(formData, "sessionId");
  const holeNumber = numberFromForm(formData, "holeNumber");

  if (holeNumber === null) {
    throw new Error("Hole number is required.");
  }

  const [session] = await db
    .select({ scorecardJson: sessions.scorecardJson })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .limit(1);

  if (!session?.scorecardJson) {
    throw new Error("Round scorecard not found.");
  }

  const holes = session.scorecardJson.map<StoredScorecardHole>((hole) => {
    if (hole.holeNumber !== holeNumber) {
      return hole;
    }

    const score = numberFromForm(formData, "score");
    const updatedHole: StoredScorecardHole = {
      ...hole,
      score,
      putts: numberFromForm(formData, "putts"),
      penalties: numberFromForm(formData, "penalties"),
      fairwayHit: booleanFromForm(formData, "fairwayHit"),
      gir: booleanFromForm(formData, "gir"),
    };

    if (formData.has("chipShots")) {
      updatedHole.chipShots = numberFromForm(formData, "chipShots");
    }

    if (formData.has("greensideSandShots")) {
      updatedHole.greensideSandShots = numberFromForm(formData, "greensideSandShots");
    }

    if (
      typeof hole.netScore === "number" &&
      typeof hole.score === "number" &&
      typeof score === "number"
    ) {
      updatedHole.netScore = Math.max(0, hole.netScore + score - hole.score);
    }

    return updatedHole;
  });

  await db
    .update(sessions)
    .set({ scorecardJson: holes })
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));
  await recalculateRoundAssignments(sessionId);
  await evaluateRoundAchievementsForSessionWithFlash(sessionId, userId);
  revalidateRound(sessionId);
}

export async function resplitRoundAction(formData: FormData) {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const sessionId = requiredString(formData, "sessionId");
  const [session] = await db
    .select({ scorecardJson: sessions.scorecardJson })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .limit(1);

  if (!session?.scorecardJson) {
    throw new Error("Round scorecard not found.");
  }

  const loadedSessionShots = await db
    .select({
      id: shots.id,
      shotNumber: shots.shotNumber,
      reviewStatus: shots.reviewStatus,
      qualityTag: shots.qualityTag,
      shotCategory: shots.shotCategory,
    })
    .from(shots)
    .where(and(eq(shots.sessionId, sessionId), eq(shots.userId, userId)))
    .orderBy(asc(shots.shotNumber), asc(shots.createdAt));
  const sessionShots = loadedSessionShots.filter(isShotEvidenceEligible);
  let cursor = 0;

  for (const hole of session.scorecardJson.sort(
    (left, right) => left.holeNumber - right.holeNumber,
  )) {
    const count = Math.min(12, numberFromForm(formData, `holeCount-${hole.holeNumber}`) ?? 0);
    const holeShots = sessionShots.slice(cursor, cursor + count);

    for (const shot of holeShots) {
      await db
        .update(shots)
        .set({ courseHoleNumber: hole.holeNumber })
        .where(
          and(eq(shots.id, shot.id), eq(shots.sessionId, sessionId), eq(shots.userId, userId)),
        );
    }

    cursor += count;
  }

  for (const shot of sessionShots.slice(cursor)) {
    await db
      .update(shots)
      .set({
        courseHoleNumber: null,
        courseHoleShotNumber: null,
        courseHolePar: null,
        courseHoleYards: null,
        distanceRemainingYd: null,
      })
      .where(and(eq(shots.id, shot.id), eq(shots.sessionId, sessionId), eq(shots.userId, userId)));
  }

  await recalculateRoundAssignments(sessionId);
  await evaluateRoundAchievementsForSessionWithFlash(sessionId, userId);
  revalidateRound(sessionId);
}

async function evaluateRoundAchievementsForSessionWithFlash(
  sessionId: string,
  actorUserId: string,
) {
  const result = await evaluateRoundAchievementsForSession(sessionId, actorUserId);
  await setAchievementUnlockFlash(result.unlockedAchievements);
  return result;
}

async function recalculateRoundAssignments(sessionId: string) {
  const db = getDb();
  const [session] = await db
    .select({ scorecardJson: sessions.scorecardJson, userId: sessions.userId })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!session?.scorecardJson) {
    return;
  }

  const loadedSessionShots = await db
    .select({
      id: shots.id,
      shotNumber: shots.shotNumber,
      carryYd: shots.carryYd,
      totalYd: shots.totalYd,
      sideCarryYd: shots.sideCarryYd,
      clubType: shots.clubType,
      courseHoleNumber: shots.courseHoleNumber,
      reviewStatus: shots.reviewStatus,
      qualityTag: shots.qualityTag,
      shotCategory: shots.shotCategory,
    })
    .from(shots)
    .where(and(eq(shots.sessionId, sessionId), eq(shots.userId, session.userId)))
    .orderBy(asc(shots.shotNumber), asc(shots.createdAt));
  const sessionShots = loadedSessionShots.filter(isShotEvidenceEligible);
  const sortedScorecard = session.scorecardJson
    .slice()
    .sort((left, right) => left.holeNumber - right.holeNumber);
  const inferredHoleByShotId =
    sessionShots.length > 0 && sessionShots.every((shot) => !shot.courseHoleNumber)
      ? inferUnmappedShotHoles(sortedScorecard, sessionShots)
      : new Map<string, number>();
  const shotsByHole = new Map<number, typeof sessionShots>();

  for (const shot of sessionShots) {
    const courseHoleNumber = shot.courseHoleNumber ?? inferredHoleByShotId.get(shot.id) ?? null;

    if (!courseHoleNumber) {
      continue;
    }

    const existing = shotsByHole.get(courseHoleNumber) ?? [];
    existing.push({ ...shot, courseHoleNumber });
    shotsByHole.set(courseHoleNumber, existing);
  }

  const nextScorecard = await Promise.all(
    sortedScorecard.map(async (hole) => {
      const holeShots = shotsByHole.get(hole.holeNumber) ?? [];
      let progressYd = 0;

      for (const [index, shot] of holeShots.entries()) {
        progressYd += forwardDistanceYd(shot.totalYd ?? shot.carryYd, shot.sideCarryYd) ?? 0;

        await db
          .update(shots)
          .set({
            courseHoleNumber: hole.holeNumber,
            courseHoleShotNumber: index + 1,
            courseHolePar: hole.par,
            courseHoleYards: hole.yards,
            distanceRemainingYd: roundOne(Math.max(0, hole.yards - progressYd)),
            shotCategory: classifyCourseShot(
              shot.clubType,
              shot.totalYd ?? shot.carryYd,
              index + 1,
            ),
          })
          .where(
            and(
              eq(shots.id, shot.id),
              eq(shots.sessionId, sessionId),
              eq(shots.userId, session.userId),
            ),
          );
      }

      const penalties = hole.penalties ?? 0;
      const putts =
        typeof hole.score === "number" && holeShots.length > 0
          ? Math.max(0, hole.score - holeShots.length - penalties)
          : (hole.putts ?? null);

      return {
        ...hole,
        csvShotCount: holeShots.length,
        progressYd: roundOne(progressYd),
        distanceRemainingYd: roundOne(Math.max(0, hole.yards - progressYd)),
        putts,
        penalties,
      };
    }),
  );

  await db
    .update(sessions)
    .set({ scorecardJson: nextScorecard })
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, session.userId)));
}

function inferUnmappedShotHoles(
  scorecard: StoredScorecardHole[],
  sessionShots: Array<{
    id: string;
    shotNumber: number | null;
    carryYd: number | null;
    totalYd: number | null;
    sideCarryYd: number | null;
    clubType: string;
  }>,
) {
  const scorecardHoles = scorecard.map<CourseScorecardHole>((hole) => ({
    holeNumber: hole.holeNumber,
    par: hole.par,
    yards: hole.yards,
    name: hole.name,
  }));
  const parsedShots = sessionShots.map<ParsedRapsodoShot>((shot, index) => ({
    rowNumber: index + 1,
    shotNumber: shot.shotNumber,
    clubTypeRaw: shot.clubType,
    clubType: shot.clubType,
    clubLabel: shot.clubType,
    clubBrand: null,
    clubModel: null,
    clubKey: shot.clubType,
    carryYd: shot.carryYd,
    totalYd: shot.totalYd,
    ballSpeedMph: null,
    clubSpeedMph: null,
    launchAngleDeg: null,
    launchDirectionDeg: null,
    apexFt: null,
    sideCarryYd: shot.sideCarryYd,
    attackAngleDeg: null,
    clubPathDeg: null,
    faceAngleDeg: null,
    descentAngleDeg: null,
    smashFactor: null,
    spinRate: null,
    spinAxis: null,
    shotShape: null,
    shotCategory: "full",
    qualityTag: null,
    clubDataEstType: null,
    sourceRawJson: {},
    warnings: [],
  }));
  const knownShotCounts = scorecardShotCountsFromStrokeAccounting(scorecard, sessionShots.length);
  const inferred = knownShotCounts
    ? inferCourseShotsFromHoleShotCounts(parsedShots, scorecardHoles, knownShotCounts)
    : inferCourseShots(parsedShots, scorecardHoles);
  const holeByShotId = new Map<string, number>();

  for (const courseShot of inferred.shots) {
    const shot = sessionShots[courseShot.absoluteShotNumber - 1];

    if (shot) {
      holeByShotId.set(shot.id, courseShot.holeNumber);
    }
  }

  return holeByShotId;
}

function scorecardShotCountsFromStrokeAccounting(
  scorecard: StoredScorecardHole[],
  totalShotCount: number,
) {
  const shotCounts: Array<{ holeNumber: number; shotCount: number }> = [];
  let accountedShots = 0;

  for (const hole of scorecard) {
    if (typeof hole.score !== "number" || typeof hole.putts !== "number") {
      return null;
    }

    const penalties = hole.penalties ?? 0;
    const shotCount = hole.score - hole.putts - penalties;

    if (!Number.isFinite(shotCount) || shotCount < 0) {
      return null;
    }

    const roundedShotCount = Math.floor(shotCount);
    accountedShots += roundedShotCount;
    shotCounts.push({ holeNumber: hole.holeNumber, shotCount: roundedShotCount });
  }

  return accountedShots === totalShotCount ? shotCounts : null;
}

function mergeScorecardForTee(
  existingScorecard: StoredScorecardHole[],
  holeRows: Array<{
    holeNumber: number;
    par: number;
    yards: number;
    strokeIndex: number | null;
  }>,
) {
  if (holeRows.length === 0) {
    return existingScorecard;
  }

  const existingByHole = new Map(existingScorecard.map((hole) => [hole.holeNumber, hole]));

  return holeRows.map<StoredScorecardHole>((hole) => {
    const existing = existingByHole.get(hole.holeNumber);

    return {
      ...existing,
      holeNumber: hole.holeNumber,
      par: hole.par,
      yards: hole.yards,
      strokeIndex: hole.strokeIndex,
      name: existing?.name ?? null,
      csvShotCount: existing?.csvShotCount ?? 0,
      progressYd: existing?.progressYd ?? 0,
      distanceRemainingYd: existing?.distanceRemainingYd ?? hole.yards,
    };
  });
}

function requiredString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} is required.`);
  }

  return value.trim();
}

function dateFromForm(formData: FormData, key: string) {
  const value = requiredString(formData, key);
  const parsed = new Date(`${value}T12:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${key} is not a valid date.`);
  }

  return parsed;
}

function nullableString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberFromForm(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : null;
}

function booleanFromForm(formData: FormData, key: string) {
  const value = formData.get(key);

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return null;
}

function parseRoundStatus(formData: FormData) {
  return formData.get("roundStatus") === "in_progress" ? "in_progress" : "complete";
}

function parseWeather(formData: FormData) {
  return {
    conditions: nullableString(formData, "weatherConditions"),
    wind: nullableString(formData, "wind"),
    temperature: nullableString(formData, "temperature"),
  };
}

function scorecardTotal(scorecard: StoredScorecardHole[]) {
  const scores = scorecard
    .map((hole) => hole.score)
    .filter((score): score is number => typeof score === "number" && Number.isFinite(score));

  return scores.length > 0 ? scores.reduce((total, score) => total + score, 0) : null;
}

function revalidateRound(sessionId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/bag");
  revalidatePath("/shots");
  revalidatePath("/rounds");
  revalidatePath("/handicap");
  revalidatePath("/progress");
  revalidatePath("/courses");
  revalidatePath(`/rounds/${sessionId}`);
  revalidatePath("/achievements");
}

function forwardDistanceYd(distanceYd: number | null, sideYd: number | null) {
  if (distanceYd === null) {
    return null;
  }

  const sideDistance = sideYd ?? 0;
  const forwardSquared = distanceYd ** 2 - sideDistance ** 2;

  if (forwardSquared <= 0) {
    return Math.max(0, distanceYd);
  }

  return Math.sqrt(forwardSquared);
}

function classifyCourseShot(clubType: string, distanceYd: number | null, holeShotNumber: number) {
  const distance = distanceYd ?? 0;

  if (holeShotNumber === 1) {
    return "tee";
  }

  if (distance <= 35) {
    return "chip";
  }

  if (distance <= 95 && ["pw", "gw", "aw", "sw", "lw", "wedge"].includes(clubType)) {
    return "pitch";
  }

  return "approach";
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}
