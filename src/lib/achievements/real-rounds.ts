import type {
  Achievement,
  AchievementEvaluationResult,
  AchievementSession,
  RoundScorecardHole,
} from "./types";

type Metric =
  | "holes"
  | "rounds"
  | "score"
  | "birdies"
  | "putts"
  | "noThreePutts"
  | "fairways"
  | "greens"
  | "penaltyFree";
type Rule = {
  id: string;
  name: string;
  description: string;
  metric: Metric;
  target: number;
  tier: Achievement["tier"];
  xp: number;
};
const rules: Rule[] = [
  {
    id: "real_first_nine",
    name: "Out on the Course",
    description: "Complete 9 scored holes in a real round.",
    metric: "holes",
    target: 9,
    tier: "bronze",
    xp: 50,
  },
  {
    id: "real_first_eighteen",
    name: "The Full Eighteen",
    description: "Complete an 18-hole real round.",
    metric: "holes",
    target: 18,
    tier: "silver",
    xp: 100,
  },
  {
    id: "real_five_rounds",
    name: "Course Regular",
    description: "Complete 5 real 18-hole rounds.",
    metric: "rounds",
    target: 5,
    tier: "silver",
    xp: 100,
  },
  {
    id: "real_ten_rounds",
    name: "Ten Cards In",
    description: "Complete 10 real 18-hole rounds.",
    metric: "rounds",
    target: 10,
    tier: "gold",
    xp: 200,
  },
  ...([100, 90, 85, 80] as const).map(
    (target, index): Rule => ({
      id: `real_break_${target}`,
      name: `On Course: Break ${target}`,
      description: `Shoot under ${target} in a real 18-hole round on a par-65-or-higher course.`,
      metric: "score",
      target,
      tier: (["bronze", "silver", "gold", "platinum"] as const)[index],
      xp: [50, 100, 200, 400][index],
    }),
  ),
  {
    id: "real_first_birdie",
    name: "Birdie in the Wild",
    description: "Make a birdie in a completed real round.",
    metric: "birdies",
    target: 1,
    tier: "bronze",
    xp: 50,
  },
  {
    id: "real_three_birdies",
    name: "Birdie Hat-Trick",
    description: "Make 3 birdies in one completed real round.",
    metric: "birdies",
    target: 3,
    tier: "gold",
    xp: 200,
  },
  {
    id: "real_no_three_putts",
    name: "No Three-Putts",
    description: "Finish 18 real holes with every putt count recorded and no three-putts or worse.",
    metric: "noThreePutts",
    target: 1,
    tier: "silver",
    xp: 100,
  },
  {
    id: "real_putts_32",
    name: "Steady Putter",
    description: "Take 32 putts or fewer across a complete real 18-hole round.",
    metric: "putts",
    target: 32,
    tier: "silver",
    xp: 100,
  },
  {
    id: "real_putts_30",
    name: "Thirty or Fewer",
    description: "Take 30 putts or fewer across a complete real 18-hole round.",
    metric: "putts",
    target: 30,
    tier: "gold",
    xp: 200,
  },
  {
    id: "real_fairways_8",
    name: "Fairway Finder",
    description:
      "Hit 8 fairways in a real 18-hole round with every eligible fairway result recorded.",
    metric: "fairways",
    target: 8,
    tier: "silver",
    xp: 100,
  },
  {
    id: "real_greens_6",
    name: "Six Greens",
    description:
      "Hit 6 greens in regulation in a real 18-hole round with all green results recorded.",
    metric: "greens",
    target: 6,
    tier: "silver",
    xp: 100,
  },
  {
    id: "real_greens_9",
    name: "Half the Greens",
    description:
      "Hit 9 greens in regulation in a real 18-hole round with all green results recorded.",
    metric: "greens",
    target: 9,
    tier: "gold",
    xp: 200,
  },
  {
    id: "real_penalty_free",
    name: "Keep It in Play",
    description:
      "Finish a real 18-hole round with zero penalties and every penalty count recorded.",
    metric: "penaltyFree",
    target: 1,
    tier: "silver",
    xp: 100,
  },
];

export const REAL_ROUND_ACHIEVEMENTS: Achievement[] = rules.map((rule) => ({
  id: rule.id,
  name: rule.name,
  description: rule.description,
  category: "realRounds",
  tier: rule.tier,
  xp: rule.xp,
  repeatable: false,
  hidden: false,
  triggerType: "roundScorecard",
  targetValue: rule.target,
}));

/** Strictly real, completed scorecards. Missing statistics never count as zero. */
export function evaluateRealRoundAchievements(
  sessions: AchievementSession[],
): AchievementEvaluationResult {
  const result: AchievementEvaluationResult = { unlocks: [], progress: [] };
  const unlocked = new Set<string>();
  const progress = new Map<string, AchievementEvaluationResult["progress"][number]>();
  let completedRounds = 0;
  const seenSessions = new Set<string>();
  for (const session of [...sessions].sort((a, b) => a.date.getTime() - b.date.getTime())) {
    if (seenSessions.has(session.id)) continue;
    seenSessions.add(session.id);
    const holes = validRealCard(session);
    if (!holes) continue;
    const full = holes.length === 18;
    if (full) completedRounds++;
    const score = holes.reduce((sum, h) => sum + h.score!, 0);
    const par = holes.reduce((sum, h) => sum + h.par, 0);
    const validPutts =
      full && holes.every((h) => nonnegativeInteger(h.putts) && h.putts! <= h.score!);
    const eligibleFairways = holes.filter((h) => h.par > 3);
    const metrics: Partial<Record<Metric, number>> = {
      holes: holes.length,
      rounds: completedRounds,
      birdies: holes.filter((h) => h.score === h.par - 1).length,
    };
    if (full && par >= 65) metrics.score = score;
    if (validPutts) {
      metrics.putts = holes.reduce((sum, h) => sum + h.putts!, 0);
      metrics.noThreePutts = holes.every((h) => h.putts! < 3) ? 1 : 0;
    }
    if (
      full &&
      eligibleFairways.length &&
      eligibleFairways.every((h) => typeof h.fairwayHit === "boolean")
    )
      metrics.fairways = eligibleFairways.filter((h) => h.fairwayHit).length;
    if (full && holes.every((h) => typeof h.gir === "boolean"))
      metrics.greens = holes.filter((h) => h.gir).length;
    if (full && holes.every((h) => nonnegativeInteger(h.penalties) && h.penalties! <= h.score!))
      metrics.penaltyFree = holes.every((h) => h.penalties === 0) ? 1 : 0;
    for (const rule of rules) {
      const value = metrics[rule.metric];
      if (value === undefined) continue;
      const low = rule.metric === "score" || rule.metric === "putts";
      const achieved =
        rule.metric === "score"
          ? value < rule.target
          : low
            ? value <= rule.target
            : value >= rule.target;
      const metadata = {
        realRound: true,
        metric: rule.metric,
        value,
        score,
        par,
        holes: holes.length,
        sessionId: session.id,
      };
      const progressValue = Math.min(
        rule.target,
        Math.max(0, low ? 2 * rule.target - value - (rule.metric === "score" ? 1 : 0) : value),
      );
      if (!progress.has(rule.id) || progressValue > progress.get(rule.id)!.progressValue)
        progress.set(rule.id, {
          achievementId: rule.id,
          progressValue,
          targetValue: rule.target,
          metadata,
        });
      if (achieved && !unlocked.has(rule.id)) {
        unlocked.add(rule.id);
        result.unlocks.push({
          achievementId: rule.id,
          sourceSessionId: session.id,
          unlockedAt: session.date,
          metadata,
        });
      }
    }
  }
  result.progress = [...progress.values()];
  return result;
}
function nonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
function validRealCard(session: AchievementSession): RoundScorecardHole[] | null {
  if (
    session.type !== "real_round" ||
    session.roundStatus !== "complete" ||
    !Array.isArray(session.scorecardJson)
  )
    return null;
  const holes = [...session.scorecardJson].sort((a, b) => a.holeNumber - b.holeNumber);
  if (holes.length !== 9 && holes.length !== 18) return null;
  const start = holes.length === 9 && holes[0]?.holeNumber === 10 ? 10 : 1;
  if (
    !holes.every(
      (h, i) =>
        h.holeNumber === start + i &&
        Number.isInteger(h.par) &&
        h.par >= 3 &&
        h.par <= 6 &&
        nonnegativeInteger(h.score) &&
        h.score > 0,
    )
  )
    return null;
  return holes;
}
