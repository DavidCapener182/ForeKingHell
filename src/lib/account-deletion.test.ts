import { describe, expect, it } from "vitest";

import { isRecentSignIn, RECENT_SIGN_IN_WINDOW_MS } from "@/lib/account-deletion";

describe("account deletion reauthentication", () => {
  const now = Date.parse("2026-07-21T20:00:00.000Z");

  it("accepts a sign-in inside the recent-authentication window", () => {
    expect(isRecentSignIn(new Date(now - RECENT_SIGN_IN_WINDOW_MS + 1).toISOString(), now)).toBe(
      true,
    );
  });

  it("rejects absent, invalid, stale, and future timestamps", () => {
    expect(isRecentSignIn(undefined, now)).toBe(false);
    expect(isRecentSignIn("not-a-date", now)).toBe(false);
    expect(isRecentSignIn(new Date(now - RECENT_SIGN_IN_WINDOW_MS - 1).toISOString(), now)).toBe(
      false,
    );
    expect(isRecentSignIn(new Date(now + 1).toISOString(), now)).toBe(false);
  });
});
