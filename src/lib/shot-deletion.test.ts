import { describe, expect, it } from "vitest";

import {
  MAX_SHOT_DELETE_BATCH_SIZE,
  isPermanentShotDeletionRestricted,
  parseShotDeleteActionInput,
} from "@/lib/shot-deletion";

const shotId = "00000000-0000-4000-8000-000000000001";

describe("permanent shot deletion input", () => {
  it("deduplicates a bounded batch of UUIDs", () => {
    expect(parseShotDeleteActionInput({ shotIds: [shotId, shotId] })).toEqual({
      shotIds: [shotId],
    });
  });

  it("rejects invalid, empty and oversized batches", () => {
    expect(() => parseShotDeleteActionInput({ shotIds: [] })).toThrow(
      "Select at least one shot to delete.",
    );
    expect(() => parseShotDeleteActionInput({ shotIds: ["not-a-shot-id"] })).toThrow(
      "One or more shots are invalid.",
    );

    const shotIds = Array.from(
      { length: MAX_SHOT_DELETE_BATCH_SIZE + 1 },
      (_, index) => `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
    );
    expect(() => parseShotDeleteActionInput({ shotIds })).toThrow(
      `Delete no more than ${MAX_SHOT_DELETE_BATCH_SIZE} shots at once.`,
    );
  });
});

describe("Shot Explorer permanent deletion boundary", () => {
  it.each(["round", "real_round", "simulated_course", "course"])(
    "keeps %s sessions inside their course workflow",
    (sessionType) => {
      expect(
        isPermanentShotDeletionRestricted({
          sessionType,
          sessionPlayContext: "unknown",
          sessionCourseId: null,
          courseHoleNumber: null,
        }),
      ).toBe(true);
    },
  );

  it("also protects course-linked and on-course rows when legacy session type is incomplete", () => {
    expect(
      isPermanentShotDeletionRestricted({
        sessionType: "range",
        sessionPlayContext: "on_course",
        sessionCourseId: null,
        courseHoleNumber: null,
      }),
    ).toBe(true);
    expect(
      isPermanentShotDeletionRestricted({
        sessionType: "range",
        sessionPlayContext: "practice_bay",
        sessionCourseId: "00000000-0000-4000-8000-000000000099",
        courseHoleNumber: null,
      }),
    ).toBe(true);
    expect(
      isPermanentShotDeletionRestricted({
        sessionType: "range",
        sessionPlayContext: "practice_bay",
        sessionCourseId: null,
        courseHoleNumber: 7,
      }),
    ).toBe(true);
  });

  it("allows ordinary range shots and explicit non-course simulator modes", () => {
    expect(
      isPermanentShotDeletionRestricted({
        sessionType: "range",
        sessionPlayContext: "practice_bay",
        sessionCourseId: null,
        courseHoleNumber: null,
      }),
    ).toBe(false);
    expect(
      isPermanentShotDeletionRestricted({
        sessionType: "simulator",
        sessionPlayContext: "practice_bay",
        sessionCourseId: null,
        courseHoleNumber: null,
        providerKind: "simulation",
        providerSessionMode: "target",
      }),
    ).toBe(false);
  });

  it("conservatively protects simulator sessions when provider mode is unavailable or course-like", () => {
    expect(
      isPermanentShotDeletionRestricted({
        sessionType: "simulator",
        sessionPlayContext: "simulator",
        sessionCourseId: null,
        courseHoleNumber: null,
        providerKind: null,
        providerSessionMode: null,
      }),
    ).toBe(true);
    expect(
      isPermanentShotDeletionRestricted({
        sessionType: "simulator",
        sessionPlayContext: "simulator",
        sessionCourseId: null,
        courseHoleNumber: null,
        providerKind: "simulation",
        providerSessionMode: "courses",
      }),
    ).toBe(true);
  });
});
