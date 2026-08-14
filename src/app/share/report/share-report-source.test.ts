import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const workbench = readFileSync(
  join(process.cwd(), "src/app/share/report/[token]/shared-coach-report-workbench.tsx"),
  "utf8",
);
const passwordForm = readFileSync(
  join(process.cwd(), "src/app/share/report/[token]/shared-coach-report-password-form.tsx"),
  "utf8",
);
const loadingSource = readFileSync(
  join(process.cwd(), "src/app/share/report/[token]/loading.tsx"),
  "utf8",
);

describe("shared coach report composition", () => {
  it("uses the shared shadcn table for every exported evidence table", () => {
    expect(workbench).toContain('from "@/components/ui/table"');
    expect(workbench.match(/<Table\b/g)).toHaveLength(3);
    expect(workbench).not.toMatch(/<(?:table|thead|tbody|tr|th|td)\b/);
  });

  it("uses a shadcn alert for invalid password feedback", () => {
    expect(passwordForm).toContain('<Alert variant="destructive"');
    expect(passwordForm).not.toMatch(/<p[^>]*role="alert"/);
  });

  it("uses shared Skeletons for the frozen report loading boundary", () => {
    expect(loadingSource).toContain('from "@/components/ui/skeleton"');
    expect(loadingSource.match(/<Skeleton\b/g)).toHaveLength(3);
    expect(loadingSource).not.toContain("animate-pulse");
  });
});
