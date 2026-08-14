import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/coach/workspace/page.tsx"), "utf8");

function functionBlock(name: string, nextName: string) {
  const start = source.indexOf(`function ${name}`);
  const end = source.indexOf(`function ${nextName}`, start + 1);

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("coach player workspace shadcn composition", () => {
  it("uses Card and Item for the roster, evidence and interaction form shells", () => {
    expect(source).toContain('from "@/components/ui/card"');
    expect(source).toContain('from "@/components/ui/item"');
    expect(source).toContain("data-assigned-player-card");
    expect(source).toContain("data-player-evidence-card");
    expect(source).toContain("data-coach-interaction-form-card");
    expect(source).toContain('<Item key={session.id} variant="outline"');
    expect(source).toContain('<Item variant="muted"');

    for (const retiredShell of [
      'className="rounded-2xl border bg-card',
      'className="rounded-xl border bg-background',
      '<p className="rounded-xl border border-dashed',
      "function EvidenceCell",
    ]) {
      expect(source).not.toContain(retiredShell);
    }
  });

  it("flattens the four summary cards into one connected Card", () => {
    const marker = source.indexOf("data-player-summary-card");
    const start = source.lastIndexOf("<Card", marker);
    const end = source.indexOf("</Card>", marker) + "</Card>".length;
    const summary = source.slice(start, end);

    expect(marker).toBeGreaterThanOrEqual(0);
    expect(summary.match(/<Card\b/g)).toHaveLength(1);
    expect(summary.match(/<SummaryMetric\b/g)).toHaveLength(4);
    expect(summary).toContain("gap-px bg-border");
    expect(summary).not.toContain("<Item");
    expect(source).not.toContain("SummaryCard");
  });

  it("uses the shared timeline and empty-state compositions without bespoke history cards", () => {
    const timeline = functionBlock("InteractionTimeline", "interactionAction");

    expect(source).toContain('from "@/components/app/status-timeline"');
    expect(source).toContain('from "@/components/app/app-empty-state"');
    expect(timeline).toContain("data-interaction-timeline");
    expect(timeline).toContain("<StatusTimeline");
    expect(timeline).toContain("<AppEmptyState");
    expect(timeline).not.toContain("<article");
    expect(timeline).not.toContain("<StatusPill");
    expect(source).not.toContain('role="status"');
  });

  it("preserves player selection, evidence references and every interaction action", () => {
    expect(source).toContain("href={`/coach/workspace?playerId=${player.id}`}");
    expect(source).toContain("createCoachInteractionAction");
    expect(source).toContain("updateCoachInteractionStatusAction");
    expect(source).toContain("completePlayerInteractionAction");

    for (const field of [
      "playerUserId",
      "interactionType",
      "title",
      "body",
      "dueAt",
      "goalReference",
      "sessionId",
      "practicePlanId",
    ]) {
      expect(source).toContain(`name="${field}"`);
    }

    expect(source).toContain("interactionNeedsAction(item.interactionType, item.status)");
    expect(source).toContain("Session evidence linked");
    expect(source).toContain("Practice plan linked");
    expect(source).toContain("Goal linked");
  });

  it("keeps ordinary workspace chrome on semantic theme tokens", () => {
    expect(source).toContain("bg-card");
    expect(source).toContain("bg-border");
    expect(source).toContain("text-foreground");
    expect(source).toContain("border-primary/40");
    expect(source).not.toMatch(
      /\b(?:bg|border|text)-(?:white|slate|emerald|amber|rose|sky)-(?:\d{2,3})(?:\/\d+)?\b/,
    );
    expect(source).not.toMatch(/(?:bg|border|text|shadow)-\[(?:#|rgba?\()/i);
  });
});
