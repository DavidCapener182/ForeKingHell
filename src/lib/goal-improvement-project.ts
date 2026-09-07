import "server-only";

import { and, asc, count, desc, eq, gt, inArray, lt, lte, or, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { practicePlans, sessions, shots } from "@/db/schema";
import { getSavedPracticePlans } from "@/lib/practice-planner";
import { getProductPreferences, mutateProductPreferences } from "@/lib/product-preferences";
import { isShotEvidenceEligible } from "@/lib/shot-review";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class GoalProjectError extends Error {}

export async function linkGoalImprovementProject(input: {
  userId: string;
  goalId: string;
  baselineSessionId: string | null;
  practicePlanIds: string[];
}) {
  const planIds = [...new Set(input.practicePlanIds)];
  if (
    (input.baselineSessionId && !uuid.test(input.baselineSessionId)) ||
    planIds.some((id) => !uuid.test(id))
  )
    throw new GoalProjectError("Choose a baseline and practice plans from your saved records.");
  if (planIds.length > 50) throw new GoalProjectError("Link up to 50 practice plans to one goal.");
  await mutateProductPreferences(input.userId, async (current, db) => {
    if (!current.goals.some((goal) => goal.id === input.goalId))
      throw new GoalProjectError("That goal is no longer available in your account.");
    if (input.baselineSessionId) {
      const [baseline] = await db
        .select({ id: sessions.id })
        .from(sessions)
        .where(
          and(
            eq(sessions.id, input.baselineSessionId),
            eq(sessions.userId, input.userId),
            lte(sessions.date, new Date()),
          ),
        )
        .limit(1)
        .for("key share");
      if (!baseline)
        throw new GoalProjectError("Choose an available baseline session dated today or earlier.");
    }
    if (planIds.length) {
      const owned = await db
        .select({ id: practicePlans.id })
        .from(practicePlans)
        .where(and(eq(practicePlans.userId, input.userId), inArray(practicePlans.id, planIds)))
        .orderBy(asc(practicePlans.id))
        .for("key share");
      if (owned.length !== planIds.length)
        throw new GoalProjectError(
          "One of these practice plans is no longer available in your account.",
        );
    }
    return {
      goals: current.goals.map((goal) =>
        goal.id === input.goalId
          ? {
              ...goal,
              project: { baselineSessionId: input.baselineSessionId, practicePlanIds: planIds },
            }
          : goal,
      ),
    };
  });
}

const sessionColumns = {
  id: sessions.id,
  date: sessions.date,
  source: sessions.source,
  type: sessions.type,
  fileName: sessions.fileName,
  courseName: sessions.courseName,
};

export type GoalProjectSession = {
  id: string;
  label: string;
  date: string;
  source: string;
  type: string;
  eligibleMeasuredShots: number;
  href: string;
};

export async function getGoalImprovementProjectData(userId: string) {
  const db = getDb();
  const preferences = await getProductPreferences(userId);
  const selectedPlanIds = [
    ...new Set(preferences.goals.flatMap((goal) => goal.project?.practicePlanIds ?? [])),
  ];
  const [plans, recentPlans, recentSessions] = await Promise.all([
    getSavedPracticePlans(userId, Math.max(1, selectedPlanIds.length), selectedPlanIds),
    db
      .select({
        id: practicePlans.id,
        title: practicePlans.title,
        status: practicePlans.status,
        plannedAt: practicePlans.plannedAt,
      })
      .from(practicePlans)
      .where(eq(practicePlans.userId, userId))
      .orderBy(desc(practicePlans.createdAt))
      .limit(100),
    db
      .select(sessionColumns)
      .from(sessions)
      .where(and(eq(sessions.userId, userId), lte(sessions.date, new Date())))
      .orderBy(desc(sessions.date))
      .limit(100),
  ]);
  const referencedIds = [
    ...new Set([
      ...preferences.goals.flatMap((goal) =>
        goal.project?.baselineSessionId ? [goal.project.baselineSessionId] : [],
      ),
      ...plans.flatMap((plan) =>
        [
          plan.result?.sourceSessionId,
          ...(plan.result?.comparison?.importedSession?.sourceSessionIds ?? []),
        ].filter((id): id is string => typeof id === "string" && uuid.test(id)),
      ),
    ]),
  ];
  const referencedSessions = referencedIds.length
    ? await db
        .select(sessionColumns)
        .from(sessions)
        .where(and(eq(sessions.userId, userId), inArray(sessions.id, referencedIds)))
    : [];
  const sessionRows = [
    ...new Map(
      [...recentSessions, ...referencedSessions].map((session) => [session.id, session]),
    ).values(),
  ];
  // Aggregate the review categories before applying the existing eligibility rule; never load raw uploads.
  const counts = sessionRows.length
    ? await db
        .select({
          sessionId: shots.sessionId,
          reviewStatus: shots.reviewStatus,
          qualityTag: shots.qualityTag,
          shotCategory: shots.shotCategory,
          count: count(),
        })
        .from(shots)
        .where(
          and(
            eq(shots.userId, userId),
            inArray(
              shots.sessionId,
              sessionRows.map((session) => session.id),
            ),
            or(
              and(gt(shots.carryYd, 0), lt(shots.carryYd, sql`'Infinity'::double precision`)),
              and(gt(shots.totalYd, 0), lt(shots.totalYd, sql`'Infinity'::double precision`)),
              and(
                gt(shots.ballSpeedMph, 0),
                lt(shots.ballSpeedMph, sql`'Infinity'::double precision`),
              ),
              and(
                gt(shots.clubSpeedMph, 0),
                lt(shots.clubSpeedMph, sql`'Infinity'::double precision`),
              ),
            ),
          ),
        )
        .groupBy(shots.sessionId, shots.reviewStatus, shots.qualityTag, shots.shotCategory)
    : [];
  const eligibleCounts = new Map<string, number>();
  for (const row of counts)
    if (isShotEvidenceEligible(row))
      eligibleCounts.set(row.sessionId, (eligibleCounts.get(row.sessionId) ?? 0) + row.count);
  const now = Date.now();
  const sessionMap = new Map(
    sessionRows.map((session): [string, GoalProjectSession] => [
      session.id,
      {
        id: session.id,
        label: session.courseName || session.fileName || "Recorded session",
        date: session.date.toISOString(),
        source: session.source,
        type: session.type,
        eligibleMeasuredShots:
          ["manual", "manual_edit"].includes(session.source) || session.date.getTime() > now
            ? 0
            : (eligibleCounts.get(session.id) ?? 0),
        href: `/sessions/${session.id}`,
      },
    ]),
  );
  const projects = preferences.goals.map((goal) => {
    const baselineId = goal.project?.baselineSessionId;
    const candidateBaseline = baselineId ? (sessionMap.get(baselineId) ?? null) : null;
    const baseline =
      candidateBaseline && Date.parse(candidateBaseline.date) <= now ? candidateBaseline : null;
    const selected = goal.project?.practicePlanIds ?? [];
    const linkedPlans = selected.flatMap((id) => {
      const plan = plans.find((candidate) => candidate.id === id);
      if (!plan) return [];
      const evidenceIds = [
        ...new Set(
          [
            plan.result?.sourceSessionId,
            ...(plan.result?.comparison?.importedSession?.sourceSessionIds ?? []),
          ].filter((id): id is string => Boolean(id)),
        ),
      ];
      const activityTime = Date.parse(plan.startedAt ?? plan.plannedAt);
      const evidence = evidenceIds.flatMap((id) => {
        const session = sessionMap.get(id);
        if (
          !session ||
          !baseline ||
          session.id === baseline.id ||
          !session.eligibleMeasuredShots ||
          Date.parse(session.date) < Date.parse(baseline.date) ||
          practiceDay(Date.parse(session.date)) < practiceDay(activityTime) ||
          Date.parse(session.date) > now
        )
          return [];
        const comparison = new URLSearchParams({
          focus: "session",
          baseline: "previous-session",
          sessionId: session.id,
          baselineSessionId: baseline.id,
        });
        return [
          {
            ...session,
            compareHref: baseline.eligibleMeasuredShots > 0 ? `/compare?${comparison}` : null,
          },
        ];
      });
      return [
        {
          id: plan.id,
          title: plan.title,
          status: plan.status,
          plannedAt: plan.plannedAt,
          completedAt: plan.completedAt,
          href: `/practice?planId=${plan.id}`,
          importHref: `/import?practicePlanId=${plan.id}`,
          drills: plan.blocks.map((block) => ({
            id: block.dbId,
            title: block.title,
            drill: block.drill,
            clubs: block.clubs,
            successCriteria: block.successTarget,
          })),
          review: plan.result
            ? { verdict: plan.result.verdict, nextAction: plan.result.nextAction }
            : null,
          evidence,
          evidenceNeedsReview: evidenceIds.length > 0 && evidence.length === 0,
        },
      ];
    });
    const unavailablePlanCount = selected.length - linkedPlans.length;
    const status = !baseline
      ? "choose_baseline"
      : linkedPlans.length === 0
        ? "choose_practice"
        : linkedPlans.some((plan) => plan.evidence.length)
          ? "review_ready"
          : linkedPlans.some(
                (plan) =>
                  plan.completedAt ||
                  ["completed", "analysed", "match_found"].includes(plan.status),
              )
            ? "awaiting_evidence"
            : "practise";
    return {
      goalId: goal.id,
      title: goal.title,
      baseline,
      missingBaseline: Boolean(baselineId && !baseline),
      practicePlanIds: linkedPlans.map((plan) => plan.id),
      plans: linkedPlans,
      unavailablePlanCount,
      status,
      practiceFromBaselineHref: baseline
        ? `/practice?sourceSessionId=${baseline.id}&goalId=${encodeURIComponent(goal.id)}`
        : `/practice?goalId=${encodeURIComponent(goal.id)}`,
    };
  });
  return {
    projects,
    sessionOptions: [
      ...new Map(
        [...recentSessions, ...referencedSessions]
          .filter((session) => session.date.getTime() <= now)
          .map((session) => [session.id, sessionMap.get(session.id)!]),
      ).values(),
    ],
    practiceOptions: [
      ...new Map(
        [
          ...recentPlans.map((plan) => ({ ...plan, plannedAt: plan.plannedAt.toISOString() })),
          ...plans.map((plan) => ({
            id: plan.id,
            title: plan.title,
            status: plan.status,
            plannedAt: plan.plannedAt,
          })),
        ].map((plan) => [plan.id, plan]),
      ).values(),
    ],
  };
}

export type GoalImprovementProjectData = Awaited<ReturnType<typeof getGoalImprovementProjectData>>;

function practiceDay(time: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(time));
}
