import { expect, it, vi } from "vitest";
import { canonicalRouteHref } from "./canonical-route-query";
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(url);
  },
}));
import RecordAlias from "@/app/(app)/courses/[courseId]/records/[recordId]/page";
it("retains repeated source query while canonical required context wins", () => {
  expect(
    canonicalRouteHref(
      "/tournaments",
      {
        courseId: ["wrong", "also-wrong"],
        filter: ["open", "mine"],
        q: "7 iron",
        empty: undefined,
      },
      { courseId: "actual" },
    ),
  ).toBe("/tournaments?courseId=actual&filter=open&filter=mine&q=7+iron");
});
it("keeps exact record identity and query through its server alias", async () => {
  await expect(
    RecordAlias({
      params: Promise.resolve({ recordId: "record/id" }),
      searchParams: Promise.resolve({ attempt: "receipt", filter: ["a", "b"] }),
    }),
  ).rejects.toThrow("/course-records/record%2Fid?attempt=receipt&filter=a&filter=b");
});

import CourseAlias from "@/app/(app)/courses/[courseId]/tournaments/page";
it("forces the course identity while preserving tournament filters", async () => {
  await expect(
    CourseAlias({
      params: Promise.resolve({ courseId: "actual course" }),
      searchParams: Promise.resolve({ courseId: "wrong", tab: "active", q: "Open" }),
    }),
  ).rejects.toThrow("/tournaments?courseId=actual+course&tab=active&q=Open");
});

import StandingsAlias from "@/app/(app)/tournaments/[tournamentId]/leaderboard/page";
it("standings alias forces board and retains other filters", async () => {
  await expect(
    StandingsAlias({
      params: Promise.resolve({ tournamentId: "event/id" }),
      searchParams: Promise.resolve({ tab: "wrong", filter: ["a", "b"] }),
    }),
  ).rejects.toThrow("/tournaments/event%2Fid?tab=board&filter=a&filter=b");
});

import RoundsAlias from "@/app/(app)/tournaments/[tournamentId]/rounds/page";
it("rounds alias keeps its documented submit destination", async () => {
  await expect(
    RoundsAlias({
      params: Promise.resolve({ tournamentId: "event" }),
      searchParams: Promise.resolve({ tab: "board", round: "2" }),
    }),
  ).rejects.toThrow("/tournaments/event?tab=submit&round=2");
});

import RulesAlias from "@/app/(app)/tournaments/[tournamentId]/rules/page";
it("rules alias keeps selected event and query", async () => {
  await expect(
    RulesAlias({
      params: Promise.resolve({ tournamentId: "event" }),
      searchParams: Promise.resolve({ tab: "board", round: "2" }),
    }),
  ).rejects.toThrow("/tournaments/event?tab=rules&round=2");
});

import SubmitAlias from "@/app/(app)/tournaments/[tournamentId]/submit/page";
it("submit alias retains source round while selecting submit", async () => {
  await expect(
    SubmitAlias({
      params: Promise.resolve({ tournamentId: "event" }),
      searchParams: Promise.resolve({ tab: "board", sessionId: "owned-round" }),
    }),
  ).rejects.toThrow("/tournaments/event?tab=submit&sessionId=owned-round");
});
