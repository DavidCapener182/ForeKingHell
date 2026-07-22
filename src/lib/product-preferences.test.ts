import { describe, expect, it } from "vitest";

import {
  defaultNotificationPreferences,
  defaultSeasonPlan,
  parseProductPreferences,
} from "@/lib/product-preferences";

describe("product preferences", () => {
  it("uses safe defaults for missing settings", () => {
    expect(parseProductPreferences(null)).toEqual({
      seasonPlan: defaultSeasonPlan,
      goals: [],
      notifications: defaultNotificationPreferences,
    });
  });

  it("normalises persisted season and notification values", () => {
    expect(
      parseProductPreferences({
        seasonPlan: {
          outcome: "  Break 80 consistently  ",
          targetDate: "2026-10-01",
          focus: "Approach play",
          weeklySessions: 12,
          successMeasure: "Three rounds below 82",
        },
        notifications: { social: false, dataQuality: false },
        goals: [
          {
            id: "carry-1",
            type: "carry",
            title: "Driver carry 250",
            startingValue: 235,
            currentValue: 241,
            targetValue: 250,
            targetDate: "2026-10-01",
          },
        ],
      }),
    ).toMatchObject({
      seasonPlan: {
        outcome: "Break 80 consistently",
        targetDate: "2026-10-01",
        weeklySessions: 7,
      },
      notifications: { social: false, dataQuality: false, challenges: true },
      goals: [
        expect.objectContaining({
          id: "carry-1",
          type: "carry",
          startingValue: 235,
          currentValue: 241,
          targetValue: 250,
        }),
      ],
    });
  });

  it("normalises notification delivery modes and rejects unknown goal types", () => {
    const parsed = parseProductPreferences({
      goals: [{ type: "unknown" }],
      notifications: { delivery: { dataQuality: "off", security: "never" } },
    });

    expect(parsed.goals).toEqual([]);
    expect(parsed.notifications.delivery.dataQuality).toBe("off");
    expect(parsed.notifications.delivery.security).toBe("immediate");
  });
});
