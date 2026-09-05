import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/global-error.tsx"), "utf8");

describe("global error boundary", () => {
  it("uses the shared semantic error state and shadcn retry control", () => {
    expect(source).toContain('import { AppErrorState } from "@/components/app/app-error-state"');
    expect(source).toContain('import { Button } from "@/components/ui/button"');
    expect(source).toContain("<html");
    expect(source).toContain("<body");
    expect(source).toContain("<AppErrorState");
    expect(source).toContain("<Button");
    expect(source).toContain("onClick={retry}");
    expect(source).not.toContain("unstable_retry");
    expect(source).toContain("bg-background text-foreground");

    for (const retiredShell of ["<button", "premium-card", "bg-[#", "bg-white", "text-white"]) {
      expect(source).not.toContain(retiredShell);
    }
  });
});
