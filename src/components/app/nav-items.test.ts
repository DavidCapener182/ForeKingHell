import { describe, expect, it } from "vitest";

import { buildDesktopNavGroups, mobilePrimaryItems } from "@/components/app/nav-items";

describe("desktop navigation groups", () => {
  it("keeps account routes in Platform and admin routes in a separate Admin group", () => {
    const playerGroups = buildDesktopNavGroups(false);
    const adminGroups = buildDesktopNavGroups(true);

    expect(playerGroups.map((group) => group.label)).toEqual([
      "Home",
      "Analyse",
      "Play",
      "Improve",
      "Social",
      "Platform",
    ]);
    expect(adminGroups.map((group) => group.label)).toEqual([
      "Home",
      "Analyse",
      "Play",
      "Improve",
      "Social",
      "Platform",
      "Admin",
    ]);

    expect(
      playerGroups.find((group) => group.label === "Improve")?.items.map((item) => item.href),
    ).not.toContain("/settings");
    expect(
      playerGroups.find((group) => group.label === "Platform")?.items.map((item) => item.href),
    ).toEqual(["/settings", "/billing", "/providers"]);
    expect(
      adminGroups.find((group) => group.label === "Platform")?.items.map((item) => item.href),
    ).toEqual(["/settings", "/billing", "/providers"]);
    expect(
      adminGroups.find((group) => group.label === "Admin")?.items.map((item) => item.href),
    ).toEqual([
      "/admin",
      "/partners",
      "/admin/users",
      "/admin/moderation",
      "/admin/billing",
      "/admin/challenges",
    ]);
  });

  it("matches the desktop route-group order from the command-centre plan", () => {
    const groups = buildDesktopNavGroups(false);
    const itemHrefsByGroup = Object.fromEntries(
      groups.map((group) => [group.label, group.items.map((item) => item.href)]),
    );

    expect(itemHrefsByGroup.Home).toEqual(["/dashboard", "/today", "/progress", "/strokes-gained"]);
    expect(itemHrefsByGroup.Analyse).toEqual([
      "/compare",
      "/bag",
      "/simulator-lab",
      "/speed",
      "/stats/training-over-time",
      "/equipment",
      "/shots",
      "/rapsodo",
    ]);
    expect(itemHrefsByGroup.Play).toEqual([
      "/rounds",
      "/courses",
      "/course-records",
      "/tournaments",
      "/handicap",
    ]);
    expect(itemHrefsByGroup.Improve).toEqual([
      "/practice",
      "/coach",
      "/data-chat",
      "/achievements",
    ]);
    expect(itemHrefsByGroup.Social).toEqual([
      "/feed",
      "/friends",
      "/groups",
      "/challenges",
      "/leaderboard",
      "/profile",
      "/social-intelligence",
    ]);
  });

  it("keeps Simulator Lab inside the primary Analyse active state", () => {
    const analyseItem = mobilePrimaryItems.find((item) => item.label === "Analyse");

    expect(analyseItem?.isActive("/simulator-lab")).toBe(true);
    expect(analyseItem?.isActive("/simulator-lab/session-1")).toBe(true);
  });
});
