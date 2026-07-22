import { describe, expect, it } from "vitest";

import {
  hashCourseTwinSharedRoundEvent,
  validateCourseTwinSharedRoundMutation,
} from "@/lib/course-twin-shared-round";

const event = {
  roomId: "9beb5429-67e4-4f4e-a187-adbe0df74b62",
  userId: "11111111-1111-4111-8111-111111111111",
  sequence: 2,
  type: "hole.completed" as const,
  payload: { strokes: 5, holeNumber: 5 },
  previousHash: "a".repeat(64),
};

describe("Course Twin shared round ledger", () => {
  it("hashes canonical JSON deterministically and commits the previous hash", () => {
    const hash = hashCourseTwinSharedRoundEvent(event);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(
      hashCourseTwinSharedRoundEvent({ ...event, payload: { holeNumber: 5, strokes: 5 } }),
    ).toBe(hash);
    expect(hashCourseTwinSharedRoundEvent({ ...event, previousHash: "b".repeat(64) })).not.toBe(
      hash,
    );
  });

  it("keeps spectators read-only and finalisation host-owned", () => {
    expect(
      validateCourseTwinSharedRoundMutation({
        role: "spectator",
        competition: false,
        eventType: "shot.accepted",
      }),
    ).toMatch(/Spectators/);
    expect(
      validateCourseTwinSharedRoundMutation({
        role: "player",
        competition: false,
        eventType: "round.completed",
      }),
    ).toMatch(/host/);
    expect(
      validateCourseTwinSharedRoundMutation({
        role: "host",
        competition: true,
        eventType: "shot.mulligan",
      }),
    ).toMatch(/Competition/);
    expect(
      validateCourseTwinSharedRoundMutation({
        role: "player",
        competition: true,
        eventType: "shot.accepted",
      }),
    ).toBeNull();
  });
});
