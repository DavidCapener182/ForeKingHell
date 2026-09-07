import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({
  redirect: (href: string) => {
    throw new Error(href);
  },
}));
import Route from "@/app/(app)/courses/[courseId]/records/[recordId]/page";
describe("course record alias route", () => {
  it("keeps encoded record identity and repeated query on both surfaces", async () => {
    await expect(
      Route({
        params: Promise.resolve({ recordId: "record/id" }),
        searchParams: Promise.resolve({ attempt: "receipt", filter: ["a", "b"] }),
      }),
    ).rejects.toThrow("/course-records/record%2Fid?attempt=receipt&filter=a&filter=b");
    const source = readFileSync(
      join(process.cwd(), "src/app/(app)/courses/[courseId]/records/[recordId]/page.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/PageShell|DesktopWorkbenchLayout/);
  });
});
