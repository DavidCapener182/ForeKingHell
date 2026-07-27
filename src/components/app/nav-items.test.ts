import { describe, expect, it } from "vitest";

import {
  buildDesktopNavGroups,
  mobileMoreGroups,
  mobilePageTitle,
  mobilePrimaryItems,
} from "@/components/app/nav-items";
import { appRouteMetadata } from "@/components/app/route-metadata";

describe("application navigation hierarchy", () => {
  it("keeps five action-first mobile destinations", () => {
    expect(mobilePrimaryItems.map((item) => [item.label, item.href])).toEqual([
      ["Today", "/today"],
      ["Sessions", "/sessions"],
      ["Analyse", "/analyse"],
      ["Improve", "/coach"],
      ["More", "#more"],
    ]);

    expect(mobilePrimaryItems.find((item) => item.label === "Analyse")?.isActive("/progress")).toBe(
      true,
    );
    expect(mobilePrimaryItems.find((item) => item.label === "Analyse")?.isActive("/bag")).toBe(
      true,
    );
    expect(mobilePrimaryItems.find((item) => item.label === "Improve")?.isActive("/coach")).toBe(
      true,
    );
    expect(
      mobilePrimaryItems.find((item) => item.label === "Sessions")?.isActive("/play/bootle"),
    ).toBe(true);
    expect(mobilePrimaryItems.find((item) => item.label === "More")?.isActive("/feed")).toBe(true);
  });

  it("keeps every non-primary player destination reachable from More", () => {
    expect(mobileMoreGroups.map((group) => group.label)).toEqual([
      "Home",
      "Play",
      "Analyse",
      "Improve",
      "Compete",
      "Social",
      "Account",
    ]);

    const mobileMoreRoutes = mobileMoreGroups.flatMap((group) =>
      group.items.map((item) => item.href),
    );
    const expectedMobileMoreRoutes = appRouteMetadata
      .filter(
        (route) =>
          !route.adminOnly &&
          !route.mobilePrimaryDestination &&
          (route.desktopVisible !== false || route.mobileMoreGroup !== undefined),
      )
      .map((route) => route.route)
      .sort();

    expect([...mobileMoreRoutes].sort()).toEqual(expectedMobileMoreRoutes);
    expect(mobileMoreRoutes).toEqual(
      expect.arrayContaining([
        "/dashboard",
        "/bag",
        "/shots",
        "/compare",
        "/progress",
        "/practice",
        "/practice/quick-range",
        "/speed",
        "/goals",
        "/data-chat",
      ]),
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
