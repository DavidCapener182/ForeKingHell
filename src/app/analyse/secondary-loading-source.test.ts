import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("secondary analysis loading boundaries", () => {
  it("uses route-shaped shadcn skeletons without legacy loader boundaries", () => {
    const workspace = source("src/app/(app)/analyse/workspace/loading.tsx");
    const sessionImpact = source("src/app/(app)/analyse/session-impact/loading.tsx");

    for (const loadingSource of [workspace, sessionImpact]) {
      expect(loadingSource).toContain("AppLoadingSkeleton");
      expect(loadingSource).toContain("PageShell");
      expect(loadingSource).toContain('role="status"');
      expect(loadingSource).toContain('aria-busy="true"');
      expect(loadingSource).not.toContain("RouteLoadingState");
      expect(loadingSource).not.toContain("DelayedGolfLoader");
    }

    expect(workspace).toContain('variant="table"');
    expect(sessionImpact).toContain('import { Skeleton } from "@/components/ui/skeleton"');
    expect(sessionImpact).toContain("<Skeleton");
  });
});
