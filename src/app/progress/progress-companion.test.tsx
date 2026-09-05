import { writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MobileProgressGoals } from "./progress-companion";
import type { SeasonGoal } from "@/lib/product-preferences-model";

// Isolated acceptance fixtures only: never saved to the app or an account.
const goal: SeasonGoal = {
  id: "qa-control",
  type: "dispersion",
  title: "Tighter driver control",
  club: "driver",
  startingValue: 30,
  currentValue: 20,
  targetValue: 10,
  unit: "yd",
  targetDate: "2026-11-01",
  evidenceSource: "Saved range-session review",
  nextAction: "Practise a ten-ball start-line set.",
};
const fixtures: SeasonGoal[] = [
  goal,
  {
    ...goal,
    id: "qa-carry",
    type: "carry",
    title: "Build a repeatable 7 iron carry",
    club: "7i",
    startingValue: 140,
    currentValue: 150,
    targetValue: 160,
    targetDate: "",
  },
  {
    ...goal,
    id: "qa-zero",
    type: "course_record",
    title: "Reduce penalty strokes",
    startingValue: 2,
    currentValue: 0,
    targetValue: 0,
    unit: "strokes",
    nextAction: "Keep the safe tee-shot plan.",
  },
];

describe("mobile Progress goal acceptance", () => {
  it("labels current and target separately for increasing, decreasing and zero targets", () => {
    const html = renderToStaticMarkup(<MobileProgressGoals goals={fixtures} />);
    expect(html.match(/50% progress/g)).toHaveLength(2);
    expect(html).toContain("100% progress");
    expect(html.match(/<dt>Current<\/dt>/g)).toHaveLength(3);
    expect(html.match(/<dt>Target<\/dt>/g)).toHaveLength(3);
    expect(html).toContain("<dd>0 <span>strokes</span></dd>");
    expect(html).toContain("1 Nov 2026");
    expect(html).toContain("Not set");
    expect(html).toContain("Saved range-session review");
    expect(html).toContain("They are not automatically verified against a new session.");
    expect(html).toContain('href="/goals"');
    if (process.env.FKH_GOAL_QA_PATH) writeFileSync(process.env.FKH_GOAL_QA_PATH, html);
  });
  it("keeps the overview bounded and provides an honest empty state", () => {
    const html = renderToStaticMarkup(
      <MobileProgressGoals
        goals={Array.from({ length: 5 }, (_, i) => ({
          ...goal,
          id: `qa-${i}`,
          title: `QA goal ${i}`,
        }))}
      />,
    );
    expect(html.match(/<article/g)).toHaveLength(4);
    expect(html).not.toContain("QA goal 4");
    expect(html).toContain("All goals");
    const empty = renderToStaticMarkup(<MobileProgressGoals goals={[]} />);
    expect(empty).toContain("Set your next target");
    expect(empty).not.toContain("<progress");
  });
});
