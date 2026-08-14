import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  AchievementCard,
  AchievementUnlockCalendar,
  TrophyTierFilter,
} from "@/app/achievements/achievements-client";
import { Card, CardContent } from "@/components/ui/card";
import type { AchievementView } from "@/lib/achievements/service";

describe("achievements runtime Card composition", () => {
  it("renders the trophy filter inside one cabinet Card without another Card shell", () => {
    const markup = renderToStaticMarkup(
      <Card>
        <CardContent>
          <TrophyTierFilter
            value="all"
            onValueChange={vi.fn()}
            tiers={[
              { id: "gold", label: "Gold", total: 12, unlocked: 4, completion: 33 },
              { id: "silver", label: "Silver", total: 18, unlocked: 9, completion: 50 },
            ]}
          />
        </CardContent>
      </Card>,
    );

    expect(markup.match(/data-slot="card"/g)).toHaveLength(1);
    expect(markup).toContain("data-trophy-tier-section");
    expect(markup).toContain("data-trophy-tier-filter");
  });

  it("renders one calendar Card with two flat semantic panels", () => {
    const markup = renderToStaticMarkup(
      <AchievementUnlockCalendar
        calendar={{ byDay: new Map(), latestDay: null }}
        monthKey="2026-08"
        selectedDay={null}
        onMonthChange={vi.fn()}
        onSelectedDayChange={vi.fn()}
      />,
    );

    expect(markup.match(/data-slot="card"/g)).toHaveLength(1);
    expect(markup).toContain("data-achievement-calendar-month");
    expect(markup).toContain("data-achievement-calendar-detail");
  });

  it("renders a catalogue result as an Item without nesting another Card", () => {
    const achievement = {
      id: "catalogue-achievement",
      displayName: "Fairway finder",
      displayDescription: "Keep a measured driver pattern in play.",
      tier: "gold",
      unlocked: true,
      hidden: false,
      xpAwarded: 125,
      xp: 125,
      progressPercent: 100,
      progressLabel: "Unlocked",
      category: "accuracy",
    } as AchievementView;
    const markup = renderToStaticMarkup(
      <Card data-achievement-catalogue-shell>
        <CardContent>
          <AchievementCard achievement={achievement} focused />
        </CardContent>
      </Card>,
    );

    expect(markup.match(/data-slot="card"/g)).toHaveLength(1);
    expect(markup).toContain('data-slot="dialog-trigger"');
    expect(markup).toContain("data-achievement-catalogue-item");
    expect(markup).toContain("--status-success-surface");
    expect(markup).not.toMatch(/(?:bg|border|text|ring)-(?:emerald|green|slate)-/);
  });
});
