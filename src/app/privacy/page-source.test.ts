import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/privacy/page.tsx"), "utf8");

describe("privacy page desktop shell", () => {
  it("keeps the privacy notice on the full app content shell without a desktop AI rail", () => {
    expect(source).toContain("<PageShell>");
    expect(source).toContain("${BRAND_NAME} data notice");
    expect(source).toContain('href="/settings?section=privacy"');
    expect(source).toContain('aria-label="On this page"');
    for (const title of [
      "Data stored",
      "Account scope and sharing",
      "AI coaching and Data Chat",
      "Scorecard images",
      "Product analytics",
      "Export, reset and account deletion",
    ])
      expect(source).toContain(title);
    expect(source).not.toContain('<PageShell size="6xl">');
    expect(source).not.toContain('<PageShell size="7xl">');
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("rail={");
  });
});
