"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, ne } from "drizzle-orm";

import { clubs, courses, holes, sessions, shareLinks, shots, teeSets, users } from "@/db/schema";
import { getDb } from "@/db/client";
import { setAchievementUnlockFlash } from "@/lib/achievements/notification-flash";
import { evaluateRoundAchievementsForSession } from "@/lib/achievements/service";
import { requireCurrentUserId } from "@/lib/current-user";
import { buildClubKey, normalizeClubType } from "@/lib/rapsodo/parser";
import { createShareToken, getShareExpiry, hashShareToken } from "@/lib/share-links";

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

  await evaluateRoundAchievementsForSessionWithFlash(session.id);
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

export async function revokeRoundShareLinkAction(formData: FormData) {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const sessionId = requiredString(formData, "sessionId");
  const shareLinkId = requiredString(formData, "shareLinkId");

  await db
    .update(shareLinks)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(shareLinks.id, shareLinkId), eq(shareLinks.userId, userId), eq(shareLinks.resourceId, sessionId)));

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
  await evaluateRoundAchievementsForSessionWithFlash(sessionId);
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

  await db
    .update(shots)
    .set({
      clubId: club.id,
      clubType: club.type,
    })
    .where(and(eq(shots.id, shotId), eq(shots.sessionId, sessionId), eq(shots.userId, userId)));

  await evaluateRoundAchievementsForSessionWithFlash(sessionId);
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
      await tx.update(clubs).set({ active: false, updatedAt: now }).where(and(eq(clubs.id, clubId), eq(clubs.userId, userId)));
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
      await tx.update(shots).set({ clubType }).where(and(eq(shots.clubId, clubId), eq(shots.userId, userId)));
    });
  }

  await evaluateRoundAchievementsForSessionWithFlash(sessionId);
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

    if (typeof hole.netScore === "number" && typeof hole.score === "number" && typeof score === "number") {
      updatedHole.netScore = Math.max(0, hole.netScore + score - hole.score);
    }

    return updatedHole;
  });

  await db.update(sessions).set({ scorecardJson: holes }).where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));
  await evaluateRoundAchievementsForSessionWithFlash(sessionId);
  revalidateRound(sessionId);
}

export async function moveRoundShotHoleAction(formData: FormData) {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const sessionId = requiredString(formData, "sessionId");
  const shotId = requiredString(formData, "shotId");
  const direction = requiredString(formData, "direction");

  if (direction !== "previous" && direction !== "next") {
    throw new Error("Move direction is invalid.");
  }

  const [shot] = await db
    .select({ courseHoleNumber: shots.courseHoleNumber })
    .from(shots)
    .where(and(eq(shots.id, shotId), eq(shots.sessionId, sessionId), eq(shots.userId, userId)))
    .limit(1);

  if (!shot?.courseHoleNumber) {
    throw new Error("Shot is not mapped to a hole.");
  }

  const nextHoleNumber =
    direction === "previous" ? shot.courseHoleNumber - 1 : shot.courseHoleNumber + 1;

  const [session] = await db
    .select({ scorecardJson: sessions.scorecardJson })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .limit(1);

  if (!session?.scorecardJson?.some((hole) => hole.holeNumber === nextHoleNumber)) {
    throw new Error("Shot cannot be moved past the scorecard.");
  }

  await db
    .update(shots)
    .set({ courseHoleNumber: nextHoleNumber })
    .where(and(eq(shots.id, shotId), eq(shots.sessionId, sessionId), eq(shots.userId, userId)));
  await recalculateRoundAssignments(sessionId);
  await evaluateRoundAchievementsForSessionWithFlash(sessionId);
  revalidateRound(sessionId);
}

export async function moveRoundShotToHoleAction(formData: FormData) {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const sessionId = requiredString(formData, "sessionId");
  const shotId = requiredString(formData, "shotId");
  const targetHoleNumber = numberFromForm(formData, "targetHoleNumber");

  if (targetHoleNumber === null) {
    throw new Error("Target hole is required.");
  }

  const [session] = await db
    .select({ scorecardJson: sessions.scorecardJson })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .limit(1);

  if (!session?.scorecardJson) {
    throw new Error("Round scorecard not found.");
  }

  if (!session.scorecardJson.some((hole) => hole.holeNumber === targetHoleNumber)) {
    throw new Error("Target hole is not on this scorecard.");
  }

  await db
    .update(shots)
    .set({ courseHoleNumber: targetHoleNumber })
    .where(and(eq(shots.id, shotId), eq(shots.sessionId, sessionId), eq(shots.userId, userId)));
  await recalculateRoundAssignments(sessionId);
  await evaluateRoundAchievementsForSessionWithFlash(sessionId);
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

  const sessionShots = await db
    .select({
      id: shots.id,
      shotNumber: shots.shotNumber,
    })
    .from(shots)
    .where(and(eq(shots.sessionId, sessionId), eq(shots.userId, userId)))
    .orderBy(asc(shots.shotNumber), asc(shots.createdAt));
  let cursor = 0;

  for (const hole of session.scorecardJson.sort((left, right) => left.holeNumber - right.holeNumber)) {
    const count = Math.min(12, numberFromForm(formData, `holeCount-${hole.holeNumber}`) ?? 0);
    const holeShots = sessionShots.slice(cursor, cursor + count);

    for (const shot of holeShots) {
      await db
        .update(shots)
        .set({ courseHoleNumber: hole.holeNumber })
        .where(and(eq(shots.id, shot.id), eq(shots.sessionId, sessionId), eq(shots.userId, userId)));
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
  await evaluateRoundAchievementsForSessionWithFlash(sessionId);
  revalidateRound(sessionId);
}

async function evaluateRoundAchievementsForSessionWithFlash(sessionId: string) {
  const result = await evaluateRoundAchievementsForSession(sessionId);
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

  const sessionShots = await db
    .select({
      id: shots.id,
      shotNumber: shots.shotNumber,
      carryYd: shots.carryYd,
      totalYd: shots.totalYd,
      sideCarryYd: shots.sideCarryYd,
      clubType: shots.clubType,
      courseHoleNumber: shots.courseHoleNumber,
    })
    .from(shots)
    .where(and(eq(shots.sessionId, sessionId), eq(shots.userId, session.userId)))
    .orderBy(asc(shots.shotNumber), asc(shots.createdAt));
  const shotsByHole = new Map<number, typeof sessionShots>();

  for (const shot of sessionShots) {
    if (!shot.courseHoleNumber) {
      continue;
    }

    const existing = shotsByHole.get(shot.courseHoleNumber) ?? [];
    existing.push(shot);
    shotsByHole.set(shot.courseHoleNumber, existing);
  }

  const nextScorecard = await Promise.all(
    session.scorecardJson
      .sort((left, right) => left.holeNumber - right.holeNumber)
      .map(async (hole) => {
        const holeShots = shotsByHole.get(hole.holeNumber) ?? [];
        let progressYd = 0;

        for (const [index, shot] of holeShots.entries()) {
          progressYd += forwardDistanceYd(shot.totalYd ?? shot.carryYd, shot.sideCarryYd) ?? 0;

          await db
            .update(shots)
            .set({
              courseHoleShotNumber: index + 1,
              courseHolePar: hole.par,
              courseHoleYards: hole.yards,
              distanceRemainingYd: roundOne(Math.max(0, hole.yards - progressYd)),
              shotCategory: classifyCourseShot(shot.clubType, shot.totalYd ?? shot.carryYd, index + 1),
            })
            .where(and(eq(shots.id, shot.id), eq(shots.sessionId, sessionId), eq(shots.userId, session.userId)));
        }

        return {
          ...hole,
          csvShotCount: holeShots.length,
          progressYd: roundOne(progressYd),
          distanceRemainingYd: roundOne(Math.max(0, hole.yards - progressYd)),
          penalties:
            hole.score === null || hole.score === undefined || hole.putts === null || hole.putts === undefined
              ? hole.penalties ?? 0
              : Math.max(0, hole.score - hole.putts - holeShots.length),
        };
      }),
  );

  await db
    .update(sessions)
    .set({ scorecardJson: nextScorecard })
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, session.userId)));
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
