import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import SessionsError from "@/app/(app)/sessions/error";

const errorSource = readFileSync(join(process.cwd(), "src/app/(app)/sessions/error.tsx"), "utf8");

describe("Sessions route error boundary", () => {
  it("renders an announced, route-specific recovery action", () => {
    const markup = renderToStaticMarkup(
      <SessionsError error={new Error("failed")} retry={vi.fn()} />,
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain("Session history could not load");
    expect(markup).toContain("Retry session history");
  });

  it("logs the failure and moves keyboard focus to recovery", () => {
    expect(errorSource).toContain("console.error(error)");
    expect(errorSource).toContain("retryButtonRef.current?.focus()");
  });
});
