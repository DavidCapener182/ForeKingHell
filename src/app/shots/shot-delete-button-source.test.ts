import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/shots/shot-delete-button.tsx"), "utf8");

describe("shot deletion feedback", () => {
  it("keeps confirmation destructive and renders failure with shadcn Alert", () => {
    expect(source).toContain("<AlertDialog");
    expect(source).toContain('variant="destructive"');
    expect(source).toContain("<AlertDescription");
    expect(source).not.toContain('<p role="alert"');
  });
});
