import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/rounds/new/new-round-form.tsx"), "utf8");

describe("new round scorecard entry grid", () => {
  it("keeps desktop hole entry as a keyboard-friendly row grid", () => {
    expect(source).toContain("id={scorecardGridId}");
    expect(source).toContain("data-scorecard-entry-grid");
    expect(source).toContain('aria-label="Keyboard-friendly scorecard hole entry grid"');
    expect(source).toContain("<fieldset");
    expect(source).toContain("<legend");
    expect(source).toContain(
      "sm:grid-cols-[minmax(9rem,1.4fr)_repeat(5,minmax(4.25rem,0.7fr))_repeat(2,minmax(5rem,0.75fr))]",
    );
  });

  it("keeps numeric fields keyboard and mobile keypad friendly", () => {
    expect(source).toContain('type="number"');
    expect(source).toContain('inputMode="numeric"');
    expect(source).toContain('autoComplete="off"');

    for (const field of [
      "score",
      "putts",
      "penalties",
      "chipShots",
      "greensideSandShots",
      "fairwayHit",
      "gir",
    ]) {
      expect(source).toContain(field);
    }
  });

  it("requires a complete scorecard for a completed round and keeps phone controls tappable", () => {
    expect(source).toContain("completedScoreCount");
    expect(source).toContain("missingScoreCount");
    expect(source).toContain("completeRoundNeedsScores");
    expect(source).toContain("id={reviewCompletenessId}");
    expect(source).toContain('role={completeRoundNeedsScores ? "alert" : "status"}');
    expect(source).toContain("disabled={completeRoundNeedsScores}");
    expect(source).toContain('required={roundStatus === "complete"}');
    expect(source).toContain("change the round status to In progress");
    expect(source).toContain("h-11 rounded-xl");
    expect(source).toContain("min-h-11 min-w-11");
  });

  it("uses shadcn toggle groups for mobile steps and hole selection", () => {
    expect(source).toContain('from "@/components/ui/toggle-group"');
    expect(source).toContain("data-round-stepper");
    expect(source).toContain("data-round-hole-tabs");
    expect(source).toContain("value={String(activeHoleIndex)}");
    expect(source).toContain("setActiveHoleIndex(Number(value))");
    expect(source).toContain('aria-current={item.id === step ? "step" : undefined}');
    expect(source).toContain("aria-label={`Go to hole ${hole.holeNumber}`}");
    expect(source).not.toContain("<button");
  });

  it("keeps completeness feedback and visible controls semantic across themes", () => {
    expect(source).toContain('from "@/components/ui/alert"');
    expect(source).toContain("data-round-completeness");
    expect(source).toContain("<AlertTitle>");
    expect(source).toContain("<AlertDescription>");
    expect(source).toContain("var(--status-warning-surface)");
    expect(source).toContain("var(--status-warning-border)");
    expect(source).toContain("var(--status-warning-foreground)");
    expect(source).toContain("var(--status-success-surface)");
    expect(source).toContain("var(--status-success-border)");
    expect(source).toContain("var(--status-success-foreground)");
    expect(source).not.toMatch(
      /(?:bg-white|bg-\[#|text-slate-|border-slate-|bg-slate-|text-emerald-|border-emerald-|bg-emerald-|text-amber-|border-amber-|bg-amber-)/,
    );
  });

  it("preserves the server action payload and scorecard field names", () => {
    expect(source).toContain("action={createRoundAction}");
    expect(source).toContain('<input type="hidden" name="holeCount"');

    for (const hiddenField of ["holeNumber", "par", "yards", "strokeIndex"]) {
      expect(source).toContain(`<input type="hidden" name={\`${hiddenField}-\${index}\`}`);
    }

    expect(source).toContain("name={`score-${index}`}");
    expect(source).toContain("name={`putts-${index}`}");
    expect(source).toContain("name={`penalties-${index}`}");
    expect(source).toContain("name={`chipShots-${index}`}");
    expect(source).toContain("name={`greensideSandShots-${index}`}");
    expect(source).toContain("name={`fairwayHit-${index}`}");
    expect(source).toContain("name={`gir-${index}`}");
  });
});
