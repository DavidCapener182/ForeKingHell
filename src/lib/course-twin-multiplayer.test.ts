import { describe, expect, it } from "vitest";

import {
  createCourseTwinInviteCode,
  isCourseTwinRoomId,
  isCourseTwinRoomActive,
  normalizeCourseTwinInviteCode,
  parseCourseTwinCreateRoomInput,
  parseCourseTwinPresenceInput,
  parseCourseTwinRoomEvent,
  parseCourseTwinRoomStateInput,
} from "@/lib/course-twin-multiplayer";

describe("Course Twin multiplayer contracts", () => {
  it("normalizes bounded room creation defaults", () => {
    expect(parseCourseTwinCreateRoomInput({})).toEqual({
      mode: "explore",
      maxPlayers: 4,
      holeNumber: 1,
    });
    expect(parseCourseTwinCreateRoomInput({ mode: "live", maxPlayers: 2, holeNumber: 18 })).toEqual(
      {
        mode: "live",
        maxPlayers: 2,
        holeNumber: 18,
      },
    );
    expect(parseCourseTwinCreateRoomInput({ mode: "admin" })).toBeNull();
    expect(parseCourseTwinCreateRoomInput({ maxPlayers: 40 })).toBeNull();
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
    expect(parseCourseTwinRoomEvent({ type: "shot.played", payload: { shot: 2 } })).toEqual({
      type: "shot.played",
      payload: { shot: 2 },
    });
    expect(parseCourseTwinRoomEvent({ type: "../../bad", payload: {} })).toBeNull();
    expect(normalizeCourseTwinInviteCode("ab-cd 23")).toBe("ABCD23");
    expect(createCourseTwinInviteCode(new Uint8Array(8))).toBe("AAAAAAAA");
    expect(isCourseTwinRoomId("9beb5429-67e4-4f4e-a187-adbe0df74b62")).toBe(true);
    expect(isCourseTwinRoomId("not-a-room")).toBe(false);
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
  });
});
