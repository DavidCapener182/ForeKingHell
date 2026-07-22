import { describe, expect, it } from "vitest";

import {
  buildDesktopNavGroups,
  mobilePageTitle,
  mobilePrimaryItems,
} from "@/components/app/nav-items";

describe("application navigation hierarchy", () => {
  it("keeps five action-first mobile destinations", () => {
    expect(mobilePrimaryItems.map((item) => [item.label, item.href])).toEqual([
      ["Home", "/today"],
      ["Sessions", "/sessions"],
      ["Analyse", "/analyse"],
      ["Practice", "/practice"],
      ["More", "#more"],
    ]);

    expect(mobilePrimaryItems.find((item) => item.label === "Analyse")?.isActive("/progress")).toBe(
      true,
    );
    expect(mobilePrimaryItems.find((item) => item.label === "Analyse")?.isActive("/bag")).toBe(
      true,
    );
    expect(mobilePrimaryItems.find((item) => item.label === "Practice")?.isActive("/coach")).toBe(
      true,
    );
    expect(mobilePrimaryItems.find((item) => item.label === "More")?.isActive("/feed")).toBe(true);
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
    for (const route of [
      "/today",
      "/sessions",
      "/analyse",
      "/shots",
      "/bag",
      "/practice",
      "/practice/quick-range",
      "/goals",
      "/rounds",
      "/courses/strategy",
      "/settings",
      "/settings/notifications",
      "/billing",
      "/providers",
    ]) {
      expect(playerRoutes).toContain(route);
    }

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
