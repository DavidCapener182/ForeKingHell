import "server-only";

import { randomBytes } from "node:crypto";

import { and, asc, count, eq, gt, isNull, sql } from "drizzle-orm";

import { courseTwinRoomEvents, courseTwinRoomMembers, courseTwinRooms, users } from "@/db/schema";
import { getDb } from "@/db/client";
import {
  COURSE_TWIN_ROOM_EVENT_LIMIT,
  courseTwinRoomExpiresAt,
  createCourseTwinInviteCode,
  isCourseTwinRoomActive,
  type CourseTwinCreateRoomInput,
  type CourseTwinPresenceInput,
  type CourseTwinRoomStateInput,
} from "@/lib/course-twin-multiplayer";

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
            mode: input.mode,
            maxPlayers: input.maxPlayers,
            holeNumber: input.holeNumber,
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

export async function joinCourseTwinRoom(inviteCode: string, userId: string) {
  const db = getDb();
  const [room] = await db
    .select()
    .from(courseTwinRooms)
    .where(eq(courseTwinRooms.inviteCode, inviteCode))
    .limit(1);
  if (!room || !isCourseTwinRoomActive(room)) return { status: "not_found" as const };

  const [membership] = await db
    .select({ id: courseTwinRoomMembers.id, leftAt: courseTwinRoomMembers.leftAt })
    .from(courseTwinRoomMembers)
    .where(and(eq(courseTwinRoomMembers.roomId, room.id), eq(courseTwinRoomMembers.userId, userId)))
    .limit(1);
  const [{ memberCount }] = await db
    .select({ memberCount: count() })
    .from(courseTwinRoomMembers)
    .where(and(eq(courseTwinRoomMembers.roomId, room.id), isNull(courseTwinRoomMembers.leftAt)));
  if (!membership && memberCount >= room.maxPlayers) return { status: "full" as const };

  const now = new Date();
  const displayName = await roomDisplayName(userId);
  await db
    .insert(courseTwinRoomMembers)
    .values({
      roomId: room.id,
      userId,
      displayName,
      holeNumber: room.holeNumber,
      joinedAt: now,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: [courseTwinRoomMembers.roomId, courseTwinRoomMembers.userId],
      set: { displayName, holeNumber: room.holeNumber, leftAt: null, lastSeenAt: now },
    });
  await db.insert(courseTwinRoomEvents).values({
    roomId: room.id,
    userId,
    eventType: membership?.leftAt ? "member.rejoined" : "member.joined",
    payloadJson: {},
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
  if (!membership || !isCourseTwinRoomActive(membership.room)) return null;
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
  return { ...membership.room, isHost: membership.room.hostUserId === userId, members };
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
