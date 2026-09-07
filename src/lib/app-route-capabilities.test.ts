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
    expect(mobileCapabilities.progress.mobileNav).toBe("more");
    expect(mobileCapabilities.bag.mobileNav).toBe("primary");
  });

  it("opens upgraded routes directly while retaining unsupported workbench handoffs", () => {
    for (const path of ["/strokes-gained", "/compare", "/providers/jobs/1", "/admin/users", "/coach/reports"]) {
      expect(isDesktopOnlyCompanionPath(path), path).toBe(false);
    }
    for (const path of ["/admin/unsupported", "/compare/unsupported", "/coach/reports/unsupported"]) {
      expect(isDesktopOnlyCompanionPath(path), path).toBe(true);
    }
  });

  it("preserves the approved companion and immersive paths", () => {
    expect(isDesktopOnlyCompanionPath("/today")).toBe(false);
    expect(isDesktopOnlyCompanionPath("/dashboard")).toBe(false);
    expect(mobileCapabilities.dashboard.mobileExperience).toBe("companion");
    expect(isDesktopOnlyCompanionPath("/practice")).toBe(false);
    expect(isDesktopOnlyCompanionPath("/play/course-id")).toBe(false);
    expect(isDesktopOnlyCompanionPath("/courses/strategy")).toBe(false);
    expect(isDesktopOnlyCompanionPath("/courses")).toBe(false);
    expect(isDesktopOnlyCompanionPath("/courses/course-id/holes")).toBe(false);
    expect(mobileCapabilities.courses.mobileExperience).toBe("companion");
    expect(mobileCapabilities.courses.mobileNav).toBe("more");
    expect(isDesktopOnlyCompanionPath("/quick-bag")).toBe(false);
    expect(isDesktopOnlyCompanionPath("/bag")).toBe(false);
    expect(mobileCapabilities.bag.mobileExperience).toBe("companion");
    expect(mobileCapabilities.bag.mobileNav).toBe("primary");
    expect(mobileCapabilities.challenges.mobileExperience).toBe("companion");
    expect(mobileCapabilities.challenges.mobileNav).toBe("more");
    expect(isSummaryOnlyCompanionPath("/challenges")).toBe(false);
    expect(isSummaryOnlyCompanionPath("/challenges/challenge-id")).toBe(false);
    expect(isSummaryOnlyCompanionPath("/tournaments")).toBe(false);
    expect(isSummaryOnlyCompanionPath("/tournaments/tournament-id")).toBe(false);
  });

  it("opens upgraded summary routes directly and retains nested fallback boundaries", () => {
    expect(isSummaryOnlyCompanionPath("/coach")).toBe(false);
    expect(isSummaryOnlyCompanionPath("/goals/example")).toBe(false);
    expect(mobileCapabilities.goals.mobileExperience).toBe("companion");
    expect(isSummaryOnlyCompanionPath("/leaderboard")).toBe(false);
    expect(isSummaryOnlyCompanionPath("/settings")).toBe(false);
    expect(isSummaryOnlyCompanionPath("/coach/unsupported")).toBe(true);
  });
});
