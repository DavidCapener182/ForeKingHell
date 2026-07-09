import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/courses/[courseId]/tournaments/page.tsx"),
  "utf8",
);

describe("course tournament alias route", () => {
  it("redirects course tournament links to the filterable tournament workbench", () => {
    expect(source).toContain('import { redirect } from "next/navigation";');
    expect(source).toContain("const { courseId } = await params;");
    expect(source).toContain("redirect(`/tournaments?courseId=${encodeURIComponent(courseId)}`)");
    expect(source).not.toContain("PageShell");
    expect(source).not.toContain("DesktopWorkbenchLayout");
  });
});
