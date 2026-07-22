import { describe, expect, it } from "vitest";

import {
  createShareToken,
  getShareExpiry,
  hashShareToken,
  parseShareResourceType,
} from "@/lib/share-links";

describe("share links", () => {
  it("creates unguessable tokens and stable hashes", () => {
    const token = createShareToken();
    expect(token.length).toBeGreaterThan(30);
    expect(hashShareToken(token)).toHaveLength(64);
  });

  it("supports expiring or non-expiring links", () => {
    expect(getShareExpiry(null)).toBeNull();
    expect(getShareExpiry(7, new Date("2026-05-12T12:00:00Z"))?.toISOString()).toBe(
      "2026-05-19T12:00:00.000Z",
    );
  });

  it("recognises the coach-report resource without widening unknown values", () => {
    expect(parseShareResourceType("coach_report")).toBe("coach_report");
    expect(parseShareResourceType("unexpected")).toBe("round");
  });
});
