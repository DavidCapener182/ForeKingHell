import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/profile/page.tsx"), "utf8");

describe("profile desktop editor", () => {
  it("keeps the profile editor as a full-width desktop workspace with semantic rails", () => {
    expect(source).toContain("<PageShell>");
    expect(source).toContain('<DesktopWorkbenchLayout scope="profile">');
    expect(source).toContain('aria-label="Profile completion rail"');
    expect(source).toContain('aria-label="Profile invite rail"');
    expect(source).toContain('aria-label="Identity and privacy settings"');
    expect(source).toContain("PublicSharePreviewPanel");
    expect(source).toContain("ProfileMediaEditor");
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain("profileEvidenceColumns");
    expect(source).toContain("profileEvidenceSavedViews");
    expect(source).toContain('data-workbench-scope="profile-evidence"');
    expect(source).toContain('data-workbench-export-table="profile-evidence-ledger"');
    expect(source).toContain('mainTableLabel="Profile evidence ledger table"');
    expect(source).toContain('mainTableLabel="Profile evidence ledger table" stickyFirstColumn');
    expect(source).toContain('id="profile-evidence-ledger-summary"');
    expect(source).toContain('id="identity-privacy"');
    expect(source).toContain("profile-settings-form");
    expect(source).not.toContain('<PageShell size="6xl">');
  });
});
