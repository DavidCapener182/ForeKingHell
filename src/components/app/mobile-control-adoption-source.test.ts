import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("companion local-control adoption", () => {
  it("uses shared in-place controls for the high-frequency companion filters", () => {
    for (const path of [
      "src/components/app/mobile-shot-pattern-charts.tsx",
      "src/app/practice/practice-companion-client.tsx",
      "src/app/quick-bag/quick-bag-client.tsx",
    ]) {
      const source = read(path);
      expect(source).toMatch(/MobileSegmentedControl|MobileFilterChipGroup/);
      expect(source).not.toContain("router.push");
      expect(source).not.toContain("router.replace");
    }
  });

  it("keeps History selection local while fetching full-dataset URL filters", () => {
    const history = read("src/app/sessions/sessions-companion-list.tsx");
    const urlState = read("src/app/sessions/use-session-history-url-state.ts");
    expect(history).toContain("<HistoryToolbar");
    expect(history).toContain("onChange={onFiltersChange}");
    expect(history).toContain("deriveSessionHistoryView(sessions, filters)");
    expect(urlState).toContain("window.history.pushState");
    expect(urlState).toContain("buildSessionHistoryQuery(");
    expect(urlState).toContain('Object.keys(patch).some((key) => key !== "sessionId")');
    expect(urlState).toContain("router.refresh()");
    for (const source of [history, urlState]) {
      expect(source).not.toContain("router.push");
      expect(source).not.toContain("router.replace");
    }
  });

  it("keeps loaded detail sections mounted while directory navigation preserves filters", () => {
    for (const path of [
      "src/app/challenges/challenge-detail-sections.tsx",
      "src/app/tournaments/tournament-detail-sections.tsx",
    ]) {
      expect(read(path)).toContain("keepMounted");
      expect(read(path)).toContain("popstate");
    }
    for (const path of [
      "src/app/leaderboard/mobile-leaderboard.tsx",
      "src/app/(app)/rounds/[sessionId]/page.tsx",
    ])
      expect(read(path)).toContain("MobilePageTabs");
    const challenges = read("src/app/challenges/challenge-workspace.tsx");
    expect(read("src/app/(app)/challenges/page.tsx")).toContain("<ChallengeWorkspace");
    expect(challenges).toContain("<UntitledTabs");
    expect(challenges).toContain('url.searchParams.set("q", q)');
    expect(challenges).toContain("<CreateChallenge templates={templates} freePlan={freePlan} />");
    expect(challenges.indexOf("<CreateChallenge")).toBeLessThan(
      challenges.indexOf("<UntitledTabs"),
    );
    const tournaments = read("src/app/tournaments/tournament-index-controls.tsx");
    expect(read("src/app/(app)/tournaments/page.tsx")).toContain("<TournamentIndexControls");
    expect(tournaments).toContain("new URL(window.location.href)");
    expect(tournaments).toContain('url.searchParams.set("tab", key)');
    expect(tournaments).toContain("key={`${courseId}:${q}:${sort}`}");
    expect(tournaments).toContain("content: key === active ? children : null");
  });
});
