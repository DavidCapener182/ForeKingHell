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
