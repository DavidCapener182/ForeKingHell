import { describe, expect, it } from "vitest";
import { decodeFeedCursor, encodeFeedCursor, feedPageHref, validFeedDate } from "./feed-pagination";
describe("feed cursor and query state", () => {
  it("retains database microseconds and rejects malformed timestamp cursors", () => {
    const cursor = {
      createdAt: "2026-01-02 01:01:01.123456+00",
      id: "00000000-0000-4000-8000-000000000123",
    };
    expect(decodeFeedCursor(encodeFeedCursor(cursor))).toEqual(cursor);
    for (const createdAt of ["0", "2026-02-31 01:01:01+00", "garbage"])
      expect(decodeFeedCursor(encodeFeedCursor({ ...cursor, createdAt }))).toBeNull();
    expect(decodeFeedCursor("garbage")).toBeNull();
    expect(validFeedDate("2026-02-31")).toBeUndefined();
  });
  it("preserves audience, search and UTC dates on page links", () => {
    const href = feedPageHref({
      filter: "friends",
      query: "7 iron & practice",
      from: "2026-01-01",
      to: "2026-01-31",
      after: "cursor",
    });
    const params = new URL(href, "https://fixture.invalid").searchParams;
    expect(Object.fromEntries(params)).toEqual({
      filter: "friends",
      q: "7 iron & practice",
      from: "2026-01-01",
      to: "2026-01-31",
      after: "cursor",
    });
  });
});
