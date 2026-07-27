import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { summarizeVisualQa } from "./visual-qa.mjs";

test("visual QA is complete only when every production package has accepted evidence", () => {
  const packages = Array.from({ length: 20 }, (_, index) => ({
    courseId: `course-${index}`,
    slug: `course-${index}`,
  }));
  const document = {
    schemaVersion: 1,
    reviewer: "Course Twin QA",
    reviewedAt: "2026-07-23T00:00:00.000Z",
    scope: "Browser render inspection",
    courses: packages.map((coursePackage) => ({
      ...coursePackage,
      evidenceFile: `${coursePackage.slug}.png`,
      verdict: "pass_with_grade_b_caveats",
    })),
  };

  assert.deepEqual(summarizeVisualQa({ packages, document }), {
    complete: true,
    reviewer: "Course Twin QA",
    reviewedAt: "2026-07-23T00:00:00.000Z",
    scope: "Browser render inspection",
    approved: 20,
    approvedWithCaveats: 20,
    missing: [],
    rejected: [],
    mismatched: [],
    duplicates: [],
    unexpected: [],
  });

  document.courses[0].verdict = "fail";
  assert.equal(summarizeVisualQa({ packages, document }).complete, false);
});

test("checked-in first-wave visual QA covers every generated package including Aintree", async () => {
  const [report, document] = await Promise.all(
    ["uk-first-wave-packages.json", "uk-first-wave-visual-qa.json"].map(async (fileName) =>
      JSON.parse(await readFile(new URL(`./catalog/${fileName}`, import.meta.url), "utf8")),
    ),
  );
  const summary = summarizeVisualQa({ packages: report.packages, document });

  assert.equal(summary.complete, true);
  assert.equal(summary.approved, report.completed);
  assert.ok(document.courses.some((entry) => entry.slug === "aintree-v1"));
});
