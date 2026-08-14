import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const reports = readFileSync(join(process.cwd(), "src/app/(app)/coach/reports/page.tsx"), "utf8");
const workspace = readFileSync(
  join(process.cwd(), "src/app/(app)/coach/workspace/page.tsx"),
  "utf8",
);

describe("coach expected-error notices", () => {
  it("uses shadcn destructive alerts without raw notice shells", () => {
    for (const source of [reports, workspace]) {
      expect(source).toContain('import { Alert, AlertTitle } from "@/components/ui/alert"');
      expect(source).toContain('<Alert variant="destructive">');
      expect(source).toContain("<AlertTriangle");
      expect(source).not.toContain('role="alert"');
      expect(source).not.toMatch(/border-destructive\/|bg-destructive\//);
    }

    expect(reports).toContain("Select at least one report section.");
    expect(workspace).toContain("That coach action could not be saved.");
  });
});
