import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/coach/page.tsx"), "utf8");

describe("coach desktop evidence workbench", () => {
  it("keeps coach evidence as an exportable desktop table", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('viewKey="coach-evidence"');
    expect(source).toContain('scope="coach-evidence"');
    expect(source).toContain('data-workbench-scope="coach-evidence"');
    expect(source).toContain('exportTableId="coach-evidence"');
    expect(source).toContain('data-workbench-export-table="coach-evidence"');
    expect(source).toContain('mainTableLabel="Coach evidence table"');
    expect(source).toContain("stickyFirstColumn");
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");

    for (const column of [
      "club",
      "issue",
      "trust",
      "sample",
      "stock",
      "playable",
      "miss",
      "drill",
      "action",
    ]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });

  it("keeps the contextual AI coach rail and prompt controls", () => {
    expect(source).toContain("DesktopInsightRail");
    expect(source).toContain('title="AI coach rail"');
    expect(source).toContain("coachWorkbenchPrompts");
    expect(source).not.toContain("railBreakpoint=");
    expect(source).toContain("rail={");
  });

  it("loads social challenge context only when the coach desk asks for it", () => {
    expect(source).toContain("type CoachSocialContext");
    expect(source).toContain("shouldLoadCoachSocial(first(params.social))");
    expect(source).toContain("socialLoaded ? getChallengesPageData() : Promise.resolve(null)");
    expect(source).toContain("const socialContext: CoachSocialContext");
    expect(source).toContain('id="coach-social-comparison"');
    expect(source).toContain("open={socialContext.loaded ? true : undefined}");
    expect(source).toContain("socialContext={socialContext}");
    expect(source).toContain('loadHref="/coach?social=1#coach-social-comparison"');
    expect(source).toContain("Social comparison is on demand");
    expect(source).toContain("Load challenge context");
  });

  it("keeps bento cards and movement tiles aligned to their rows", () => {
    expect(source).toContain('className="grid auto-rows-auto items-stretch gap-4 lg:gap-5"');
    expect(source).toContain('cn("min-w-0 h-full", className)');
    expect(source).toContain('<DataPanel className="h-full gap-0 py-0">');
    expect(source).toContain('className="grid flex-1 auto-rows-fr gap-3 p-3 md:grid-cols-2"');
    expect(source).toContain(
      'className="block h-full transition-transform hover:-translate-y-0.5"',
    );
  });
});
