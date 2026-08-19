import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import { findRouteMetadata } from "@/components/app/route-metadata";
import { isDesktopOnlyCompanionPath } from "@/lib/app-route-capabilities";
import { mobileRouteAudit } from "@/lib/mobile-route-audit";

const root = process.cwd();

function pageFiles(directory: string): string[] {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) return pageFiles(entryPath);
    return entry.name === "page.tsx" ? [entryPath] : [];
  });
}

describe("authenticated mobile route audit", () => {
  it("requires every authenticated and private-share page to have an explicit mobile decision", () => {
    const discovered = [
      ...pageFiles("src/app/(app)"),
      ...pageFiles("src/app/(admin)"),
      "src/app/share/[token]/page.tsx",
      "src/app/share/course-twin/[token]/page.tsx",
      "src/app/share/report/[token]/page.tsx",
    ].sort();
    const reviewed = mobileRouteAudit.map((entry) => entry.file).sort();

    expect(reviewed).toEqual(discovered);
  });

  it("keeps audit entries unique, classified and actionable", () => {
    const files = mobileRouteAudit.map((entry) => entry.file);
    const routes = mobileRouteAudit.map((entry) => entry.route);

    expect(new Set(files).size).toBe(files.length);
    expect(new Set(routes).size).toBe(routes.length);
    for (const entry of mobileRouteAudit) {
      expect([1, 2, 3, 4]).toContain(entry.classification);
      expect(["preserve", "redesign", "specialist", "redirect"]).toContain(entry.resolution);
      expect(entry.note.length).toBeGreaterThan(24);
      expect(relative(root, join(root, entry.file))).toBe(entry.file);
    }
  });

  it.each([
    {
      route: "/dashboard",
      runtimePath: "/dashboard",
      auditResolution: "redirect",
      owner: "desktop-only",
    },
    {
      route: "/admin/users",
      runtimePath: "/admin/users",
      auditResolution: "redesign",
      owner: "desktop-only",
    },
    {
      route: "/analyse/session-impact",
      runtimePath: "/analyse/session-impact",
      auditResolution: "specialist",
      owner: "desktop-only",
    },
    {
      route: "/bag",
      runtimePath: "/bag",
      auditResolution: "redesign",
      owner: "companion",
    },
    {
      route: "/play/[courseId]",
      runtimePath: "/play/example-course",
      auditResolution: "specialist",
      owner: "immersive",
    },
  ] as const)(
    "links $route filesystem coverage, audit status and runtime ownership",
    ({ route, runtimePath, auditResolution, owner }) => {
      const audit = mobileRouteAudit.find((entry) => entry.route === route);

      expect(audit).toBeDefined();
      expect(existsSync(join(root, audit!.file))).toBe(true);
      expect(audit!.resolution).toBe(auditResolution);
      expect(findRouteMetadata(runtimePath)?.mobileExperience).toBe(owner);
      expect(isDesktopOnlyCompanionPath(runtimePath)).toBe(owner === "desktop-only");
    },
  );
});
