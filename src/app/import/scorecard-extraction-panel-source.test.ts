import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/import/scorecard-extraction-panel.tsx"),
  "utf8",
);

describe("scorecard extraction panel source contract", () => {
  it("offers only the image formats accepted by the extraction endpoint", () => {
    expect(source).toContain('accept="image/jpeg,image/png,image/webp"');
    expect(source).toContain("up to 5 MB");
  });
  it("uses the shared shadcn textarea for editable scorecard rows", () => {
    expect(source).toContain('import { Textarea } from "@/components/ui/textarea"');
    expect(source).toContain("<Textarea");
    expect(source).not.toMatch(/<textarea\b/);
  });
});
