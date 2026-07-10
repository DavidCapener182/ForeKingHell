import { describe, expect, it } from "vitest";

import { getProfileInitials } from "@/lib/profile-initials";

describe("getProfileInitials", () => {
  it("keeps at most two initials and provides a stable fallback", () => {
    expect(getProfileInitials("Ada Lovelace Golfer")).toBe("AL");
    expect(getProfileInitials("   ")).toBe("LM");
  });
});
