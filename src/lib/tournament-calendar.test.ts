import { describe, expect, it } from "vitest";

import {
  dailyTournamentCourseCount,
  dailyTournamentCourses,
  getScheduledTournamentSet,
  monthlyMajorCourses,
  weeklyOpenCourses,
} from "@/lib/tournament-calendar";

describe("scheduled tournament calendar", () => {
  it("uses a curated tour-venue rotation instead of filler or hard-to-find courses", () => {
    const dailyNames = dailyTournamentCourses.map((course) => course.name);

    expect(dailyTournamentCourseCount).toBe(dailyTournamentCourses.length);
    expect(dailyNames).not.toContain("Teeth of the Dog");
    expect(dailyNames.some((name) => name.includes("World Tour"))).toBe(false);
    expect(new Set(dailyNames).size).toBe(dailyNames.length);
  });

  it("keeps scheduled events on the curated course list", () => {
    const curatedNames = new Set(dailyTournamentCourses.map((course) => course.name));

    for (const course of [...weeklyOpenCourses, ...monthlyMajorCourses]) {
      expect(curatedNames.has(course.name)).toBe(true);
    }

    const scheduled = getScheduledTournamentSet(new Date("2026-05-16T12:00:00.000Z"));
    const daily = scheduled.find((event) => event.kind === "daily");

    expect(daily?.course.name).not.toBe("Teeth of the Dog");
    expect(curatedNames.has(daily?.course.name ?? "")).toBe(true);
  });
});
