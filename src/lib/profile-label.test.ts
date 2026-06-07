import { describe, expect, it } from "vitest";

import {
  cleanProfileLabel,
  isSharedDatabaseArtifact,
  profileLabelFromEmail,
  profileLabelFromIdentity,
} from "@/lib/profile-label";

describe("profile labels", () => {
  it("uses clean auth metadata before email fallback", () => {
    expect(profileLabelFromIdentity("  ForeKingHell  ", "capener182@googlemail.com")).toBe(
      "ForeKingHell",
    );
  });

  it("does not expose shared InCert auth metadata", () => {
    expect(profileLabelFromIdentity("InCert Super Admin", "capener182@googlemail.com")).toBe(
      "capener182",
    );
  });

  it("rejects shared artifacts in display names and email local parts", () => {
    expect(cleanProfileLabel("InCert Super Admin")).toBeNull();
    expect(profileLabelFromEmail("incert@example.com")).toBeNull();
    expect(profileLabelFromIdentity("InCert Super Admin", "incert@example.com", "Profile")).toBe(
      "Profile",
    );
  });

  it("detects legacy shared database labels case-insensitively", () => {
    expect(isSharedDatabaseArtifact("incert super admin")).toBe(true);
    expect(isSharedDatabaseArtifact("ForeKingHell")).toBe(false);
  });
});
