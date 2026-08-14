import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/scorecard-proof-uploader.tsx"),
  "utf8",
);

describe("scorecard proof uploader", () => {
  it("renders extraction failures in a semantic shadcn alert", () => {
    expect(source).toContain(
      'import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"',
    );
    expect(source).toContain('state.status === "error" ? (');
    expect(source).toContain('<Alert variant="destructive" aria-live="polite">');
    expect(source).toContain("<AlertDescription>{state.message}</AlertDescription>");
    expect(source).not.toContain("bg-[#F5F6F4]");
    expect(source).not.toContain("bg-white");
    expect(source).toContain("bg-muted/30");
    expect(source).toContain("bg-background");
  });
});
