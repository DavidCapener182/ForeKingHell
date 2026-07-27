import { describe, expect, it } from "vitest";

import { findRouteMetadata, routesAvailableTo } from "@/components/app/route-metadata";

describe("central route metadata", () => {
  it("keeps accurate page titles separate from mobile navigation groups", () => {
    expect(findRouteMetadata("/practice")?.pageTitle).toBe("Practice Planner");
    expect(findRouteMetadata("/practice")?.mobilePrimaryGroup).toBe("practice");
    expect(findRouteMetadata("/data-chat")?.pageTitle).toBe("Data Chat");
    expect(findRouteMetadata("/data-chat")?.mobilePrimaryGroup).toBe("analyse");
    expect(findRouteMetadata("/play/bootle")?.pageTitle).toBe("Course Twins");
    expect(findRouteMetadata("/play/bootle")?.mobilePrimaryGroup).toBe("sessions");
  });

  it("keeps aliases available for command search without exposing admin routes to players", () => {
    expect(findRouteMetadata("/bag")?.searchAliases).toContain("yardages");
    expect(findRouteMetadata("/courses/strategy")?.searchAliases).toContain("course plan");
    expect(findRouteMetadata("/course-twins")?.searchAliases).toContain("course simulator");
    expect(routesAvailableTo(false).some((route) => route.route === "/admin")).toBe(false);
    expect(routesAvailableTo(true).some((route) => route.route === "/admin")).toBe(true);
  });
});
