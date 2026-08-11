import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { getAchievement } from "@/lib/achievements/registry";
import { getDb } from "@/db/client";
import {
  challengeEntries,
  challengeResults,
  challenges,
  tournamentEntries,
  tournamentStandings,
  tournaments,
  userAchievements,
} from "@/db/schema";
import { getUserHandicapProfile } from "@/lib/handicap-data";
import { getPracticePlannerContext } from "@/lib/practice-planner";
import { getProductPreferences } from "@/lib/product-preferences";

export type CompanionSummary = {
  eyebrow: string;
  title: string;
  description: string;
  rows: Array<{ label: string; value: string; detail?: string }>;
  primary: { label: string; href: string };
};

export async function getCompanionSummary(userId: string, pathname: string) {
  if (pathname.startsWith("/handicap")) return handicapSummary(userId);
  if (pathname.startsWith("/goals")) return goalsSummary(userId);
  if (pathname.startsWith("/challenges")) return challengeSummary(userId, false);
  if (pathname.startsWith("/leaderboard")) return challengeSummary(userId, true);
  if (pathname.startsWith("/tournaments")) return tournamentSummary(userId);
  if (pathname.startsWith("/achievements")) return achievementsSummary(userId);
  if (pathname.startsWith("/progress")) return progressSummary(userId);
  return coachSummary(userId);
}

async function coachSummary(userId: string): Promise<CompanionSummary> {
  const context = await getPracticePlannerContext(userId, {
    compactTraining: true,
    includeSpeed: false,
  });
  const opportunity = context.latestPractice.biggestOpportunity;
  const club = context.latestPractice.clubs.find((item) => item.clubType === opportunity) ?? null;

  return {
    eyebrow: "Coach summary",
    title: club ? `${club.label} is the current priority` : "Build the next measured baseline",
    description: context.latestPractice.scoringIssue,
    rows: [
      {
        label: "Primary diagnosis",
        value: club?.label ?? "Insufficient evidence",
        detail: club
          ? `${club.shotCount} measured shots · ${formatPercent(club.playableRate)} playable`
          : "Import a fresh measured session.",
      },
      {
        label: "Training status",
        value: context.trainingLoad.statusLabel,
        detail: context.trainingLoad.recommendation,
      },
      {
        label: "Bag confidence",
        value: context.bag.issues[0] ?? "No priority warning",
      },
    ],
    primary: { label: "Build recommended practice", href: "/practice" },
  };
}

async function progressSummary(userId: string): Promise<CompanionSummary> {
  const context = await getPracticePlannerContext(userId, {
    compactTraining: true,
    includeSpeed: false,
  });
  return {
    eyebrow: "Current progress",
    title: context.progress.priorities[0]?.title ?? "Keep building measured evidence",
    description:
      "A compact read of the improvement direction. Full history and comparisons stay in the workbench.",
    rows: [
      { label: "Current form", value: formatClub(context.progress.currentForm) },
      { label: "Needs work", value: formatClub(context.progress.weakestSignal) },
      { label: "Most volatile", value: formatClub(context.progress.mostVolatile) },
    ],
    primary: { label: "Plan the next session", href: "/practice" },
  };
}

async function handicapSummary(userId: string): Promise<CompanionSummary> {
  const profile = await getUserHandicapProfile(userId);
  return {
    eyebrow: "Current handicap",
    title:
      profile.displayValue === null
        ? "No handicap estimate yet"
        : `${profile.displayValue.toFixed(1)} playing estimate`,
    description: profile.sourceLabel,
    rows: [
      { label: "Band", value: profile.band ?? "Not established" },
      { label: "Eligible rounds", value: String(profile.rounds.length) },
      {
        label: "Real rounds",
        value: String(profile.rounds.filter((round) => round.type === "real_round").length),
      },
    ],
    primary: { label: "Add a round", href: "/rounds/new" },
  };
}

async function goalsSummary(userId: string): Promise<CompanionSummary> {
  const preferences = await getProductPreferences(userId);
  const plan = preferences.seasonPlan;
  return {
    eyebrow: "Current goals",
    title: plan.outcome,
    description: `${plan.focus} · ${plan.successMeasure}`,
    rows: [
      { label: "Weekly rhythm", value: `${plan.weeklySessions} measured sessions` },
      { label: "Target date", value: plan.targetDate || "Not set" },
      ...preferences.goals.slice(0, 3).map((goal) => ({
        label: goal.title,
        value: `${goal.currentValue} / ${goal.targetValue} ${goal.unit}`,
        detail: goal.nextAction,
      })),
    ],
    primary: { label: "Practise toward this goal", href: "/practice" },
  };
}

async function challengeSummary(userId: string, leaderboard: boolean): Promise<CompanionSummary> {
  const rows = await getDb()
    .select({
      title: challenges.title,
      endsAt: challenges.endsAt,
      rank: challengeResults.rank,
      scoreLabel: challengeResults.scoreLabel,
    })
    .from(challengeEntries)
    .innerJoin(challenges, eq(challenges.id, challengeEntries.challengeId))
    .leftJoin(
      challengeResults,
      and(eq(challengeResults.challengeId, challenges.id), eq(challengeResults.userId, userId)),
    )
    .where(and(eq(challengeEntries.userId, userId), eq(challenges.status, "open")))
    .orderBy(desc(challenges.startsAt))
    .limit(6);
  const active = rows[0] ?? null;

  return {
    eyebrow: leaderboard ? "Leaderboard position" : "Active challenges",
    title: active?.title ?? "No active joined challenge",
    description: active
      ? leaderboard
        ? `Current position ${active.rank ? `#${active.rank}` : "not ranked"}.`
        : "A read-only view of your current measured competition."
      : "Join or create competitions from the full workbench.",
    rows: rows.slice(0, 4).map((row) => ({
      label: row.title,
      value: row.rank ? `#${row.rank}` : "Not ranked",
      detail: row.scoreLabel ?? (row.endsAt ? `Ends ${formatDate(row.endsAt)}` : "Open"),
    })),
    primary: {
      label: "Open full competition site",
      href: "/surface/workbench?next=%2Fchallenges",
    },
  };
}

async function tournamentSummary(userId: string): Promise<CompanionSummary> {
  const rows = await getDb()
    .select({
      title: tournaments.title,
      startsAt: tournaments.startsAt,
      endsAt: tournaments.endsAt,
      rank: tournamentStandings.rank,
      roundsCompleted: tournamentStandings.roundsCompleted,
    })
    .from(tournamentEntries)
    .innerJoin(tournaments, eq(tournaments.id, tournamentEntries.tournamentId))
    .leftJoin(
      tournamentStandings,
      and(
        eq(tournamentStandings.tournamentId, tournaments.id),
        eq(tournamentStandings.userId, userId),
      ),
    )
    .where(eq(tournamentEntries.userId, userId))
    .orderBy(desc(tournaments.startsAt))
    .limit(5);
  const next = rows[0] ?? null;

  return {
    eyebrow: "Upcoming tournament",
    title: next?.title ?? "No entered tournament",
    description: next
      ? `Starts ${formatDate(next.startsAt)}${next.endsAt ? ` · ends ${formatDate(next.endsAt)}` : ""}`
      : "Tournament management stays in the workbench.",
    rows: rows.map((row) => ({
      label: row.title,
      value: row.rank ? `#${row.rank}` : "Entered",
      detail: `${row.roundsCompleted ?? 0} rounds completed`,
    })),
    primary: { label: "Prepare for a round", href: "/play" },
  };
}

async function achievementsSummary(userId: string): Promise<CompanionSummary> {
  const rows = await getDb()
    .select({
      id: userAchievements.achievementId,
      unlockedAt: userAchievements.lastUnlockedAt,
      xp: userAchievements.xpAwarded,
    })
    .from(userAchievements)
    .where(eq(userAchievements.userId, userId))
    .orderBy(desc(userAchievements.lastUnlockedAt))
    .limit(5);

  return {
    eyebrow: "Recent achievements",
    title: rows[0]
      ? (getAchievement(rows[0].id)?.name ?? "Achievement unlocked")
      : "No achievement unlocked yet",
    description: "Recent evidence-led milestones. The full cabinet stays in the workbench.",
    rows: rows.map((row) => ({
      label: getAchievement(row.id)?.name ?? row.id,
      value: `${row.xp} XP`,
      detail: formatDate(row.unlockedAt),
    })),
    primary: { label: "Build the next practice", href: "/practice" },
  };
}

function formatPercent(value: number | null) {
  return value === null ? "—" : `${Math.round(value)}%`;
}

function formatClub(value: string | null) {
  return value ? value.toUpperCase() : "Building";
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value);
}
