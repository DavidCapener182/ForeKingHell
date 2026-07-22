import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

describe("documented route map", () => {
  it("accounts for every application page without deleting secondary routes", () => {
    const appRoot = join(process.cwd(), "src/app");
    const routeMap = readFileSync(join(process.cwd(), "docs/ROUTE_MAP.md"), "utf8");
    const pageRoutes = walk(appRoot)
      .filter((file) => file.endsWith(`${sep}page.tsx`))
      .map((file) => {
        const route = relative(appRoot, file)
          .replaceAll(sep, "/")
          .replace(/(^|\/)page\.tsx$/, "")
          .split("/")
          .filter((segment) => !/^\(.+\)$/.test(segment))
          .join("/");
        return route ? `/${route}` : "/";
      });

    for (const route of pageRoutes) {
      expect(routeMap, `Missing route ${route}`).toContain(`\`${route}\``);
    }
  });
});

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}
