export type RivalryMemberInput = {
  userId: string;
  displayName: string;
  username?: string | null;
};

export type RivalryRoundInput = {
  userId: string;
  date: Date | string;
  scorecardJson?: Array<{ score?: number | null; par?: number | null }> | null;
};

export type RivalryStanding = {
  userId: string;
  displayName: string;
  username: string | null;
  roundsPlayed: number;
  bestScore: number | null;
  bestToPar: number | null;
  points: number;
  lastPlayedAt: Date | null;
  summary: string;
};

export type RivalryPairingSummary = {
  userAId: string;
  userBId: string | null;
  userALabel: string;
  userBLabel: string;
  userAScore: number;
  userBScore: number | null;
  winnerUserId: string | null;
  summary: string;
};

export function weekPeriodKey(date = new Date()) {
  const start = startOfIsoWeek(date);
  const year = start.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const firstWeekStart = startOfIsoWeek(firstThursday);
  const week = Math.floor((start.getTime() - firstWeekStart.getTime()) / 604800000) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function startOfIsoWeek(date = new Date()) {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() - day + 1);
  utc.setUTCHours(0, 0, 0, 0);
  return utc;
}

export function endOfIsoWeek(date = new Date()) {
  const start = startOfIsoWeek(date);
  return new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
}

export function buildRivalryStandings({
  members,
  rounds,
}: {
  members: RivalryMemberInput[];
  rounds: RivalryRoundInput[];
}): RivalryStanding[] {
  return members
    .map((member) => {
      const memberRounds = rounds
        .filter((round) => round.userId === member.userId)
        .map((round) => ({ ...round, total: scorecardTotal(round.scorecardJson) }))
        .filter((round) => round.total !== null)
        .sort((left, right) => dateValue(right.date) - dateValue(left.date));
      const best = memberRounds
        .map((round) => round.total)
        .filter((total): total is NonNullable<typeof total> => total !== null)
        .sort((left, right) => left.score - right.score)[0];
      const latest = memberRounds[0] ?? null;
      const points =
        memberRounds.length * 4 +
        (best ? Math.max(0, 18 - Math.max(-6, best.toPar)) : 0) +
        (latest ? 2 : 0);

      return {
        userId: member.userId,
        displayName: member.displayName,
        username: member.username ?? null,
        roundsPlayed: memberRounds.length,
        bestScore: best?.score ?? null,
        bestToPar: best?.toPar ?? null,
        points,
        lastPlayedAt: latest ? coerceDate(latest.date) : null,
        summary: best
          ? `Best ${best.score} (${formatToPar(best.toPar)})`
          : "No scoring round this week",
      };
    })
    .sort(
      (left, right) =>
        right.points - left.points ||
        nullAwareNumberAsc(left.bestToPar, right.bestToPar) ||
        left.displayName.localeCompare(right.displayName),
    );
}

export function buildRivalryPairings(standings: RivalryStanding[]): RivalryPairingSummary[] {
  const pairings: RivalryPairingSummary[] = [];

  for (let index = 0; index < standings.length; index += 2) {
    const userA = standings[index];
    const userB = standings[index + 1] ?? null;

    pairings.push({
      userAId: userA.userId,
      userBId: userB?.userId ?? null,
      userALabel: userA.displayName,
      userBLabel: userB?.displayName ?? "Bye",
      userAScore: userA.points,
      userBScore: userB?.points ?? null,
      winnerUserId: userB
        ? userA.points >= userB.points
          ? userA.userId
          : userB.userId
        : userA.userId,
      summary: userB
        ? `${userA.displayName} ${userA.points} - ${userB.points} ${userB.displayName}`
        : `${userA.displayName} holds the bye`,
    });
  }

  return pairings;
}

function scorecardTotal(
  scorecardJson: RivalryRoundInput["scorecardJson"],
): { score: number; toPar: number } | null {
  const holes = Array.isArray(scorecardJson) ? scorecardJson : [];
  const scored = holes.filter((hole) => typeof hole.score === "number");

  if (scored.length === 0) {
    return null;
  }

  const score = scored.reduce((total, hole) => total + (hole.score ?? 0), 0);
  const par = scored.reduce(
    (total, hole) => total + (typeof hole.par === "number" ? hole.par : 0),
    0,
  );

  return {
    score,
    toPar: par > 0 ? score - par : score,
  };
}

export function formatToPar(value: number) {
  if (value === 0) return "E";
  return value > 0 ? `+${value}` : `${value}`;
}

function nullAwareNumberAsc(left: number | null, right: number | null) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left - right;
}

function dateValue(value: Date | string) {
  return coerceDate(value)?.getTime() ?? 0;
}

function coerceDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
