import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/app/companion-sync-status.tsx"),
  "utf8",
);

describe("companion sync attention state", () => {
  it("presents a retryable alert without a misleading completion bar", () => {
    expect(source).toContain('role={state.needsAttention ? "alert" : "status"}');
    expect(source).toContain('aria-live={state.needsAttention ? "assertive" : "polite"}');
    expect(source).toContain("!state.needsAttention ? (");
    expect(source).not.toContain("state.needsAttention ? 100");
    expect(source).toContain("Retry queued upload sync");
  });
});
