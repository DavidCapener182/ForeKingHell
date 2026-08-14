import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const route = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Analyse recoverable error boundaries", () => {
  for (const path of [
    "src/app/(app)/analyse/workspace/error.tsx",
    "src/app/(app)/analyse/session-impact/error.tsx",
  ]) {
    it(`${path} uses the shared shadcn error composition`, () => {
      const source = route(path);

      expect(source).toContain("<AppErrorState");
      expect(source).toContain("<Button");
      expect(source).toContain("onClick={reset}");
      expect(source).not.toContain("RouteErrorState");
    });
  }
});
