import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/coach/page.tsx"), "utf8");
const coachChatSource = readFileSync(
  join(process.cwd(), "src/app/coach/coach-chat-card.tsx"),
  "utf8",
);
const coachAiToolsSource = readFileSync(
  join(process.cwd(), "src/app/coach/coach-ai-tools-panel.tsx"),
  "utf8",
);
const lazyCoachAiToolsSource = readFileSync(
  join(process.cwd(), "src/app/coach/lazy-coach-ai-tools-panel.tsx"),
  "utf8",
);

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

  it("keeps the contextual AI coach controls in the shared resizable workbench", () => {
    expect(source).toContain("AiDesktopWorkbench");
    expect(source).toContain("DesktopInsightRail");
    expect(source).toContain('title="AI coach context"');
    expect(source).toContain("coachWorkbenchPrompts");
    expect(source).not.toContain("railBreakpoint=");
    expect(source).not.toContain("rail={");
    expect(source).toContain("diagnosis={");
    expect(source).toContain("evidence={");
    expect(source).toContain("ask={");
    expect(source).toContain("defaultTab={activeWorkbenchTab}");
    expect(source).toContain('href: "/coach?tab=evidence#coach-evidence-ledger"');
    expect(source).toContain("<LazyCoachAiToolsPanel");
    expect(coachAiToolsSource).toContain("<CoachCommandSuggestions");
    expect(source).toMatch(
      /suggestions=\{coachWorkbenchPrompts\.map\(\(\{ label, prompt \}\) => \(\{[\s\S]*?label,[\s\S]*?prompt,[\s\S]*?\}\)\)\}/,
    );
    const aiTools = coachAiToolsSource;
    expect(aiTools).not.toContain("<CoachBentoPanel");
    expect(aiTools).not.toContain("<Collapsible");
    expect(aiTools).toContain("data-coach-ai-tools");
    const answer = coachChatSource.match(/\{response \? \([\s\S]*?\) : null\}/)?.[0] ?? "";
    const citations = answer.match(/<Accordion[\s\S]*?<\/Accordion>/)?.[0] ?? "";
    expect(citations).not.toContain("<Card");
    expect(citations).toContain("bg-muted/30");
    expect(aiTools).not.toContain("rounded-xl border bg-card");
    expect(coachChatSource).not.toContain("<Card");
    const aiCoachSource = readFileSync(
      join(process.cwd(), "src/app/coach/ai-coach-card.tsx"),
      "utf8",
    );
    expect(aiCoachSource).not.toContain("<Card");
  });

  it("defers the inactive Ask-tab client graph behind a real dynamic client boundary", () => {
    expect(source).not.toContain('from "@/app/coach/ai-coach-card"');
    expect(source).not.toContain('from "@/app/coach/coach-chat-card"');
    expect(source).not.toContain('from "@/app/coach/coach-command-suggestions"');
    expect(lazyCoachAiToolsSource).toContain('"use client"');
    expect(lazyCoachAiToolsSource).toContain('import dynamic from "next/dynamic"');
    expect(lazyCoachAiToolsSource).toContain('import("@/app/coach/coach-ai-tools-panel")');
    expect(coachAiToolsSource).toContain("<AiCoachCard");
    expect(coachAiToolsSource).toContain("<CoachChatCard");
    expect(coachAiToolsSource).toContain("<CoachCommandSuggestions");
  });

  it("loads social challenge context only when the coach desk asks for it", () => {
    expect(source).toContain("type CoachSocialContext");
    expect(source).toContain("shouldLoadCoachSocial(first(params.social))");
    expect(source).toContain("socialLoaded ? getChallengesPageData() : Promise.resolve(null)");
    expect(source).toContain("const socialContext: CoachSocialContext");
    expect(source).toContain('id="coach-social-comparison"');
    expect(source).toContain("defaultOpen={socialContext.loaded}");
    expect(source).toContain("<CollapsibleTrigger");
    expect(source).toContain("socialContext={socialContext}");
    expect(source).toContain('loadHref="/coach?tab=evidence&social=1#coach-social-comparison"');
    expect(source).toContain("Social comparison is on demand");
    expect(source).toContain("Load challenge context");
  });

  it("renders the server-authored collapsible trigger directly across the RSC boundary", () => {
    expect(source).toContain('import { Button, buttonVariants } from "@/components/ui/button"');
    expect(source).toMatch(/<CollapsibleTrigger\s+type="button"[\s\S]*?buttonVariants\(\{/);
    expect(source).not.toMatch(/<CollapsibleTrigger\s+asChild>[\s\S]*?<Button/);
  });

  it("replaces the desktop bento wall with one diagnosis, one plan and disclosed evidence", () => {
    expect(source).toContain("CoachDiagnosisHero");
    expect(source).toContain("<ResultHero");
    expect(source).toContain("CoachDiagnosisMetrics");
    expect(source).toContain("<ConnectedMetricBar");
    expect(source).toContain("CoachPracticeRecommendation");
    expect(source).toContain("<CoachSupportingEvidencePanel>");
    expect(source).toContain("<AlertTitle>Some coach evidence is still provisional</AlertTitle>");

    for (const retiredPanel of [
      "CoachPracticeHero",
      "WhatChangedPanel",
      "AthleticDevelopmentCoachCard",
      "PracticeSessionBuilder",
      "RoundReadinessPanel",
      "TodaysPlan",
      "CoachSummaryPanel",
      "RecentSessionFeedback",
      "DiagnosisPreview",
    ]) {
      expect(source).not.toContain(retiredPanel);
    }

    expect(source).not.toContain('gridTemplateColumns: "repeat(12, minmax(0, 1fr))"');
  });

  it("server-branches the companion summary from the desktop AI workbench", () => {
    expect(source).toContain("getRequestAppSurface");
    expect(source).toContain('surface === "companion"');
    expect(source).toContain('surface === "workbench" ? await import');
    expect(source).not.toContain('className="hidden items-center justify-between gap-4 lg:flex"');
    expect(source).not.toContain('className="hidden lg:grid"');
    expect(source).not.toContain(
      'import { AiDesktopWorkbench } from "@/components/app/ai-desktop-workbench"',
    );
  });

  it("shows deterministic recommendation evidence and measurable reassessment criteria", () => {
    expect(source).toContain("MobileCoachRecommendationEvidence");
    expect(source).toContain('label: "Observation"');
    expect(source).toContain('label: "Evidence"');
    expect(source).toContain('label: "Confidence"');
    expect(source).toContain('label: "Why it matters"');
    expect(source).toContain('label: "Suggested drill"');
    expect(source).toContain('label: "Success measure"');
    expect(source).toContain('label: "Reassess when"');
    expect(source).toContain("coachEvidenceConfidence");
    expect(source).not.toContain('label="Expected gain"');
  });

  it("keeps ordinary coach controls and status surfaces on semantic theme tokens", () => {
    expect(source).not.toMatch(
      /text-\[#6B7280\]|text-amber-600|hover:border-emerald-300|ring-slate-200|border-emerald-200|bg-emerald-50|border-amber-200|bg-amber-50/,
    );
    expect(source).toContain("var(--status-success-surface)");
    expect(source).toContain("var(--status-warning-surface)");
    expect(source).toContain("hover:border-primary/40");
    expect(source).toContain("shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]");
    expect(source).not.toContain("rgba(15,23,42,0.08)");
  });
});
