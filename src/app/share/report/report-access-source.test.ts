import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/share/report/[token]/shared-coach-report-password-form.tsx"),
  "utf8",
);

describe("shared report access feedback", () => {
  it("uses shadcn Input, Button and Alert for the password gate", () => {
    expect(source).toContain("<Input");
    expect(source).toContain("<Button");
    expect(source).toContain('<Alert variant="destructive">');
    expect(source).toContain("<AlertDescription");
    expect(source).not.toContain('<p role="alert"');
  });
});
