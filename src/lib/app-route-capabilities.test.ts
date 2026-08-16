import { describe, expect, it } from "vitest";

import {
  isDesktopOnlyCompanionPath,
  isSummaryOnlyCompanionPath,
  mobileCapabilities,
} from "@/lib/app-route-capabilities";

describe("companion route capabilities", () => {
  it("keeps primary companion routes explicit", () => {
    expect(mobileCapabilities.today.mobileNav).toBe("primary");
    expect(mobileCapabilities.practice.mobileNav).toBe("primary");
    expect(mobileCapabilities["play-companion"].mobileNav).toBe("primary");
    expect(mobileCapabilities.sessions.mobileNav).toBe("primary");
  });

  it("hands desktop workbenches off before their route loaders run", () => {
    expect(isDesktopOnlyCompanionPath("/strokes-gained")).toBe(true);
    expect(isDesktopOnlyCompanionPath("/compare")).toBe(true);
    expect(isDesktopOnlyCompanionPath("/providers/jobs/1")).toBe(true);
    expect(isDesktopOnlyCompanionPath("/admin/users")).toBe(true);
    expect(isDesktopOnlyCompanionPath("/coach/reports")).toBe(true);
  });

  it("preserves the approved companion and immersive paths", () => {
    expect(isDesktopOnlyCompanionPath("/today")).toBe(false);
    expect(isDesktopOnlyCompanionPath("/practice")).toBe(false);
    expect(isDesktopOnlyCompanionPath("/play/course-id")).toBe(false);
    expect(isDesktopOnlyCompanionPath("/courses/strategy")).toBe(false);
    expect(isDesktopOnlyCompanionPath("/courses")).toBe(false);
    expect(isDesktopOnlyCompanionPath("/courses/course-id/holes")).toBe(true);
    expect(mobileCapabilities.courses.mobileExperience).toBe("companion");
    expect(mobileCapabilities.courses.mobileNav).toBe("more");
    expect(isDesktopOnlyCompanionPath("/quick-bag")).toBe(false);
    expect(isDesktopOnlyCompanionPath("/bag")).toBe(false);
    expect(mobileCapabilities.bag.mobileExperience).toBe("companion");
    expect(mobileCapabilities.bag.mobileNav).toBe("more");
    expect(mobileCapabilities.challenges.mobileExperience).toBe("companion");
    expect(mobileCapabilities.challenges.mobileNav).toBe("more");
    expect(isSummaryOnlyCompanionPath("/challenges")).toBe(false);
    expect(isSummaryOnlyCompanionPath("/challenges/challenge-id")).toBe(false);
    expect(isSummaryOnlyCompanionPath("/tournaments")).toBe(false);
    expect(isSummaryOnlyCompanionPath("/tournaments/tournament-id")).toBe(false);
  });

  it("routes summary-only phone pages through the compact read-only surface", () => {
    expect(isSummaryOnlyCompanionPath("/coach")).toBe(true);
    expect(isSummaryOnlyCompanionPath("/goals/example")).toBe(true);
    expect(isSummaryOnlyCompanionPath("/leaderboard")).toBe(true);
    expect(isSummaryOnlyCompanionPath("/settings")).toBe(false);
  });
});
