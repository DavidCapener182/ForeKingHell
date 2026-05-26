import { describe, expect, it } from "vitest";

import { buildProfileHonoursRecords, type ProfileHonoursRecordRow } from "@/lib/profile-honours";

describe("buildProfileHonoursRecords", () => {
  it("dedupes repeated course/category honours before the profile board renders", () => {
    const rows: ProfileHonoursRecordRow[] = Array.from({ length: 6 }, (_, index) => ({
      result: {
        id: `result-${index}`,
        rank: 1,
        scoreLabel: "233 yd",
      },
      record: {
        id: `record-${index}`,
        recordType: "longest_drive",
      },
      category: {
        name: "Longest drive",
      },
      course: {
        name: index % 2 === 0 ? "Aintree Golf Centre" : "Aintree  Golf Centre",
      },
    }));

    expect(buildProfileHonoursRecords(rows)).toEqual([
      {
        id: "result-0",
        recordId: "record-0",
        courseName: "Aintree Golf Centre",
        categoryName: "Longest drive",
        scoreLabel: "233 yd",
        rank: 1,
      },
    ]);
  });

  it("keeps different record categories for the same course", () => {
    const rows: ProfileHonoursRecordRow[] = [
      row("drive", "longest_drive", "Longest drive", "233 yd"),
      row("gross", "best_gross_score", "Best gross score", "78 strokes"),
    ];

    expect(buildProfileHonoursRecords(rows).map((record) => record.categoryName)).toEqual([
      "Longest drive",
      "Best gross score",
    ]);
  });
});

function row(
  id: string,
  recordType: string,
  categoryName: string,
  scoreLabel: string,
): ProfileHonoursRecordRow {
  return {
    result: {
      id: `result-${id}`,
      rank: 1,
      scoreLabel,
    },
    record: {
      id: `record-${id}`,
      recordType,
    },
    category: {
      name: categoryName,
    },
    course: {
      name: "Aintree Golf Centre",
    },
  };
}
