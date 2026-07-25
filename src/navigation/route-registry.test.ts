import { describe, expect, it } from "vitest";

import { appRouteMetadata } from "@/components/app/route-metadata";
import { commandRoutes, findProductRoute, productRouteRegistry } from "@/navigation/route-registry";

describe("product route registry", () => {
  it("has unique stable route ids and hrefs", () => {
    const ids = productRouteRegistry.map((route) => route.id);
    const hrefs = productRouteRegistry.map((route) => route.href);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("projects the canonical route metadata without maintaining another route list", () => {
    const expectedHrefs = new Set(appRouteMetadata.map((route) => route.route));

    expect(new Set(productRouteRegistry.map((route) => route.href))).toEqual(expectedHrefs);
  });

  it("records all six product areas and mobile visibility modes", () => {
    expect(new Set(productRouteRegistry.map((route) => route.area))).toEqual(
      new Set(["today", "play", "analyse", "improve", "compete", "account"]),
    );
    expect(new Set(productRouteRegistry.map((route) => route.mobileVisibility))).toEqual(
      new Set(["primary", "secondary", "hidden"]),
    );
    expect(productRouteRegistry.find((route) => route.href === "/today")?.mobileVisibility).toBe(
      "primary",
    );
    expect(productRouteRegistry.find((route) => route.href === "/rapsodo")?.mobileVisibility).toBe(
      "secondary",
    );
  });

  it("only exposes admin commands to administrators", () => {
    expect(commandRoutes(false).some((route) => route.admin)).toBe(false);
    expect(commandRoutes(true).some((route) => route.href === "/admin/system-checks")).toBe(true);
  });

  it("selects the most specific active route", () => {
    expect(findProductRoute("/courses/strategy")?.href).toBe("/courses/strategy");
    expect(findProductRoute("/settings/notifications")?.href).toBe("/settings/notifications");
  });
});
