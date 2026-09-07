import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(join(process.cwd(), "src/app/(app)/goals/page.tsx"), "utf8");
const forms = readFileSync(join(process.cwd(), "src/app/goals/goal-form-panels.tsx"), "utf8");
const actions = readFileSync(join(process.cwd(), "src/app/goals/actions.ts"), "utf8");

describe("goals shadcn workbench", () => {
  it("renders one responsive goal tree instead of CSS-hidden siblings", () => {
    expect(page).toContain("data-goals-ui");
    expect(page).toContain("<PageShell>");
    expect(page).not.toMatch(/(?:^|\s)(?:lg:hidden|hidden lg:)/);
  });

  it("uses focused outcome and target cards with connected progress metrics", () => {
    expect(page).toContain("data-season-outcome-card");
    expect(page).toContain("data-goal-target-card");
    expect(page).toContain("<ConnectedMetricBar");
    expect(page).toContain("<Progress");
    expect(page).toContain("<AppEmptyState");
    expect(page).toContain("Saved values and verified evidence remain distinct");
    expect(page).toContain("goalProgress(goal)");
    expect(page).not.toContain("text-emerald-");
    expect(page).not.toContain("text-amber-");
  });

  it("moves create, edit and delete into the required guarded surfaces", () => {
    expect(forms).toContain("<Dialog");
    expect(forms).toContain("<Sheet");
    expect(forms).toContain("<AlertDialog");
  });

  it("keeps failed saves in the draft and announces actionable errors", () => {
    expect(actions).toContain('failGoal("goal_type")');
    expect(actions).toContain('failGoal("goal_not_found")');
    expect(actions).toContain("return { ok: false, code: error.code, error: error.message }");
    expect(forms).toContain("action={addGoalWithStateAction}");
    expect(forms).toContain("action={updateGoalWithStateAction}");
    expect(forms).toContain("<DraftForm");
    const draft = readFileSync(
      join(process.cwd(), "src/components/untitled-ui/draft-form.tsx"),
      "utf8",
    );
    expect(draft).toContain("if (result.ok)");
    expect(draft).toContain("else setError(result.error)");
    expect(draft).toContain('role="alert"');
  });
});
