import { describe, expect, it } from "vitest";
import { selectTodayActivity, type TodayActivity } from "@/lib/today-activity";

const now = new Date("2026-09-05T12:00:00Z");
const event = (id: string, kind: TodayActivity["kind"], minute: number): TodayActivity => ({
  id,
  kind,
  title: id,
  detail: kind,
  href: "/today",
  date: new Date(now.getTime() - minute * 60_000),
});

describe("Today mixed activity", () => {
  it("orders real events chronologically without mutating the input", () => {
    const items = [
      event("round", "round", 20),
      event("goal", "goal", 0),
      event("practice", "practice", 10),
    ];
    expect(selectTodayActivity(items, now).map((item) => item.id)).toEqual([
      "goal",
      "practice",
      "round",
    ]);
    expect(items[0]?.id).toBe("round");
  });
  it("does not let a retrospective badge batch take over the briefing", () => {
    const items = [
      event("pb", "personal-best", 0),
      ...Array.from({ length: 8 }, (_, n) => event(`badge-${n}`, "achievement", n + 1)),
      event("round", "round", 10),
      event("import", "import", 11),
      event("goal", "goal", 12),
      event("practice", "practice", 13),
    ];
    expect(selectTodayActivity(items, now).map((item) => item.id)).toEqual([
      "pb",
      "badge-0",
      "round",
      "import",
      "goal",
      "practice",
    ]);
  });
  it("drops duplicates, future events and invalid timestamps", () => {
    const item = event("same", "practice", 1);
    expect(
      selectTodayActivity(
        [item, item, event("future", "round", -1), { ...item, id: "bad", date: new Date("bad") }],
        now,
      ),
    ).toEqual([item]);
    expect(selectTodayActivity([], now)).toEqual([]);
  });
});
