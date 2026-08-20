import { describe, expect, it } from "vitest";

import {
  appRouteMetadata,
  findRouteMetadata,
  isMobileImmersiveRoute,
  mobileBackNavigation,
  routesAvailableTo,
} from "@/components/app/route-metadata";

describe("central route metadata", () => {
  it("keeps accurate page titles separate from mobile navigation groups", () => {
    expect(findRouteMetadata("/practice")?.pageTitle).toBe("Practice Planner");
    expect(findRouteMetadata("/practice")?.mobilePrimaryGroup).toBe("practice");
    expect(findRouteMetadata("/data-chat")?.pageTitle).toBe("Data Chat");
    expect(findRouteMetadata("/data-chat")?.mobilePrimaryGroup).toBe("review");
    expect(findRouteMetadata("/play/bootle")?.pageTitle).toBe("Course Twins");
    expect(findRouteMetadata("/play/bootle")?.mobilePrimaryGroup).toBe("strategy");
    expect(findRouteMetadata("/play/bootle")?.mobileExperience).toBe("immersive");
  });

  it("classifies every canonical route for the companion surface", () => {
    expect(appRouteMetadata.every((route) => Boolean(route.mobileExperience))).toBe(true);
    expect(findRouteMetadata("/today")?.mobileNav).toBe("primary");
    expect(findRouteMetadata("/practice")?.mobileNav).toBe("primary");
    expect(findRouteMetadata("/courses/strategy")?.mobileNav).toBe("primary");
    expect(findRouteMetadata("/bag")?.mobileNav).toBe("primary");
    expect(findRouteMetadata("/analyse")?.mobileExperience).toBe("desktop-only");
    expect(findRouteMetadata("/admin")?.mobileNav).toBe(false);
  });

  it("keeps aliases available for command search without exposing admin routes to players", () => {
    expect(findRouteMetadata("/bag")?.searchAliases).toContain("yardages");
    expect(findRouteMetadata("/courses/strategy")?.searchAliases).toContain("course plan");
    expect(findRouteMetadata("/course-twins")?.searchAliases).toContain("course simulator");
    expect(routesAvailableTo(false).some((route) => route.route === "/admin")).toBe(false);
    expect(routesAvailableTo(true).some((route) => route.route === "/admin")).toBe(true);
  });

  it("recognises only playable Course Twin routes as mobile immersive experiences", () => {
    expect(isMobileImmersiveRoute("/play/4de11156-16fd-4a36-84e0-fadda53456b0")).toBe(true);
    expect(isMobileImmersiveRoute("/play/aintree")).toBe(true);

    expect(isMobileImmersiveRoute("/play")).toBe(false);
    expect(isMobileImmersiveRoute("/play/")).toBe(false);
    expect(isMobileImmersiveRoute("/play/aintree/extra")).toBe(false);
    expect(isMobileImmersiveRoute("/course-twins")).toBe(false);
  });

  it("keeps pushed mobile detail screens on a single logical back hierarchy", () => {
    expect(mobileBackNavigation("/challenges/challenge-1")).toEqual({
      href: "/challenges",
      label: "Challenges",
    });
    expect(mobileBackNavigation("/tournaments/tournament-1")).toEqual({
      href: "/tournaments",
      label: "Tournaments",
    });
    expect(mobileBackNavigation("/course-records/record-1")).toEqual({
      href: "/course-records",
      label: "Records",
    });
    expect(mobileBackNavigation("/courses/course-1/records")).toEqual({
      href: "/course-records",
      label: "Records",
    });
    expect(mobileBackNavigation("/import/result")).toEqual({
      href: "/import",
      label: "Import",
    });
  });
});
