import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/privacy/page.tsx"), "utf8");

describe("privacy page desktop shell", () => {
  it("keeps the privacy notice on the full app content shell without a desktop AI rail", () => {
    expect(source).toContain("<PageShell>");
    expect(source).toContain("Privacy summary");
    expect(source).toContain("Public launch gate");
    expect(source).not.toContain('<PageShell size="6xl">');
    expect(source).not.toContain('<PageShell size="7xl">');
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("rail={");
  });
});
