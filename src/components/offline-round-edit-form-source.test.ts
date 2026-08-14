import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/offline-round-edit-form.tsx"),
  "utf8",
);

describe("offline round edit status", () => {
  it("uses semantic shadcn alerts for saving, saved, failed and queued states", () => {
    expect(source).toContain('import { Alert, AlertDescription } from "@/components/ui/alert"');
    expect(source.match(/<Alert\b/g)).toHaveLength(4);
    expect(source).toContain('variant="destructive"');
    expect(source).toContain("var(--status-information-surface)");
    expect(source).toContain("var(--status-success-surface)");
    expect(source).toContain("var(--status-warning-surface)");
    expect(source).not.toMatch(/text-(?:red|amber|green|emerald)-\d+|text-\[#/);
  });
});
