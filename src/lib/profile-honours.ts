import { normalisedCourseName } from "@/lib/course-dedupe";

export type ProfileHonoursRecordRow = {
  result: {
    id: string;
    rank: number | null;
    scoreLabel: string;
  };
  record: {
    id: string;
    recordType: string;
  };
  category: {
    name: string;
  };
  course: {
    name: string;
  };
};

export type ProfileHonoursRecord = {
  id: string;
  recordId: string;
  courseName: string;
  categoryName: string;
  scoreLabel: string;
  rank: number | null;
};

export function buildProfileHonoursRecords(
  rows: ProfileHonoursRecordRow[],
): ProfileHonoursRecord[] {
  const byDisplaySlot = new Map<string, ProfileHonoursRecord>();

  for (const row of rows) {
    const item = {
      id: row.result.id,
      recordId: row.record.id,
      courseName: row.course.name,
      categoryName: row.category.name,
      scoreLabel: row.result.scoreLabel,
      rank: row.result.rank,
    };
    const key = honoursRecordDisplayKey(row);
    const current = byDisplaySlot.get(key);

    if (!current || honoursRecordPreference(item) > honoursRecordPreference(current)) {
      byDisplaySlot.set(key, item);
    }
  }

  return [...byDisplaySlot.values()];
}

function honoursRecordDisplayKey(row: ProfileHonoursRecordRow) {
  return [
    normalisedCourseName(row.course.name),
    row.record.recordType.trim().toLowerCase(),
    row.category.name.trim().toLowerCase(),
  ].join(":");
}

function honoursRecordPreference(record: ProfileHonoursRecord) {
  return record.rank === 1 ? 1 : 0;
}
