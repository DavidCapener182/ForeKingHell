import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(join(process.cwd(), "src/app/(app)/goals/page.tsx"), "utf8");
const forms = readFileSync(join(process.cwd(), "src/app/goals/goal-form-panels.tsx"), "utf8");
const actions = readFileSync(join(process.cwd(), "src/app/goals/actions.ts"), "utf8");

describe("goals shadcn workbench", () => {
  it("renders one request-surface goal tree instead of CSS-hidden siblings", () => {
    expect(page).toContain("getRequestAppSurface()");
    expect(page).toContain('surface === "companion"');
    expect(page).toContain("data-goals-companion");
    expect(page).toContain("data-goals-workbench");
    expect(page).not.toMatch(/(?:^|\s)(?:lg:hidden|hidden lg:)/);
  });

  it("uses focused outcome and target cards with connected progress metrics", () => {
    expect(page).toContain("data-season-outcome-card");
    expect(page).toContain("data-goal-target-card");
    expect(page).toContain("<ConnectedMetricBar");
    expect(page).toContain("<Progress");
    expect(page).toContain("<AppEmptyState");
    expect(page).toContain("var(--status-success-foreground)");
    expect(page).toContain("var(--status-warning-foreground)");
    expect(page).not.toContain("text-emerald-");
    expect(page).not.toContain("text-amber-");
  });

  it("moves create, edit and delete into the required guarded surfaces", () => {
    expect(forms).toContain("<Dialog");
    expect(forms).toContain("<Sheet");
    expect(forms).toContain("<AlertDialog");
  });

  it("renders action redirect failures as a semantic shadcn alert", () => {
    expect(actions).toContain('redirect("/goals?error=goal_type")');
    expect(actions).toContain('redirect("/goals?error=goal_not_found")');
    expect(page).toContain("goalErrorMessage(params?.error)");
    expect(page).toContain('error === "goal_type"');
    expect(page).toContain('error === "goal_not_found"');
    expect(page).toContain('<Alert variant="destructive">');
    expect(page).toContain("<AlertTitle>Goal not saved</AlertTitle>");
    expect(page).toContain("<AlertDescription>{goalError}</AlertDescription>");
    expect(page).not.toContain('role="alert"');
  });
});
