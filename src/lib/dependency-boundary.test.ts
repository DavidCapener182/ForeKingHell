import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const sourceRoot = join(root, "src");
const sourceFiles = walk(sourceRoot).filter((path) => [".ts", ".tsx"].includes(extname(path)));

describe("source dependency boundaries", () => {
  it("keeps database and server-only modules out of UI and client components", () => {
    const violations: string[] = [];

    for (const path of sourceFiles) {
      const source = readFileSync(path, "utf8");
      const projectPath = relative(root, path);
      const isComponent = projectPath.startsWith("src/components/");
      const isClient = /^(["'])use client\1;/.test(source);

      if (isComponent && /from ["']@\/db(?:\/|["'])/.test(source)) {
        violations.push(`${projectPath}: UI component imports database code`);
      }

      if (
        isClient &&
        (/from ["']@\/db(?:\/|["'])/.test(source) ||
          /import ["']server-only["']/.test(source) ||
          /from ["']@\/lib\/(?:admin|current-user|supabase\/server)["']/.test(source))
      ) {
        violations.push(`${projectPath}: client component imports a server boundary`);
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps pure TypeScript domain modules independent from React", () => {
    const violations = sourceFiles
      .filter((path) => path.startsWith(join(sourceRoot, "lib/")) && extname(path) === ".ts")
      .flatMap((path) => {
        const source = readFileSync(path, "utf8");
        const isServerInfrastructure = /import ["']server-only["']/.test(source);
        return !isServerInfrastructure && /from ["']react["']/.test(source)
          ? [`${relative(root, path)}: domain module imports React`]
          : [];
      });

    expect(violations).toEqual([]);
  });

  it("marks the PostgreSQL connection module as server-only", () => {
    expect(readFileSync(join(sourceRoot, "db/client.ts"), "utf8")).toMatch(
      /^import ["']server-only["'];/,
    );
  });
});

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}
