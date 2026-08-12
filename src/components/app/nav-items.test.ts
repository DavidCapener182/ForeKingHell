import { describe, expect, it } from "vitest";

import {
  buildDesktopNavGroups,
  mobileMoreGroups,
  mobilePageTitle,
  mobilePrimaryItems,
} from "@/components/app/nav-items";

describe("application navigation hierarchy", () => {
  it("keeps five action-first mobile destinations", () => {
    expect(mobilePrimaryItems.map((item) => [item.label, item.href])).toEqual([
      ["Today", "/today"],
      ["Practice", "/practice"],
      ["Play", "/play"],
      ["Sessions", "/sessions"],
      ["More", "#more"],
    ]);

    expect(mobilePrimaryItems.find((item) => item.label === "Practice")?.isActive("/coach")).toBe(
      true,
    );
    expect(mobilePrimaryItems.find((item) => item.label === "Play")?.isActive("/play/bootle")).toBe(
      true,
    );
    expect(mobilePrimaryItems.find((item) => item.label === "More")?.isActive("/quick-bag")).toBe(
      true,
    );
  });

  it("keeps only explicitly approved companion destinations in More", () => {
    expect(mobileMoreGroups.map((group) => group.label)).toEqual(["Golf", "Compete", "Account"]);

    const mobileMoreRoutes = mobileMoreGroups.flatMap((group) =>
      group.items.map((item) => item.href),
    );
    expect(mobileMoreRoutes).toEqual(
      expect.arrayContaining([
        "/quick-bag",
        "/import",
        "/handicap",
        "/goals",
        "/challenges",
        "/tournaments",
        "/leaderboard",
        "/achievements",
        "/profile",
        "/settings/notifications",
        "/settings",
        "/privacy",
      ]),
    );
    expect(mobileMoreRoutes).not.toContain("/rapsodo");
    expect(mobileMoreGroups.flatMap((group) => group.items.map((item) => item.label))).toContain(
      "Import & Sync",
    );
    expect(mobileMoreRoutes).not.toEqual(
      expect.arrayContaining(["/providers", "/billing", "/equipment", "/admin"]),
    );
  });

  it("gives mobile chrome a stable route title", () => {
    expect(mobilePageTitle("/today")).toBe("Today");
    expect(mobilePageTitle("/rounds/round-1")).toBe("Rounds");
    expect(mobilePageTitle("/progress")).toBe("Progress");
    expect(mobilePageTitle("/analyse/session-impact")).toBe("Session impact");
    expect(mobilePageTitle("/unknown-route")).toBe("Golf analytics");
  });

  it("groups desktop routes by the joined-up improvement journey", () => {
    const playerGroups = buildDesktopNavGroups(false);
    const adminGroups = buildDesktopNavGroups(true);

    expect(playerGroups.map((group) => group.label)).toEqual([
      "Home",
      "Play",
      "Analyse",
      "Improve",
      "Compete",
      "Account",
    ]);
    expect(adminGroups.map((group) => group.label)).toEqual([
      "Home",
      "Play",
      "Analyse",
      "Improve",
      "Compete",
      "Account",
      "Admin",
    ]);

    const playerRoutes = playerGroups.flatMap((group) => group.items.map((item) => item.href));
    expect(playerRoutes).toEqual(
      expect.arrayContaining([
        "/today",
        "/sessions",
        "/analyse",
        "/bag",
        "/coach",
        "/courses",
        "/course-twins",
        "/leaderboard",
        "/practice",
        "/rounds",
        "/settings",
      ]),
    );

    expect(
      adminGroups.find((group) => group.label === "Admin")?.items.map((item) => item.href),
    ).toEqual([
      "/admin",
      "/partners",
      "/admin/system-checks",
      "/admin/users",
      "/admin/moderation",
      "/admin/billing",
      "/admin/challenges",
    ]);
  });
});
