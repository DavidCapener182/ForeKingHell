import "server-only";

import { createHash } from "node:crypto";

import { and, asc, desc, eq, inArray } from "drizzle-orm";

import {
  clubs,
  courses,
  courseTwinRoundEvents,
  courseTwinRounds,
  sessions,
  shots,
} from "@/db/schema";
import { getDb } from "@/db/client";
import {
  courseTwinRoundCreatesAnalyticsSession,
  reduceCourseTwinRoundEvents,
  stableCourseTwinRoundJson,
  type CourseTwinCreateRoundInput,
  type CourseTwinRoundEventInput,
  type CourseTwinRoundLedgerEvent,
  type CourseTwinRoundSummary,
} from "@/lib/course-twin-round";

export async function createCourseTwinRound({
  courseId,
  userId,
  input,
}: {
  courseId: string;
  userId: string;
  input: CourseTwinCreateRoundInput;
}) {
  const [round] = await getDb()
    .insert(courseTwinRounds)
    .values({
      userId,
      courseId,
      mode: input.mode,
      holeCount: input.holeCount,
      startingHole: input.startingHole,
      currentHole: input.startingHole,
      rulesJson: input.rules,
    })
    .returning();
  return serialiseRound(round, []);
}

export async function getCourseTwinRound(roundId: string, userId: string) {
  const [round] = await getDb()
    .select()
    .from(courseTwinRounds)
    .where(and(eq(courseTwinRounds.id, roundId), eq(courseTwinRounds.userId, userId)))
    .limit(1);
  if (!round) return null;
  const events = await roundEvents(roundId, userId);
  return serialiseRound(round, events);
}

export async function getActiveCourseTwinRound(courseId: string, userId: string) {
  const [round] = await getDb()
    .select()
    .from(courseTwinRounds)
    .where(
      and(
        eq(courseTwinRounds.courseId, courseId),
        eq(courseTwinRounds.userId, userId),
        eq(courseTwinRounds.status, "in_progress"),
      ),
    )
    .orderBy(desc(courseTwinRounds.updatedAt))
    .limit(1);
  if (!round) return null;
  return serialiseRound(round, await roundEvents(round.id, userId));
}

export async function appendCourseTwinRoundEvent({
  roundId,
  userId,
  expectedVersion,
  input,
}: {
  roundId: string;
  userId: string;
  expectedVersion: number;
  input: CourseTwinRoundEventInput;
}) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [round] = await tx
      .select()
      .from(courseTwinRounds)
      .where(and(eq(courseTwinRounds.id, roundId), eq(courseTwinRounds.userId, userId)))
      .limit(1);
    if (!round) return { status: "not_found" as const };

    const [duplicate] = await tx
      .select({ id: courseTwinRoundEvents.id })
      .from(courseTwinRoundEvents)
      .where(
        and(
          eq(courseTwinRoundEvents.roundId, roundId),
          eq(courseTwinRoundEvents.clientEventId, input.clientEventId),
        ),
      )
      .limit(1);
    if (duplicate) {
      const events = await tx
        .select()
        .from(courseTwinRoundEvents)
        .where(
          and(eq(courseTwinRoundEvents.roundId, roundId), eq(courseTwinRoundEvents.userId, userId)),
        )
        .orderBy(asc(courseTwinRoundEvents.sequence));
      return { status: "duplicate" as const, round: serialiseRound(round, events) };
    }

    if (round.version !== expectedVersion) {
      return { status: "conflict" as const, currentVersion: round.version };
    }
    if (round.status !== "in_progress") return { status: "closed" as const };

    const events = await tx
      .select()
      .from(courseTwinRoundEvents)
      .where(
        and(eq(courseTwinRoundEvents.roundId, roundId), eq(courseTwinRoundEvents.userId, userId)),
      )
      .orderBy(asc(courseTwinRoundEvents.sequence));
    const ledger = events.map(toLedgerEvent);
    const currentSummary = reduceCourseTwinRoundEvents({
      events: ledger,
      startingHole: round.startingHole,
    });
    const invalidReason = validateNextEvent(round, currentSummary, input);
    if (invalidReason) return { status: "invalid" as const, error: invalidReason };

    const sequence = events.length + 1;
    const previousHash = events.at(-1)?.eventHash ?? null;
    const eventHash = hashRoundEvent({
      roundId,
      userId,
      sequence,
      type: input.type,
      payload: input.payload,
      previousHash,
    });
    const now = new Date();
    const nextLedger = [
      ...ledger,
      {
        ...input,
        id: input.clientEventId,
        sequence,
        previousHash,
        eventHash,
        createdAt: now,
      },
    ] as CourseTwinRoundLedgerEvent[];
    const summary = reduceCourseTwinRoundEvents({
      events: nextLedger,
      startingHole: round.startingHole,
    });
    const [updated] = await tx
      .update(courseTwinRounds)
      .set({
        status: summary.status,
        currentHole: summary.currentHole,
        scorecardJson: summary.scorecard,
        finalEventHash: summary.status === "complete" ? eventHash : null,
        completedAt: summary.status === "complete" ? now : null,
        version: round.version + 1,
        updatedAt: now,
      })
      .where(
        and(
          eq(courseTwinRounds.id, roundId),
          eq(courseTwinRounds.userId, userId),
          eq(courseTwinRounds.version, expectedVersion),
        ),
      )
      .returning();
    if (!updated) return { status: "conflict" as const, currentVersion: round.version };

    const [createdEvent] = await tx
      .insert(courseTwinRoundEvents)
      .values({
        roundId,
        userId,
        clientEventId: input.clientEventId,
        sequence,
        eventType: input.type,
        payloadJson: input.payload,
        previousHash,
        eventHash,
        createdAt: now,
      })
      .returning();

    if (summary.status === "complete" && courseTwinRoundCreatesAnalyticsSession(updated.mode)) {
      const sessionId = await materialiseCompletedRound({
        tx,
        round: updated,
        summary,
        finalEventHash: eventHash,
      });
      updated.sessionId = sessionId;
      await tx
        .update(courseTwinRounds)
        .set({ sessionId })
        .where(and(eq(courseTwinRounds.id, roundId), eq(courseTwinRounds.userId, userId)));
    }

    return {
      status: "created" as const,
      round: serialiseRound(updated, [...events, createdEvent]),
    };
  });
}

async function materialiseCompletedRound({
  tx,
  round,
  summary,
  finalEventHash,
}: {
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
  round: typeof courseTwinRounds.$inferSelect;
  summary: CourseTwinRoundSummary;
  finalEventHash: string;
}) {
  const [course] = await tx
    .select({ name: courses.name })
    .from(courses)
    .where(eq(courses.id, round.courseId))
    .limit(1);
  if (!course) throw new Error("Course Twin round course no longer exists.");

  const clubIds = [...new Set(summary.acceptedShots.map((shot) => shot.clubId))];
  const ownedClubs = clubIds.length
    ? await tx
        .select({ id: clubs.id })
        .from(clubs)
        .where(and(eq(clubs.userId, round.userId), inArray(clubs.id, clubIds)))
    : [];
  if (ownedClubs.length !== clubIds.length) {
    throw new Error("Course Twin round contains a club outside the golfer's bag.");
  }

  const rawDocument = stableCourseTwinRoundJson({
    schemaVersion: 1,
    roundId: round.id,
    mode: round.mode,
    rules: round.rulesJson,
    scorecard: summary.scorecard,
    finalEventHash,
  });
  const rawCsvHash = createHash("sha256").update(rawDocument).digest("hex");
  const [session] = await tx
    .insert(sessions)
    .values({
      userId: round.userId,
      source: "course_twin_live",
      type: "simulated_course",
      playContext: "simulated_course",
      date: round.startedAt,
      courseId: round.courseId,
      location: course.name,
      courseName: course.name,
      roundStatus: "complete",
      weatherJson: courseTwinWeather(round.rulesJson),
      scorecardJson: summary.scorecard.map((hole) => ({
        holeNumber: hole.holeNumber,
        par: hole.par,
        yards: hole.yards,
        name: null,
        csvShotCount: summary.acceptedShots.filter((shot) => shot.holeNumber === hole.holeNumber)
          .length,
        putts: hole.putts,
        penalties: hole.penalties,
        score: hole.strokes,
        fairwayHit: hole.fairwayHit,
        gir: hole.gir,
      })),
      notes: `Course Twin verified event ledger ${finalEventHash}. Modelled shots remain labelled separately from measured launch-monitor shots.`,
      rawUploadId: `course-twin-round-${round.id}`,
      fileName: `${course.name} Course Twin ${round.startedAt.toISOString().slice(0, 10)}.json`,
      rawCsvHash,
      rawCsvText: rawDocument,
    })
    .returning({ id: sessions.id });

  if (summary.acceptedShots.length) {
    const scorecardByHole = new Map(summary.scorecard.map((hole) => [hole.holeNumber, hole]));
    await tx.insert(shots).values(
      summary.acceptedShots.map((shot, index) => {
        const hole = scorecardByHole.get(shot.holeNumber);
        return {
          userId: round.userId,
          sessionId: session.id,
          clubId: shot.clubId,
          playContext: "simulated_course",
          shotAt: new Date(round.startedAt.getTime() + index * 1_000),
          clubType: shot.clubType,
          shotNumber: index + 1,
          carryYd: shot.metrics.carryYd,
          totalYd: shot.metrics.totalYd,
          ballSpeedMph: shot.metrics.ballSpeedMph,
          clubSpeedMph: shot.metrics.clubSpeedMph,
          launchAngleDeg: shot.metrics.launchAngleDeg,
          launchDirectionDeg: shot.metrics.launchDirectionDeg,
          spinRate: shot.metrics.spinRate,
          spinAxis: shot.metrics.spinAxis,
          shotCategory: "full",
          courseHoleNumber: shot.holeNumber,
          courseHoleShotNumber: shot.shotNumber,
          courseHolePar: hole?.par ?? null,
          courseHoleYards: hole?.yards ?? null,
          qualityTag: shot.source === "measured" ? "measured" : "modelled",
          clubDataEstType: shot.source === "measured" ? null : "course_twin_modelled",
          sourceRawJson: {
            courseTwinRoundId: round.id,
            courseTwinEventId: shot.eventId,
            source: shot.source,
            start: JSON.stringify(shot.start),
            carryEnd: JSON.stringify(shot.carryEnd),
            totalEnd: JSON.stringify(shot.totalEnd),
            finalSurface: shot.result.finalSurface,
            penalty: shot.result.penalty ?? "",
            finalEventHash,
          },
        };
      }),
    );
  }
  return session.id;
}

function validateNextEvent(
  round: typeof courseTwinRounds.$inferSelect,
  summary: CourseTwinRoundSummary,
  input: CourseTwinRoundEventInput,
) {
  const rules = round.rulesJson as {
    mulligansAllowed?: unknown;
    competition?: unknown;
    greenRule?: unknown;
  };
  const windowEnd = round.startingHole + round.holeCount - 1;
  if (input.type === "shot.accepted") {
    if (input.payload.holeNumber !== round.currentHole) return "Shot is not on the current hole.";
    if (input.payload.holeNumber < round.startingHole || input.payload.holeNumber > windowEnd) {
      return "Shot is outside the configured round.";
    }
    const expectedShot =
      summary.acceptedShots.filter((shot) => shot.holeNumber === round.currentHole).length + 1;
    if (input.payload.shotNumber !== expectedShot) return "Shot number is out of sequence.";
  }
  if (input.type === "putt.accepted") {
    if (input.payload.holeNumber !== round.currentHole) return "Putt is not on the current hole.";
    if (rules.greenRule !== "manual_putts") {
      return "Manual putting is not enabled for this round.";
    }
    const holeShots = summary.acceptedShots.filter((shot) => shot.holeNumber === round.currentHole);
    const lastShot = holeShots.at(-1);
    const holePutts = summary.acceptedPutts.filter((putt) => putt.holeNumber === round.currentHole);
    if (!lastShot || lastShot.result.penalty || lastShot.result.finalSurface !== "green") {
      return "The ball must be on the green before putting.";
    }
    if (holePutts.at(-1)?.holed) return "The hole is already complete.";
    if (input.payload.puttNumber !== holePutts.length + 1) return "Putt number is out of sequence.";
  }
  if (input.type === "shot.mulligan") {
    if (rules.competition === true || rules.mulligansAllowed !== true) {
      return "Mulligans are disabled for this round.";
    }
    if (
      !summary.acceptedShots.some(
        (shot) => shot.clientEventId === input.payload.shotClientEventId,
      ) &&
      !summary.acceptedPutts.some((putt) => putt.clientEventId === input.payload.shotClientEventId)
    ) {
      return "Mulligan target is not an active shot.";
    }
  }
  if (input.type === "hole.completed") {
    if (input.payload.holeNumber !== round.currentHole)
      return "Result is not for the current hole.";
    const shotCount = summary.acceptedShots.filter(
      (shot) => shot.holeNumber === input.payload.holeNumber,
    ).length;
    const puttCount = summary.acceptedPutts.filter(
      (putt) => putt.holeNumber === input.payload.holeNumber,
    ).length;
    if (rules.greenRule === "manual_putts" && input.payload.putts !== puttCount) {
      return "Manual putt count does not reconcile with the putting ledger.";
    }
    if (input.payload.strokes !== shotCount + input.payload.putts + input.payload.penalties) {
      return "Hole score does not reconcile with shots, putts and penalties.";
    }
  }
  if (input.type === "round.completed") {
    if (summary.scorecard.length !== round.holeCount)
      return "Every configured hole must be complete.";
  }
  return null;
}

function hashRoundEvent(value: {
  roundId: string;
  userId: string;
  sequence: number;
  type: string;
  payload: Record<string, unknown>;
  previousHash: string | null;
}) {
  return createHash("sha256").update(stableCourseTwinRoundJson(value)).digest("hex");
}

async function roundEvents(roundId: string, userId: string) {
  return getDb()
    .select()
    .from(courseTwinRoundEvents)
    .where(
      and(eq(courseTwinRoundEvents.roundId, roundId), eq(courseTwinRoundEvents.userId, userId)),
    )
    .orderBy(asc(courseTwinRoundEvents.sequence));
}

function serialiseRound(
  round: typeof courseTwinRounds.$inferSelect,
  events: Array<typeof courseTwinRoundEvents.$inferSelect>,
) {
  return {
    ...round,
    events,
    summary: reduceCourseTwinRoundEvents({
      events: events.map(toLedgerEvent),
      startingHole: round.startingHole,
    }),
  };
}

function toLedgerEvent(event: typeof courseTwinRoundEvents.$inferSelect) {
  return {
    id: event.id,
    type: event.eventType,
    clientEventId: event.clientEventId,
    payload: event.payloadJson,
    sequence: event.sequence,
    previousHash: event.previousHash,
    eventHash: event.eventHash,
    createdAt: event.createdAt,
  } as CourseTwinRoundLedgerEvent;
}

function courseTwinWeather(rules: Record<string, unknown>) {
  const windSpeed = typeof rules.windSpeedMph === "number" ? rules.windSpeedMph : 0;
  const windDirection = typeof rules.windDirectionDeg === "number" ? rules.windDirectionDeg : 0;
  return {
    conditions: windSpeed > 0 ? "Course Twin configured wind" : "Course Twin calm",
    wind: `${windSpeed.toFixed(0)} mph at ${windDirection.toFixed(0)}°`,
    temperature: null,
  };
}
