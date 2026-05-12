import { describe, expect, it } from "vitest";

import { canEditAccount, canReadAccount } from "@/lib/account-access";

const memberships = [
  { ownerUserId: "owner", memberUserId: "coach", role: "coach" },
  { ownerUserId: "owner", memberUserId: "viewer", role: "viewer" },
  { ownerUserId: "owner", memberUserId: "editor", role: "editor" },
];

describe("account access helpers", () => {
  it("allows owners and invited roles to read an account", () => {
    expect(canReadAccount("owner", "owner", memberships)).toBe(true);
    expect(canReadAccount("coach", "owner", memberships)).toBe(true);
    expect(canReadAccount("viewer", "owner", memberships)).toBe(true);
    expect(canReadAccount("outsider", "owner", memberships)).toBe(false);
  });

  it("allows only owners and editors to edit a shared account", () => {
    expect(canEditAccount("owner", "owner", memberships)).toBe(true);
    expect(canEditAccount("editor", "owner", memberships)).toBe(true);
    expect(canEditAccount("coach", "owner", memberships)).toBe(false);
    expect(canEditAccount("viewer", "owner", memberships)).toBe(false);
  });
});
