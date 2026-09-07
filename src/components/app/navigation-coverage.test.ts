import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { findRouteMetadata, routesAvailableTo } from "./route-metadata";
import { buildDesktopNavGroups, buildMobileMoreGroups, mobilePrimaryItems } from "./nav-items";
import { commandRoutes } from "@/navigation/route-registry";

// These are internal rewrites, share-link workflows or authentication/offline
// entry states, rather than invented sidebar links containing placeholder IDs.
const parentTasks: Record<string, string> = {
  "/companion-runtime/import": "/import",
  "/companion-runtime/import/csv": "/import",
  "/companion-runtime/import/result": "/import",
  "/companion-runtime/rapsodo": "/rapsodo",
  "/shared/[userId]": "/settings",
  "/share/[token]": "/rounds",
  "/share/course-twin/[token]": "/course-twins",
  "/share/report/[token]": "/coach/reports",
  "/companion/handoff": "/today",
  "/companion/summary": "/today",
};
const entryStates = new Set(["/", "/login", "/welcome", "/offline", "/privacy"]);
const documentedRoutes = readFileSync("ForeKingHell-route-coverage.csv", "utf8")
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((line) => line.match(/^[^,]+,([^,]+),/)![1]);

describe("documented route navigation coverage", () => {
  it("reconciles every one of the 98 route families with an entry state or authorized canonical task", () => {
    expect(documentedRoutes).toHaveLength(98);
    expect(new Set(documentedRoutes).size).toBe(98);
    for (const isAdmin of [false, true]) {
      const desktop = new Set(
        buildDesktopNavGroups(isAdmin).flatMap((group) => group.items.map((item) => item.href)),
      );
      const commands = new Set(commandRoutes(isAdmin).map((item) => item.href));
      const mobile = new Set(
        [
          ...mobilePrimaryItems,
          ...buildMobileMoreGroups(isAdmin).flatMap((group) => group.items),
        ].map((item) => item.href),
      );
      for (const route of documentedRoutes) {
        if (entryStates.has(route)) continue;
        const canonical = findRouteMetadata(parentTasks[route] ?? route);
        expect(canonical, `Missing canonical task for ${route}`).toBeDefined();
        const available = !canonical!.adminOnly || isAdmin;
        expect(commands.has(canonical!.route), `${route} command permissions`).toBe(available);
        expect(mobile.has(canonical!.route), `${route} More/primary permissions`).toBe(available);
        if (available)
          expect(
            desktop.has(canonical!.route) || commands.has(canonical!.route),
            `${route} desktop discovery`,
          ).toBe(true);
      }
    }
  });
  it("keeps every permitted metadata destination in More or its primary tabs without duplicating links", () => {
    for (const isAdmin of [false, true]) {
      const links = [
        ...mobilePrimaryItems,
        ...buildMobileMoreGroups(isAdmin).flatMap((group) => group.items),
      ];
      expect(new Set(links.map((item) => item.href)).size).toBe(links.length);
      for (const route of routesAvailableTo(isAdmin))
        expect(
          links.some((item) => item.href === route.route),
          route.route,
        ).toBe(true);
      expect(links.find((item) => item.href === "/social-intelligence")?.searchKeywords).toContain(
        "recaps",
      );
      expect(links.find((item) => item.href === "/partners") !== undefined).toBe(isAdmin);
    }
  });
});
