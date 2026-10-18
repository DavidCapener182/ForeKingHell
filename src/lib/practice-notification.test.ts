import { describe, expect, it } from "vitest";
import { practiceReviewNotification } from "./practice-notification";
import { notificationReadIds } from "./notification-read-state";

const candidate = {
  planId: "plan-a",
  sessionId: "upload-a",
  title: "Driver retest",
  status: "match_found",
  accepted: false,
  analysed: false,
  createdAt: new Date("2026-10-18T12:00:00Z"),
};

describe("practice review notification identity", () => {
  it("labels an ambiguous association without claiming success", () => {
    expect(practiceReviewNotification(candidate)).toMatchObject({
      title: "Possible practice match",
      href: "/practice?planId=plan-a",
    });
    expect(practiceReviewNotification(candidate)?.detail).toContain(
      "confirm the session association",
    );
  });
  it("announces readiness only for the accepted and analysed upload", () => {
    expect(practiceReviewNotification({ ...candidate, accepted: true })).toBeNull();
    expect(
      practiceReviewNotification({ ...candidate, accepted: true, status: "analysed" }),
    ).toBeNull();
    expect(
      practiceReviewNotification({
        ...candidate,
        accepted: true,
        analysed: true,
        status: "analysed",
      }),
    ).toMatchObject({ title: "Practice review ready" });
  });
  it("uses one stable event for candidate, completion and recalculation", () => {
    const first = practiceReviewNotification(candidate)!;
    const ready = practiceReviewNotification({
      ...candidate,
      accepted: true,
      analysed: true,
      status: "analysed",
    })!;
    expect(ready.id).toBe(first.id);
    const read = notificationReadIds({ notificationReadIds: [first.id, first.id] });
    expect(read).toEqual([ready.id]);
    expect(practiceReviewNotification({ ...candidate, sessionId: "upload-b" })?.id).not.toBe(
      first.id,
    );
  });
});
