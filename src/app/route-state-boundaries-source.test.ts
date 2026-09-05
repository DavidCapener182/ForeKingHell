import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

describe("authenticated route state boundaries", () => {
  it("gives every authenticated route a shared loading and recoverable error boundary", () => {
    const loading = source("src/app/(app)/loading.tsx");
    const error = source("src/app/(app)/error.tsx");

    expect(loading).toContain('role="status"');
    expect(loading).toContain('aria-busy="true"');
    expect(loading).toContain("AppLoadingSkeleton");
    expect(error).toContain("AuthenticatedRouteError");
    expect(error).toContain("retry: () => void");
    expect(error).toContain("<SegmentErrorState {...props}");
  });

  it("keeps reusable empty, offline and retry states available to partial routes", () => {
    expect(source("src/components/app/app-empty-state.tsx")).toContain("AppEmptyState");
    expect(source("src/components/app/offline-state.tsx")).toContain("OfflineState");
    expect(source("src/components/segment-error-state.tsx")).toContain("onClick={retry}");
  });
});
