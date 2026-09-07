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
