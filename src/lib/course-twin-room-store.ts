import "server-only";

import { randomBytes } from "node:crypto";

import { and, asc, count, desc, eq, gt, isNull, sql } from "drizzle-orm";

import {
  courseTwinRoomEvents,
  courseTwinRoomMembers,
  courseTwinRooms,
  courseTwinSharedRoundEvents,
  users,
} from "@/db/schema";
import { getDb } from "@/db/client";
import {
  COURSE_TWIN_ROOM_EVENT_LIMIT,
  courseTwinRoomExpiresAt,
  createCourseTwinInviteCode,
  isCourseTwinRoomActive,
  isCourseTwinRoomReadable,
  type CourseTwinCreateRoomInput,
  type CourseTwinJoinRoomInput,
  type CourseTwinPresenceInput,
  type CourseTwinRoomStateInput,
  type CourseTwinSharedRoundEventInput,
} from "@/lib/course-twin-multiplayer";
import {
  hashCourseTwinSharedRoundEvent,
  validateCourseTwinSharedRoundMutation,
} from "@/lib/course-twin-shared-round";

export async function createCourseTwinRoom({
  courseId,
  userId,
  input,
}: {
  courseId: string;
  userId: string;
  input: CourseTwinCreateRoomInput;
}) {
  const db = getDb();
  const displayName = await roomDisplayName(userId);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const inviteCode = createCourseTwinInviteCode(randomBytes(8));
    try {
      const room = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(courseTwinRooms)
          .values({
            courseId,
            hostUserId: userId,
            inviteCode,
            visibility: input.visibility,
            mode: input.mode,
            maxPlayers: input.maxPlayers,
            spectatorLimit: input.spectatorLimit,
            holeNumber: input.holeNumber,
            competition: input.competition,
            expiresAt: courseTwinRoomExpiresAt(),
          })
          .returning();
        await tx.insert(courseTwinRoomMembers).values({
          roomId: created.id,
          userId,
          displayName,
          role: "host",
          holeNumber: input.holeNumber,
        });
        await tx.insert(courseTwinRoomEvents).values({
          roomId: created.id,
          userId,
          eventType: "room.created",
          payloadJson: { mode: input.mode, holeNumber: input.holeNumber },
        });
        return created;
      });
      return getCourseTwinRoom(room.id, userId);
    } catch (error) {
      if (!isUniqueViolation(error) || attempt === 3) throw error;
    }
  }
  throw new Error("Unable to allocate a Course Twin invite code.");
}

export async function joinCourseTwinRoom(input: CourseTwinJoinRoomInput, userId: string) {
  const db = getDb();
  const [room] = await db
    .select()
    .from(courseTwinRooms)
    .where(eq(courseTwinRooms.inviteCode, input.inviteCode))
    .limit(1);
  if (!room || !isCourseTwinRoomActive(room)) return { status: "not_found" as const };

  const [membership] = await db
    .select({ id: courseTwinRoomMembers.id, leftAt: courseTwinRoomMembers.leftAt })
    .from(courseTwinRoomMembers)
    .where(and(eq(courseTwinRoomMembers.roomId, room.id), eq(courseTwinRoomMembers.userId, userId)))
    .limit(1);
  const [{ roleCount }] = await db
    .select({ roleCount: count() })
    .from(courseTwinRoomMembers)
    .where(
      and(
        eq(courseTwinRoomMembers.roomId, room.id),
        eq(courseTwinRoomMembers.role, input.role),
        isNull(courseTwinRoomMembers.leftAt),
      ),
    );
  const roleLimit = input.role === "spectator" ? room.spectatorLimit : room.maxPlayers - 1;
  if (!membership && roleCount >= roleLimit) return { status: "full" as const };

  const now = new Date();
  const displayName = await roomDisplayName(userId);
  await db
    .insert(courseTwinRoomMembers)
    .values({
      roomId: room.id,
      userId,
      displayName,
      role: input.role,
      holeNumber: room.holeNumber,
      joinedAt: now,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: [courseTwinRoomMembers.roomId, courseTwinRoomMembers.userId],
      set: {
        displayName,
        role: membership ? undefined : input.role,
        holeNumber: room.holeNumber,
        leftAt: null,
        lastSeenAt: now,
      },
    });
  await db.insert(courseTwinRoomEvents).values({
    roomId: room.id,
    userId,
    eventType: membership?.leftAt ? "member.rejoined" : "member.joined",
    payloadJson: { role: input.role },
  });
  return { status: "joined" as const, room: await getCourseTwinRoom(room.id, userId) };
}

export async function getCourseTwinRoom(roomId: string, userId: string) {
  const db = getDb();
  const [membership] = await db
    .select({ room: courseTwinRooms })
    .from(courseTwinRoomMembers)
    .innerJoin(courseTwinRooms, eq(courseTwinRooms.id, courseTwinRoomMembers.roomId))
    .where(
      and(
        eq(courseTwinRoomMembers.roomId, roomId),
        eq(courseTwinRoomMembers.userId, userId),
        isNull(courseTwinRoomMembers.leftAt),
      ),
    )
    .limit(1);
  if (!membership || !isCourseTwinRoomReadable(membership.room)) return null;
  const members = await db
    .select({
      userId: courseTwinRoomMembers.userId,
      displayName: courseTwinRoomMembers.displayName,
      role: courseTwinRoomMembers.role,
      transport: courseTwinRoomMembers.transport,
      position: courseTwinRoomMembers.positionJson,
      holeNumber: courseTwinRoomMembers.holeNumber,
      isReady: courseTwinRoomMembers.isReady,
      lastSeenAt: courseTwinRoomMembers.lastSeenAt,
    })
    .from(courseTwinRoomMembers)
    .where(and(eq(courseTwinRoomMembers.roomId, roomId), isNull(courseTwinRoomMembers.leftAt)))
    .orderBy(asc(courseTwinRoomMembers.joinedAt));
  const [{ sharedEventCount }] = await db
    .select({ sharedEventCount: count() })
    .from(courseTwinSharedRoundEvents)
    .where(eq(courseTwinSharedRoundEvents.roomId, roomId));
  const [latestSharedEvent] = await db
    .select({
      sequence: courseTwinSharedRoundEvents.sequence,
      eventType: courseTwinSharedRoundEvents.eventType,
      eventHash: courseTwinSharedRoundEvents.eventHash,
      createdAt: courseTwinSharedRoundEvents.createdAt,
    })
    .from(courseTwinSharedRoundEvents)
    .where(eq(courseTwinSharedRoundEvents.roomId, roomId))
    .orderBy(desc(courseTwinSharedRoundEvents.sequence))
    .limit(1);
  const currentMember = members.find((member) => member.userId === userId);
  return {
    ...membership.room,
    currentUserId: userId,
    isHost: membership.room.hostUserId === userId,
    currentRole: currentMember?.role ?? "player",
    sharedEventCount,
    latestSharedEvent: latestSharedEvent ?? null,
    members,
  };
}

export async function listPublicCourseTwinRooms(courseId: string, userId: string) {
  const now = new Date();
  const rooms = await getDb()
    .select({
      id: courseTwinRooms.id,
      inviteCode: courseTwinRooms.inviteCode,
      mode: courseTwinRooms.mode,
      competition: courseTwinRooms.competition,
      maxPlayers: courseTwinRooms.maxPlayers,
      holeNumber: courseTwinRooms.holeNumber,
      updatedAt: courseTwinRooms.updatedAt,
      hostName: users.name,
    })
    .from(courseTwinRooms)
    .innerJoin(users, eq(users.id, courseTwinRooms.hostUserId))
    .where(
      and(
        eq(courseTwinRooms.courseId, courseId),
        eq(courseTwinRooms.visibility, "public"),
        eq(courseTwinRooms.status, "lobby"),
        gt(courseTwinRooms.expiresAt, now),
      ),
    )
    .orderBy(desc(courseTwinRooms.updatedAt))
    .limit(20);
  const result = [];
  for (const room of rooms) {
    const [{ memberCount }] = await getDb()
      .select({ memberCount: count() })
      .from(courseTwinRoomMembers)
      .where(and(eq(courseTwinRoomMembers.roomId, room.id), isNull(courseTwinRoomMembers.leftAt)));
    result.push({
      ...room,
      hostName: room.hostName || "Golfer",
      memberCount,
      canJoin: memberCount < room.maxPlayers,
    });
  }
  return { viewerUserId: userId, rooms: result };
}

export async function updateCourseTwinPresence(
  roomId: string,
  userId: string,
  input: CourseTwinPresenceInput,
) {
  const now = new Date();
  const [updated] = await getDb()
    .update(courseTwinRoomMembers)
    .set({
      transport: input.transport,
      positionJson: input.position,
      holeNumber: input.holeNumber,
      isReady: input.isReady,
      lastSeenAt: now,
    })
    .where(
      and(
        eq(courseTwinRoomMembers.roomId, roomId),
        eq(courseTwinRoomMembers.userId, userId),
        isNull(courseTwinRoomMembers.leftAt),
      ),
    )
    .returning({ id: courseTwinRoomMembers.id });
  if (!updated) return null;
  return getCourseTwinRoom(roomId, userId);
}

export async function updateCourseTwinRoomState(
  roomId: string,
  userId: string,
  input: CourseTwinRoomStateInput,
) {
  const now = new Date();
  const [updated] = await getDb()
    .update(courseTwinRooms)
    .set({
      status: input.status,
      holeNumber: input.holeNumber,
      stateJson: input.state,
      stateVersion: sql`${courseTwinRooms.stateVersion} + 1`,
      updatedAt: now,
    })
    .where(
      and(
        eq(courseTwinRooms.id, roomId),
        eq(courseTwinRooms.hostUserId, userId),
        eq(courseTwinRooms.stateVersion, input.expectedVersion),
        gt(courseTwinRooms.expiresAt, now),
      ),
    )
    .returning({ stateVersion: courseTwinRooms.stateVersion });
  if (!updated) return null;
  await getDb()
    .insert(courseTwinRoomEvents)
    .values({
      roomId,
      userId,
      eventType: "room.state",
      payloadJson: {
        stateVersion: updated.stateVersion,
        status: input.status,
        holeNumber: input.holeNumber,
      },
    });
  return getCourseTwinRoom(roomId, userId);
}

export async function leaveCourseTwinRoom(roomId: string, userId: string) {
  const now = new Date();
  const [updated] = await getDb()
    .update(courseTwinRoomMembers)
    .set({ leftAt: now, lastSeenAt: now })
    .where(
      and(
        eq(courseTwinRoomMembers.roomId, roomId),
        eq(courseTwinRoomMembers.userId, userId),
        isNull(courseTwinRoomMembers.leftAt),
      ),
    )
    .returning({ role: courseTwinRoomMembers.role });
  if (!updated) return false;
  await getDb().insert(courseTwinRoomEvents).values({
    roomId,
    userId,
    eventType: "member.left",
    payloadJson: {},
  });
  if (updated.role === "host") {
    await getDb()
      .update(courseTwinRooms)
      .set({ status: "closed", updatedAt: now })
      .where(eq(courseTwinRooms.id, roomId));
  }
  return true;
}

export async function appendCourseTwinRoomEvent({
  roomId,
  userId,
  type,
  payload,
}: {
  roomId: string;
  userId: string;
  type: string;
  payload: Record<string, unknown>;
}) {
  const room = await getCourseTwinRoom(roomId, userId);
  if (!room) return null;
  const [event] = await getDb()
    .insert(courseTwinRoomEvents)
    .values({ roomId, userId, eventType: type, payloadJson: payload })
    .returning();
  return event;
}

export async function listCourseTwinRoomEvents(roomId: string, userId: string, since?: Date) {
  const room = await getCourseTwinRoom(roomId, userId);
  if (!room) return null;
  const predicate = since
    ? and(eq(courseTwinRoomEvents.roomId, roomId), gt(courseTwinRoomEvents.createdAt, since))
    : eq(courseTwinRoomEvents.roomId, roomId);
  return getDb()
    .select()
    .from(courseTwinRoomEvents)
    .where(predicate)
    .orderBy(asc(courseTwinRoomEvents.createdAt))
    .limit(COURSE_TWIN_ROOM_EVENT_LIMIT);
}

export async function appendCourseTwinSharedRoundEvent({
  roomId,
  userId,
  input,
}: {
  roomId: string;
  userId: string;
  input: CourseTwinSharedRoundEventInput;
}) {
  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const [membership] = await tx
      .select({ room: courseTwinRooms, role: courseTwinRoomMembers.role })
      .from(courseTwinRoomMembers)
      .innerJoin(courseTwinRooms, eq(courseTwinRooms.id, courseTwinRoomMembers.roomId))
      .where(
        and(
          eq(courseTwinRoomMembers.roomId, roomId),
          eq(courseTwinRoomMembers.userId, userId),
          isNull(courseTwinRoomMembers.leftAt),
        ),
      )
      .limit(1);
    if (!membership || !isCourseTwinRoomReadable(membership.room)) {
      return { status: "not_found" as const };
    }
    const authorizationError = validateCourseTwinSharedRoundMutation({
      role: membership.role,
      competition: membership.room.competition,
      eventType: input.event.type,
    });
    if (authorizationError) {
      return authorizationError.includes("Spectators") || authorizationError.includes("host")
        ? { status: "forbidden" as const }
        : { status: "invalid" as const, error: authorizationError };
    }

    const [duplicate] = await tx
      .select()
      .from(courseTwinSharedRoundEvents)
      .where(
        and(
          eq(courseTwinSharedRoundEvents.roomId, roomId),
          eq(courseTwinSharedRoundEvents.clientEventId, input.event.clientEventId),
        ),
      )
      .limit(1);
    if (duplicate) return { status: "duplicate" as const, event: duplicate };
    if (membership.room.sharedRoundVersion !== input.expectedVersion) {
      return {
        status: "conflict" as const,
        currentVersion: membership.room.sharedRoundVersion,
      };
    }
    if (membership.room.status === "finished" || membership.room.status === "closed") {
      return { status: "closed" as const };
    }
    const [previous] = await tx
      .select({
        sequence: courseTwinSharedRoundEvents.sequence,
        eventHash: courseTwinSharedRoundEvents.eventHash,
      })
      .from(courseTwinSharedRoundEvents)
      .where(eq(courseTwinSharedRoundEvents.roomId, roomId))
      .orderBy(desc(courseTwinSharedRoundEvents.sequence))
      .limit(1);
    const sequence = (previous?.sequence ?? 0) + 1;
    const previousHash = previous?.eventHash ?? null;
    const eventHash = hashCourseTwinSharedRoundEvent({
      roomId,
      userId,
      sequence,
      type: input.event.type,
      payload: input.event.payload,
      previousHash,
    });
    const now = new Date();
    const terminal =
      input.event.type === "round.completed" || input.event.type === "round.abandoned";
    const [updated] = await tx
      .update(courseTwinRooms)
      .set({
        sharedRoundVersion: membership.room.sharedRoundVersion + 1,
        status: terminal ? "finished" : "playing",
        finalEventHash: terminal ? eventHash : null,
        lockedAt: terminal ? now : null,
        updatedAt: now,
      })
      .where(
        and(
          eq(courseTwinRooms.id, roomId),
          eq(courseTwinRooms.sharedRoundVersion, input.expectedVersion),
          gt(courseTwinRooms.expiresAt, now),
        ),
      )
      .returning({ sharedRoundVersion: courseTwinRooms.sharedRoundVersion });
    if (!updated) {
      return { status: "conflict" as const, currentVersion: membership.room.sharedRoundVersion };
    }
    const [event] = await tx
      .insert(courseTwinSharedRoundEvents)
      .values({
        roomId,
        userId,
        clientEventId: input.event.clientEventId,
        sequence,
        eventType: input.event.type,
        payloadJson: input.event.payload,
        previousHash,
        eventHash,
        createdAt: now,
      })
      .returning();
    return { status: "created" as const, event, version: updated.sharedRoundVersion };
  });

  if (result.status === "created" || result.status === "duplicate") {
    return { ...result, room: await getCourseTwinRoom(roomId, userId) };
  }
  return result;
}

export async function listCourseTwinSharedRoundEvents(roomId: string, userId: string) {
  const room = await getCourseTwinRoom(roomId, userId);
  if (!room) return null;
  return getDb()
    .select()
    .from(courseTwinSharedRoundEvents)
    .where(eq(courseTwinSharedRoundEvents.roomId, roomId))
    .orderBy(asc(courseTwinSharedRoundEvents.sequence))
    .limit(COURSE_TWIN_ROOM_EVENT_LIMIT);
}

async function roomDisplayName(userId: string) {
  const [user] = await getDb()
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user?.name?.trim() || user?.email?.split("@")[0] || "Golfer";
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");
}
