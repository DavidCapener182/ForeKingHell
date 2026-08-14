import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/challenges/page.tsx"), "utf8");
const gridSectionSource = readFileSync(
  join(process.cwd(), "src/app/challenges/challenge-grid-section.tsx"),
  "utf8",
);

describe("challenges desktop board", () => {
  it("selects one request surface before loading the desktop workbench", () => {
    const staticWorkbenchImport =
      source.match(
        /import(?: type)? \{[^}]*\} from "@\/components\/app\/desktop-workbench";/,
      )?.[0] ?? "";

    expect(source).toContain("getRequestAppSurface()");
    expect(source).toContain(
      'surface === "workbench" ? await import("@/components/app/desktop-workbench") : null',
    );
    expect(source).toContain('surface === "companion" ? (');
    expect(source).toContain('surface === "workbench" && DesktopWorkbenchLayout ? (');
    expect(staticWorkbenchImport).not.toContain("DesktopWorkbenchLayout");
    expect(staticWorkbenchImport).not.toContain("DesktopTableWorkbenchControls");
    expect(source).not.toContain('className="hidden lg:contents"');
    expect(source).not.toContain('<DesktopWorkbenchLayout scope="challenges" className="hidden');
  });

  it("uses semantic tokens outside the deliberate illustrated mobile feature card", () => {
    const ordinarySource = source.replace(
      /function MobilePremiumChallengeCard[\s\S]*?(?=function challengeImageSrc)/,
      "",
    );
    const featureCard =
      source.match(
        /function MobilePremiumChallengeCard[\s\S]*?(?=function challengeImageSrc)/,
      )?.[0] ?? "";

    expect(ordinarySource).toContain("bg-muted");
    expect(ordinarySource).toContain("bg-card");
    expect(ordinarySource).not.toMatch(
      /bg-white|bg-\[#|text-\[#|border-\[#|(?:bg|text|border)-(?:slate|green|emerald|amber|rose|sky)-\d+/,
    );
    expect(featureCard).toContain("challengeImageSrc");
    expect(featureCard).toContain("bg-emerald-950");
    expect(featureCard).toContain("bg-white/12");
  });

  it("uses the challenges artwork variant in the desktop competition header", () => {
    expect(source).toContain('variant="challenges"');
    expect(source).toMatch(/visual=\{\s*<PageArtwork/);
    expect(source).toContain("min-h-36");
  });

  it("keeps live, joined, templates and past boards table-first on desktop", () => {
    expect(source).toContain("<PageShell>");
    expect(source).not.toContain('<PageShell size="7xl"');
    expect(source).toContain("ChallengeBoardTable");
    expect(source).toContain("ChallengeBoardFilterTabs");
    expect(source).toContain('aria-label="Challenge board views"');
    expect(source).toContain("<ButtonGroup");
    expect(source).toContain('aria-current={active ? "page" : undefined}');
    expect(source).not.toContain("<TabsTrigger");
    expect(source).toContain("buildChallengeBoardRows");
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('data-workbench-scope="challenge-board"');
    expect(source).toContain('exportTableId="challenge-board"');
    expect(source).toContain('data-workbench-export-table="challenge-board"');
    expect(source).toContain('mainTableLabel="Challenge board table"');
    expect(source).toContain('mainTableLabel="Challenge board table" stickyFirstColumn');
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");
    expect(source).toContain('href: "/challenges?tab=templates"');
    expect(source).toContain('href: "/challenges?tab=past"');

    for (const column of [
      "board",
      "status",
      "visibility",
      "template",
      "window",
      "players",
      "leader",
      "proof",
      "action",
    ]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });

  it("keeps challenge Cards out of outer DataPanel Card shells", () => {
    expect(source.match(/<ChallengeGridSection/g)).toHaveLength(3);
    expect(source).toContain('title="My active entries"');
    expect(source).toContain('title="Friends competing"');
    expect(source).toContain('title="Public and friend boards"');
    expect(gridSectionSource).toContain("data-challenge-grid-section");
    expect(source.match(/<ChallengeGrid\b/g)).toHaveLength(3);
    expect(gridSectionSource).not.toMatch(/<DataPanel(?:\s|>)/);
    expect(gridSectionSource).not.toMatch(/<Card(?:\s|>)/);
    expect(gridSectionSource).not.toContain("<CardContent");
    expect(source).toContain("data-challenge-card");
  });
});

describe("challenges mobile board", () => {
  it("renders every mobile tab from the same filtered board rows as desktop", () => {
    expect(source).toContain("const mobileChallenges = challengeBoardRows.flatMap");
    expect(source).toContain("const mobileTemplates = challengeBoardRows.flatMap");
    expect(source).toContain("const mobilePrimaryChallenge = mobileChallenges[0] ?? null;");
    expect(source).toContain("const mobileRemainingChallenges = mobileChallenges.slice(1);");
    expect(source).toContain("mobileRemainingChallenges.map");
    expect(source).not.toMatch(/activeTab === "joined" \? data\.mine : data\.challenges/);
  });

  it("keeps the mobile composition active until the lg desktop breakpoint", () => {
    expect(source).not.toContain('className="hidden lg:contents"');
    expect(source).not.toContain('className="hidden sm:contents"');
  });
});
