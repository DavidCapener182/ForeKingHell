import { describe, expect, it } from "vitest";

import {
  createCourseTwinInviteCode,
  isCourseTwinRoomId,
  isCourseTwinRoomActive,
  isCourseTwinRoomReadable,
  normalizeCourseTwinInviteCode,
  parseCourseTwinCreateRoomInput,
  parseCourseTwinJoinRoomInput,
  parseCourseTwinPresenceInput,
  parseCourseTwinRoomEvent,
  parseCourseTwinRoomStateInput,
  parseCourseTwinSharedRoundEventInput,
} from "@/lib/course-twin-multiplayer";

describe("Course Twin multiplayer contracts", () => {
  it("normalizes bounded room creation defaults", () => {
    expect(parseCourseTwinCreateRoomInput({})).toEqual({
      mode: "explore",
      maxPlayers: 4,
      spectatorLimit: 8,
      holeNumber: 1,
      competition: false,
      visibility: "private",
    });
    expect(parseCourseTwinCreateRoomInput({ mode: "live", maxPlayers: 2, holeNumber: 18 })).toEqual(
      {
        mode: "live",
        maxPlayers: 2,
        spectatorLimit: 8,
        holeNumber: 18,
        competition: false,
        visibility: "private",
      },
    );
    expect(parseCourseTwinCreateRoomInput({ mode: "admin" })).toBeNull();
    expect(parseCourseTwinCreateRoomInput({ maxPlayers: 40 })).toBeNull();
    expect(parseCourseTwinCreateRoomInput({ mode: "explore", competition: true })).toBeNull();
    expect(parseCourseTwinCreateRoomInput({ visibility: "friends" })).toBeNull();
  });

  it("supports explicit read-only spectator joins", () => {
    expect(parseCourseTwinJoinRoomInput({ inviteCode: "ab-cd 23", role: "spectator" })).toEqual({
      inviteCode: "ABCD23",
      role: "spectator",
    });
    expect(parseCourseTwinJoinRoomInput({ inviteCode: "ABCD23" })).toEqual({
      inviteCode: "ABCD23",
      role: "player",
    });
    expect(parseCourseTwinJoinRoomInput({ inviteCode: "ABCD23", role: "host" })).toBeNull();
  });

  it("accepts safe terrain presence and rejects unbounded coordinates", () => {
    expect(
      parseCourseTwinPresenceInput({ transport: "cart", position: [12.5, 3, -77], holeNumber: 5 }),
    ).toEqual({ transport: "cart", position: [12.5, 3, -77], holeNumber: 5 });
    expect(parseCourseTwinPresenceInput({ position: [Infinity, 0, 0] })).toBeNull();
    expect(parseCourseTwinPresenceInput({ transport: "plane" })).toBeNull();
  });

  it("requires optimistic versions for host state updates", () => {
    expect(parseCourseTwinRoomStateInput({ expectedVersion: 3, status: "playing" })).toEqual({
      expectedVersion: 3,
      status: "playing",
    });
    expect(parseCourseTwinRoomStateInput({ status: "playing" })).toBeNull();
    expect(parseCourseTwinRoomStateInput({ expectedVersion: 1, state: "unsafe" })).toBeNull();
  });

  it("bounds event names, payloads and invite codes", () => {
    expect(
      parseCourseTwinRoomEvent({ type: "chat.message", payload: { text: "  Great shot  " } }),
    ).toEqual({
      type: "chat.message",
      payload: { text: "Great shot" },
    });
    expect(parseCourseTwinRoomEvent({ type: "shot.played", payload: { shot: 2 } })).toBeNull();
    expect(
      parseCourseTwinRoomEvent({
        type: "voice.offer",
        payload: { targetUserId: "9beb5429-67e4-4f4e-a187-adbe0df74b62", sdp: "offer" },
      }),
    ).toEqual({
      type: "voice.offer",
      payload: { targetUserId: "9beb5429-67e4-4f4e-a187-adbe0df74b62", sdp: "offer" },
    });
    expect(parseCourseTwinRoomEvent({ type: "../../bad", payload: {} })).toBeNull();
    expect(normalizeCourseTwinInviteCode("ab-cd 23")).toBe("ABCD23");
    expect(createCourseTwinInviteCode(new Uint8Array(8))).toBe("AAAAAAAA");
    expect(isCourseTwinRoomId("9beb5429-67e4-4f4e-a187-adbe0df74b62")).toBe(true);
    expect(isCourseTwinRoomId("not-a-room")).toBe(false);
  });

  it("reuses the strict round-event contract for shared room events", () => {
    const shared = parseCourseTwinSharedRoundEventInput({
      expectedVersion: 2,
      event: {
        type: "round.completed",
        clientEventId: "9beb5429-67e4-4f4e-a187-adbe0df74b62",
        payload: {},
      },
    });
    expect(shared).toEqual({
      expectedVersion: 2,
      event: {
        type: "round.completed",
        clientEventId: "9beb5429-67e4-4f4e-a187-adbe0df74b62",
        payload: {},
      },
    });
    expect(
      parseCourseTwinSharedRoundEventInput({ expectedVersion: 2, event: { type: "cheat" } }),
    ).toBeNull();
  });

  it("treats expired and terminal rooms as inactive", () => {
    const now = new Date("2026-07-22T12:00:00Z");
    expect(
      isCourseTwinRoomActive({ status: "lobby", expiresAt: new Date("2026-07-22T13:00:00Z") }, now),
    ).toBe(true);
    expect(
      isCourseTwinRoomActive(
        { status: "finished", expiresAt: new Date("2026-07-22T13:00:00Z") },
        now,
      ),
    ).toBe(false);
    expect(
      isCourseTwinRoomReadable(
        { status: "finished", expiresAt: new Date("2026-07-22T13:00:00Z") },
        now,
      ),
    ).toBe(true);
  });
});
