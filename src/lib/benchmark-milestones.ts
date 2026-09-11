import { compareClubCarryToBenchmark, type ClubBenchmarkRow } from "./club-benchmarks";

export type BenchmarkMilestone = {
  id: string;
  sessionId: string;
  date: string;
  from: string;
  to: string;
  carryYd: number;
  sampleSize: number;
};

/** Reconstruct promotions from saved evidence; the first snapshot is a baseline. */
export function benchmarkMilestones(
  clubType: string,
  snapshots: { sessionId: string; date: string; carryYd: number; sampleSize: number }[],
): BenchmarkMilestone[] {
  let highest = -1;
  let previousLabel = "Building";
  let established = false;
  const milestones: BenchmarkMilestone[] = [];
  for (const snapshot of [...snapshots].sort(
    (a, b) => a.date.localeCompare(b.date) || a.sessionId.localeCompare(b.sessionId),
  )) {
    const comparison = compareClubCarryToBenchmark(clubType, snapshot.carryYd);
    if (!comparison || snapshot.sampleSize < 1 || !Number.isFinite(snapshot.carryYd)) continue;
    const level = comparison.levelIndex ?? -1;
    if (established && level > highest) {
      milestones.push({
        ...snapshot,
        id: `${snapshot.sessionId}:${comparison.levelKey}`,
        from: previousLabel,
        to: comparison.levelLabel,
      });
    }
    if (!established || level > highest) {
      highest = level;
      previousLabel = comparison.levelLabel;
    }
    established = true;
  }
  return milestones;
}

export function nearestBenchmarkUnlocks(rows: ClubBenchmarkRow[]) {
  return rows
    .filter(
      (row) => row.carryYd !== null && row.sampleSize > 0 && row.comparison.nextLevel !== null,
    )
    .map((row) => {
      const target = row.comparison.nextLevel!;
      const currentLevel = row.comparison.benchmark.levels.find(
        (level) => level.key === row.comparison.levelKey,
      );
      const start = currentLevel?.yards ?? 0;
      const progress = Math.max(
        0,
        Math.min(100, ((row.carryYd! - start) / (target.yards - start)) * 100),
      );
      return { row, target, progress, gap: Math.max(0, target.yards - row.carryYd!) };
    })
    .sort(
      (a, b) =>
        b.progress - a.progress || a.gap - b.gap || a.row.clubId.localeCompare(b.row.clubId),
    );
}
