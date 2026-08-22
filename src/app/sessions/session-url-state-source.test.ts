import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(join(process.cwd(), "src/app/(app)/sessions/page.tsx"), "utf8");
const workbenchPageSource = readFileSync(
  join(process.cwd(), "src/app/(app)/sessions/sessions-workbench-page.tsx"),
  "utf8",
);
const companionPageSource = readFileSync(
  join(process.cwd(), "src/app/(app)/sessions/sessions-companion-page.tsx"),
  "utf8",
);
const urlStateSource = readFileSync(
  join(process.cwd(), "src/app/sessions/use-session-history-url-state.ts"),
  "utf8",
);
const timelineSource = readFileSync(
  join(process.cwd(), "src/app/sessions/session-timeline.tsx"),
  "utf8",
);
const companionListSource = readFileSync(
  join(process.cwd(), "src/app/sessions/sessions-companion-list.tsx"),
  "utf8",
);
const filterSheetSource = readFileSync(
  join(process.cwd(), "src/app/sessions/session-history-filter-sheet.tsx"),
  "utf8",
);

describe("Sessions URL state boundaries", () => {
  it("awaits Next 16 searchParams in the server page before selecting a surface", () => {
    expect(pageSource).toContain("searchParams: Promise<SessionHistorySearchParamsInput>");
    expect(pageSource).toContain("await Promise.all");
    expect(pageSource).toContain("searchParams={resolvedSearchParams}");
  });

  it("sanitises incoming bookmarks after loading the user's available filters", () => {
    for (const source of [workbenchPageSource, companionPageSource]) {
      expect(source).toContain("resolveSessionHistorySearchParams(searchParams");
      expect(source).toContain("if (resolved.changed)");
      expect(source).toContain("redirect(sessionHistoryHref(resolved.query))");
    }
  });

  it("uses shallow browser history so filtering is bookmarkable and Back restores it", () => {
    expect(urlStateSource).toContain("useSearchParams");
    expect(urlStateSource).toContain("window.history.pushState");
    expect(urlStateSource).toContain("buildSessionHistoryQuery");
    expect(urlStateSource).toContain("clearSessionHistoryQuery");
    expect(timelineSource).toContain("useSessionHistoryUrlState");
    expect(companionListSource).toContain("useSessionHistoryUrlState");
  });

  it("keeps row inspection and comparison selection as separate native controls", () => {
    expect(timelineSource).toContain("data-session-inspect");
    expect(timelineSource).toContain("<Checkbox");
    expect(timelineSource).not.toContain('role="button"');
    expect(timelineSource).not.toContain("onKeyDown=");
  });

  it("shares one focus-within-filtered-history contract across both surfaces", () => {
    for (const source of [timelineSource, companionListSource]) {
      expect(source).toContain("deriveSessionHistoryView(sessions, filters)");
    }
    expect(companionListSource).toContain('label="Focus"');
    expect(companionListSource).toContain("Highlight one session without hiding the rest");
  });

  it("exposes each filter-sheet option's selected state to assistive technology", () => {
    expect(filterSheetSource).toContain("aria-pressed={option.value === value}");
  });

  it("prunes comparison state against every URL-derived visible-session change", () => {
    expect(timelineSource).toContain("comparisonState.visibilityKey !== visibilityKey");
    expect(timelineSource).toContain(
      "visibleSelected = pruneSessionComparisonSelection(visibleSelected, visibleSessionIds)",
    );
    expect(timelineSource).toContain("visibleExitSnapshot");
    expect(timelineSource).toContain("comparisonTrayIds.length === 2");
  });
});
