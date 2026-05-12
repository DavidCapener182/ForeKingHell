import { describe, expect, it } from "vitest";

import {
  createInvitationToken,
  getInvitationExpiry,
  hashInvitationToken,
  normalizeInvitationEmail,
  parseCollaborationRole,
} from "@/lib/collaboration";

describe("collaboration helpers", () => {
  it("normalizes invitation emails", () => {
    expect(normalizeInvitationEmail("  COACH@example.COM ")).toBe("coach@example.com");
    expect(() => normalizeInvitationEmail("not-an-email")).toThrow("valid email");
  });

  it("defaults unsafe roles to viewer", () => {
    expect(parseCollaborationRole("coach")).toBe("coach");
    expect(parseCollaborationRole("owner")).toBe("viewer");
  });

  it("creates hashable invitation tokens with a two-week expiry", () => {
    const token = createInvitationToken();
    const hash = hashInvitationToken(token);
    const expiresAt = getInvitationExpiry(new Date("2026-05-12T12:00:00Z"));

    expect(token.length).toBeGreaterThan(30);
    expect(hash).toHaveLength(64);
    expect(expiresAt.toISOString()).toBe("2026-05-26T12:00:00.000Z");
  });
});
