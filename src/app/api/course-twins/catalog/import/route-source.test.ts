import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/app/api/course-twins/catalog/import/route.ts"),
  "utf8",
);

describe("Course Twin catalogue import boundary", () => {
  it("is admin-only, bounded, rate-limited and queues validated imports", () => {
    expect(source).toContain("requireApiAdmin");
    expect(source).toContain('return Response.json({ message: "Not found." }, { status: 404 })');
    expect(source).toContain('keyPrefix: "course-twin-catalog-import"');
    expect(source).toContain("readBoundedJsonBody(request, 256 * 1024)");
    expect(source).toContain("importCourseTwinCatalog");
    expect(source).toContain("status: 202");
    expect(source).toContain('headers: { "Cache-Control": "private, no-store" }');
  });
});
