import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/app/api/cron/course-twin-catalog/route.ts"),
  "utf8",
);

describe("Course Twin catalogue worker boundary", () => {
  it("supports Vercel GET cron and manual POST while requiring the cron secret", () => {
    expect(source).toContain("export async function GET");
    expect(source).toContain("export async function POST");
    expect(source).toContain('request.headers.get("authorization")');
    expect(source).toContain("processNextCourseTwinCatalogJob");
    expect(source).toContain('"Cache-Control": "private, no-store"');
  });
});
