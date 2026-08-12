import { describe, expect, it } from "vitest";

import { isDesignatedMutatingTestUser } from "./mutating-e2e-account";

describe("mutating E2E account guard", () => {
  it("rejects an authenticated account unless it is explicitly designated", () => {
    expect(isDesignatedMutatingTestUser("real-user", undefined)).toBe(false);
    expect(isDesignatedMutatingTestUser("real-user", "different-user")).toBe(false);
  });

  it("allows only an exact designated test-user match", () => {
    expect(isDesignatedMutatingTestUser("test-user", "test-user")).toBe(true);
    expect(isDesignatedMutatingTestUser("test-user", " test-user ")).toBe(true);
  });
});
