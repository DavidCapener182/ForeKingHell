import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({
  redirect: (href: string) => {
    throw new Error(href);
  },
}));
import Route from "@/app/(app)/courses/[courseId]/tournaments/page";
describe("course tournament alias route", () => {
  it("retains filters and forces the requested course in the canonical workspace", async () => {
    await expect(
      Route({
        params: Promise.resolve({ courseId: "course id" }),
        searchParams: Promise.resolve({
          courseId: "wrong",
          q: "club event",
          filter: ["open", "mine"],
        }),
      }),
    ).rejects.toThrow("/tournaments?courseId=course+id&q=club+event&filter=open&filter=mine");
    const source = readFileSync(
      join(process.cwd(), "src/app/(app)/courses/[courseId]/tournaments/page.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/PageShell|DesktopWorkbenchLayout/);
  });
});
