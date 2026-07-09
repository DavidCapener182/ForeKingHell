import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/courses/[courseId]/records/[recordId]/page.tsx"),
  "utf8",
);

describe("course record alias route", () => {
  it("redirects record deep links to the shared desktop record detail page", () => {
    expect(source).toContain('import { redirect } from "next/navigation";');
    expect(source).toContain("const { recordId } = await params;");
    expect(source).toContain("redirect(`/course-records/${recordId}`)");
    expect(source).not.toContain("PageShell");
    expect(source).not.toContain("DesktopWorkbenchLayout");
  });
});
