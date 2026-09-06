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
      ["Sessions", "/sessions"],
      ["Practice", "/practice"],
      ["Play", "/play"],
      ["Bag", "/bag"],
    ]);

    expect(mobilePrimaryItems.find((item) => item.label === "Practice")?.isActive("/coach")).toBe(
      true,
    );
    expect(
      mobilePrimaryItems
        .find((item) => item.label === "Practice")
        ?.isActive("/practice/quick-range"),
    ).toBe(true);
    expect(mobilePrimaryItems.find((item) => item.label === "Play")?.isActive("/play/bootle")).toBe(
      true,
    );
    expect(mobilePrimaryItems.find((item) => item.label === "Sessions")?.isActive("/shots")).toBe(
      true,
    );
    expect(
      mobilePrimaryItems.find((item) => item.label === "Sessions")?.isActive("/progress"),
    ).toBe(true);
    expect(mobilePrimaryItems.find((item) => item.label === "Bag")?.isActive("/quick-bag")).toBe(
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
    expect(mobileMoreRoutes).not.toContain("/bag");
    expect(mobileMoreRoutes).not.toContain("/quick-bag");
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
    expect(mobilePageTitle("/import/result")).toBe("Import result");
    expect(mobilePageTitle("/analyse/session-impact")).toBe("Session impact");
    expect(mobilePageTitle("/unknown-route")).toBe("Golf analytics");
  });

  it("groups desktop routes by the joined-up improvement journey", () => {
    const playerGroups = buildDesktopNavGroups(false);
    const adminGroups = buildDesktopNavGroups(true);

    expect(playerGroups.map((group) => group.label)).toEqual([
      "Home",
      "Practice",
      "Sessions",
      "Rounds",
      "Strategy / Course Twin",
      "Bag",
      "Insights",
      "Data",
      "Settings",
    ]);
    expect(adminGroups.map((group) => group.label)).toEqual([
      "Home",
      "Practice",
      "Sessions",
      "Rounds",
      "Strategy / Course Twin",
      "Bag",
      "Insights",
      "Data",
      "Settings",
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
