import Link from "next/link";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Eye,
  EyeOff,
  FileText,
  MessageSquareText,
  UserRoundCheck,
} from "lucide-react";

import {
  completePlayerInteractionAction,
  createCoachInteractionAction,
  updateCoachInteractionStatusAction,
} from "@/app/coach/workspace/actions";
import { DataWarning, RecommendedAction } from "@/components/app/evidence-status";
import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDb } from "@/db/client";
import {
  accountMemberships,
  coachPlayerInteractions,
  practicePlans,
  sessions,
  shots,
  userProfiles,
  users,
} from "@/db/schema";
import { buildCoachSummary } from "@/lib/coach";
import {
  coachInteractionStatusLabel,
  coachInteractionTypeLabels,
  coachInteractionTypes,
  interactionNeedsAction,
  type CoachInteractionType,
} from "@/lib/coach-workspace";
import { requireCurrentUserId } from "@/lib/current-user";
import { getProductPreferences, goalProgress } from "@/lib/product-preferences";
import { getProgressData } from "@/lib/progress-data";

export const dynamic = "force-dynamic";

export default async function CoachWorkspacePage({
  searchParams,
}: {
  searchParams?: Promise<{ playerId?: string; saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const data = await getCoachWorkspaceData(params?.playerId);

  return (
    <PageShell>
      <Button asChild variant="ghost" className="w-fit px-0">
        <Link href="/coach">
          <ArrowLeft className="size-4" aria-hidden />
          Coach
        </Link>
      </Button>
      <PageHeader
        eyebrow={<StatusPill tone="sky">Coach workspace</StatusPill>}
        title="One player, one evidence trail, one next action"
        description="Review assigned players without account impersonation. Private coach notes stay private; assignments, feedback and evidence requests are explicitly player-visible."
        actions={
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/coach/reports">
              <FileText className="size-4" aria-hidden />
              Selective reports
            </Link>
          </Button>
        }
      />

      {params?.saved === "1" ? (
        <div role="status" className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
          Coach interaction saved with its visibility and evidence reference.
        </div>
      ) : null}
      {params?.error ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm"
        >
          That coach action could not be saved. Check membership, linked evidence and required
          fields.
        </div>
      ) : null}

      {data.players.length && data.selected ? (
        <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="rounded-2xl border bg-card p-3" aria-labelledby="assigned-players">
            <div className="px-2 pb-3">
              <h2 id="assigned-players" className="font-semibold">
                Assigned players
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Active coach memberships only · {data.players.length} player
                {data.players.length === 1 ? "" : "s"}
              </p>
            </div>
            <nav className="grid gap-1" aria-label="Assigned players">
              {data.players.map((player) => (
                <Link
                  key={player.id}
                  href={`/coach/workspace?playerId=${player.id}`}
                  aria-current={data.selected?.id === player.id ? "page" : undefined}
                  className={`focus-aaa rounded-xl border p-3 outline-none transition-colors ${
                    data.selected?.id === player.id
                      ? "border-primary/40 bg-primary/5"
                      : "border-transparent hover:bg-secondary/60"
                  }`}
                >
                  <p className="font-semibold">{player.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {player.latestActivity
                      ? `Last evidence ${formatDate(player.latestActivity)}`
                      : "No session evidence"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <StatusPill tone={player.openActions > 0 ? "amber" : "green"}>
                      {player.openActions} open
                    </StatusPill>
                    {player.goal ? (
                      <StatusPill tone="sky">{goalProgress(player.goal)}% goal</StatusPill>
                    ) : null}
                  </div>
                </Link>
              ))}
            </nav>
          </aside>

          <main className="grid min-w-0 gap-4">
            <section
              className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
              aria-label="Player summary"
            >
              <SummaryCard
                label="Player"
                value={data.selected.name}
                detail={data.selected.email ?? "Private profile"}
              />
              <SummaryCard
                label="Last activity"
                value={
                  data.selected.latestActivity
                    ? formatDate(data.selected.latestActivity)
                    : "No evidence"
                }
                detail={`${data.selected.sessionCount} measured session${data.selected.sessionCount === 1 ? "" : "s"}`}
              />
              <SummaryCard
                label="Current goal"
                value={data.playerDetail.goal?.title ?? "No goal set"}
                detail={
                  data.playerDetail.goal
                    ? `${goalProgress(data.playerDetail.goal)}% · ${data.playerDetail.goal.evidenceSource}`
                    : "Ask the player to define one measurable outcome"
                }
              />
              <SummaryCard
                label="Outstanding practice"
                value={data.playerDetail.openAssignment?.title ?? "Nothing overdue"}
                detail={
                  data.playerDetail.openAssignment?.dueAt
                    ? `Due ${formatDate(data.playerDetail.openAssignment.dueAt)}`
                    : "Open assignments and evidence requests"
                }
              />
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
              <Card className="premium-card">
                <CardHeader>
                  <p className="text-sm font-semibold text-primary">Current coaching read</p>
                  <CardTitle className="mt-1 text-2xl">
                    {data.playerDetail.priority
                      ? `${data.playerDetail.priority.clubName}: ${data.playerDetail.priority.issueLabel}`
                      : "Build a measured baseline before assigning a technical change"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-3">
                  <EvidenceCell
                    label="Flagged issue"
                    value={data.playerDetail.priority?.reason ?? "No supported club issue yet"}
                  />
                  <EvidenceCell
                    label="Freshness"
                    value={
                      data.selected.latestActivity
                        ? `Latest session ${formatDate(data.selected.latestActivity)}`
                        : "No imported session"
                    }
                  />
                  <EvidenceCell
                    label="Upcoming review"
                    value={
                      data.playerDetail.upcomingReview?.dueAt
                        ? `${data.playerDetail.upcomingReview.title} · ${formatDate(data.playerDetail.upcomingReview.dueAt)}`
                        : "No review scheduled"
                    }
                  />
                </CardContent>
              </Card>
              <DataWarning
                title="Membership is not impersonation"
                detail="This workspace only loads a player whose account has an active coach membership for you. Visibility is stored on every interaction."
              />
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
              <div className="rounded-2xl border bg-card p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">Player evidence</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Recent sessions, practice plans, equipment notes and round-review entries.
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/coach/reports?playerId=${data.selected.id}`}>Build report</Link>
                  </Button>
                </div>
                <div className="mt-4 grid gap-2">
                  {data.playerDetail.sessions.length ? (
                    data.playerDetail.sessions.map((session) => (
                      <div key={session.id} className="rounded-xl border bg-background p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold">
                              {session.courseName ??
                                session.fileName ??
                                formatSessionType(session.type)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatDate(session.date)} · {session.source} · {session.shotCount}{" "}
                              shots
                            </p>
                          </div>
                          <div className="flex gap-1">
                            {session.type === "real_round" ? (
                              <StatusPill tone="sky">Round review</StatusPill>
                            ) : null}
                            {session.equipmentNotes ? (
                              <StatusPill tone="amber">Equipment change</StatusPill>
                            ) : null}
                          </div>
                        </div>
                        {session.equipmentNotes ? (
                          <p className="mt-2 text-xs leading-5 text-muted-foreground">
                            {session.equipmentNotes}
                          </p>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                      No sessions are available for this assigned player.
                    </p>
                  )}
                </div>
              </div>

              <form
                action={createCoachInteractionAction}
                className="grid content-start gap-3 rounded-2xl border bg-card p-4 sm:p-5"
              >
                <div>
                  <h2 className="text-xl font-semibold">Add coach interaction</h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Private coach note is coach-only. Every other type is player-visible.
                  </p>
                </div>
                <input type="hidden" name="playerUserId" value={data.selected.id} />
                <label className="grid gap-1 text-sm font-semibold">
                  Type and visibility
                  <select
                    name="interactionType"
                    className="min-h-11 rounded-xl border bg-background px-3"
                    defaultValue="practice_assignment"
                  >
                    {coachInteractionTypes.map((type) => (
                      <option key={type} value={type}>
                        {coachInteractionTypeLabels[type]} ·{" "}
                        {type === "private_note" ? "Coach only" : "Player visible"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  Title
                  <Input
                    name="title"
                    maxLength={180}
                    required
                    placeholder="Driver start-line assignment"
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  Detail
                  <textarea
                    name="body"
                    rows={5}
                    maxLength={8000}
                    required
                    className="rounded-xl border bg-background p-3"
                    placeholder="What the player should do, why, and what evidence will count"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm font-semibold">
                    Due date
                    <Input type="date" name="dueAt" />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold">
                    Goal reference
                    <select
                      name="goalReference"
                      className="min-h-10 rounded-md border bg-background px-3"
                    >
                      <option value="">No goal link</option>
                      {data.playerDetail.goals.map((goal) => (
                        <option key={goal.id} value={goal.id}>
                          {goal.title}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="grid gap-1 text-sm font-semibold">
                  Session evidence
                  <select
                    name="sessionId"
                    className="min-h-10 rounded-md border bg-background px-3"
                  >
                    <option value="">No session link</option>
                    {data.playerDetail.sessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        {formatDate(session.date)} · {formatSessionType(session.type)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  Practice plan
                  <select
                    name="practicePlanId"
                    className="min-h-10 rounded-md border bg-background px-3"
                  >
                    <option value="">No plan link</option>
                    {data.playerDetail.plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.title} · {plan.status}
                      </option>
                    ))}
                  </select>
                </label>
                <Button type="submit" className="min-h-11 sm:w-fit">
                  <MessageSquareText className="size-4" aria-hidden />
                  Save interaction
                </Button>
              </form>
            </section>

            <InteractionTimeline
              title="Coach interaction history"
              interactions={data.playerDetail.interactions}
              playerUserId={data.selected.id}
              mode="coach"
            />

            <RecommendedAction
              title="Keep the loop measurable"
              detail="Assign one action, name the imported evidence that will count, then review completion before adding another priority."
              href={`/coach/reports?playerId=${data.selected.id}`}
              actionLabel="Prepare selective report"
            />
          </main>
        </div>
      ) : (
        <section className="rounded-2xl border border-dashed bg-card p-8 text-center">
          <UserRoundCheck className="mx-auto size-9 text-muted-foreground" aria-hidden />
          <h2 className="mt-3 text-xl font-semibold">No assigned players yet</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            A player must explicitly add you as a coach before their evidence appears here.
            Selective reports remain available without granting account membership.
          </p>
          <Button asChild variant="outline" className="mt-5 min-h-11">
            <Link href="/coach/reports">Open selective reports</Link>
          </Button>
        </section>
      )}

      <InteractionTimeline
        title="My player-visible coach inbox"
        interactions={data.playerInbox}
        mode="player"
      />
    </PageShell>
  );
}

function InteractionTimeline({
  title,
  interactions,
  playerUserId,
  mode,
}: {
  title: string;
  interactions: WorkspaceInteraction[];
  playerUserId?: string;
  mode: "coach" | "player";
}) {
  return (
    <section
      className="rounded-2xl border bg-card p-4 sm:p-5"
      aria-labelledby={`${mode}-interactions`}
    >
      <div className="flex items-center gap-2">
        <ClipboardList className="size-5 text-primary" aria-hidden />
        <h2 id={`${mode}-interactions`} className="text-xl font-semibold">
          {title}
        </h2>
      </div>
      <div className="mt-4 grid gap-3">
        {interactions.length ? (
          interactions.map((item) => (
            <article key={item.id} className="rounded-xl border bg-background p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill
                      tone={
                        item.status === "completed"
                          ? "green"
                          : item.status === "cancelled"
                            ? "slate"
                            : "amber"
                      }
                    >
                      {coachInteractionStatusLabel(item.status)}
                    </StatusPill>
                    <StatusPill tone={item.visibility === "coach_only" ? "slate" : "sky"}>
                      {item.visibility === "coach_only" ? (
                        <EyeOff className="mr-1 size-3" aria-hidden />
                      ) : (
                        <Eye className="mr-1 size-3" aria-hidden />
                      )}
                      {item.visibility === "coach_only" ? "Coach only" : "Player visible"}
                    </StatusPill>
                  </div>
                  <h3 className="mt-2 font-semibold">{item.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {coachInteractionTypeLabels[item.interactionType as CoachInteractionType] ??
                      item.interactionType}{" "}
                    · {formatDate(item.createdAt)}
                    {item.coachName ? ` · ${item.coachName}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {mode === "coach" && playerUserId && item.status === "open" ? (
                    <>
                      <StatusForm
                        interactionId={item.id}
                        playerUserId={playerUserId}
                        status="completed"
                        label="Complete"
                      />
                      <StatusForm
                        interactionId={item.id}
                        playerUserId={playerUserId}
                        status="cancelled"
                        label="Cancel"
                      />
                    </>
                  ) : null}
                  {mode === "player" &&
                  interactionNeedsAction(item.interactionType, item.status) ? (
                    <form action={completePlayerInteractionAction}>
                      <input type="hidden" name="interactionId" value={item.id} />
                      <Button type="submit" size="sm" variant="outline">
                        <CheckCircle2 className="size-4" aria-hidden />
                        Mark complete
                      </Button>
                    </form>
                  ) : null}
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{item.body}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {item.dueAt ? <span>Due {formatDate(item.dueAt)}</span> : null}
                {item.sessionId ? <span>Session evidence linked</span> : null}
                {item.practicePlanId ? <span>Practice plan linked</span> : null}
                {item.goalReference ? <span>Goal linked</span> : null}
              </div>
            </article>
          ))
        ) : (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            {mode === "coach"
              ? "No coach interactions recorded for this player."
              : "No player-visible coach feedback or assignments yet."}
          </p>
        )}
      </div>
    </section>
  );
}

function StatusForm({
  interactionId,
  playerUserId,
  status,
  label,
}: {
  interactionId: string;
  playerUserId: string;
  status: "completed" | "cancelled";
  label: string;
}) {
  return (
    <form action={updateCoachInteractionStatusAction}>
      <input type="hidden" name="interactionId" value={interactionId} />
      <input type="hidden" name="playerUserId" value={playerUserId} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" size="sm" variant="outline">
        {label}
      </Button>
    </form>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-2xl border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-semibold">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
    </article>
  );
}

function EvidenceCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/55 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-sm leading-6">{value}</p>
    </div>
  );
}

type WorkspaceInteraction = typeof coachPlayerInteractions.$inferSelect & {
  coachName?: string | null;
};

async function getCoachWorkspaceData(requestedPlayerId?: string) {
  const coachUserId = await requireCurrentUserId();
  const db = getDb();
  const rosterRows = await db
    .select({
      id: accountMemberships.ownerUserId,
      name: userProfiles.displayName,
      fallbackName: users.name,
      email: users.email,
    })
    .from(accountMemberships)
    .innerJoin(users, eq(users.id, accountMemberships.ownerUserId))
    .leftJoin(userProfiles, eq(userProfiles.userId, accountMemberships.ownerUserId))
    .where(
      and(eq(accountMemberships.memberUserId, coachUserId), eq(accountMemberships.role, "coach")),
    );
  const playerIds = rosterRows.map((player) => player.id);
  const [activityRows, openRows, playerPreferences, playerInbox] = await Promise.all([
    playerIds.length
      ? db
          .select({
            userId: sessions.userId,
            latest: sql<Date | null>`max(${sessions.date})`,
            sessionCount: count(sessions.id),
          })
          .from(sessions)
          .where(inArray(sessions.userId, playerIds))
          .groupBy(sessions.userId)
      : Promise.resolve([]),
    playerIds.length
      ? db
          .select({
            playerUserId: coachPlayerInteractions.playerUserId,
            total: count(coachPlayerInteractions.id),
          })
          .from(coachPlayerInteractions)
          .where(
            and(
              eq(coachPlayerInteractions.coachUserId, coachUserId),
              eq(coachPlayerInteractions.status, "open"),
              inArray(coachPlayerInteractions.playerUserId, playerIds),
            ),
          )
          .groupBy(coachPlayerInteractions.playerUserId)
      : Promise.resolve([]),
    Promise.all(
      playerIds.map(async (playerId) => [playerId, await getProductPreferences(playerId)] as const),
    ),
    db
      .select({
        id: coachPlayerInteractions.id,
        playerUserId: coachPlayerInteractions.playerUserId,
        coachUserId: coachPlayerInteractions.coachUserId,
        interactionType: coachPlayerInteractions.interactionType,
        visibility: coachPlayerInteractions.visibility,
        title: coachPlayerInteractions.title,
        body: coachPlayerInteractions.body,
        sessionId: coachPlayerInteractions.sessionId,
        practicePlanId: coachPlayerInteractions.practicePlanId,
        goalReference: coachPlayerInteractions.goalReference,
        evidenceType: coachPlayerInteractions.evidenceType,
        evidenceId: coachPlayerInteractions.evidenceId,
        status: coachPlayerInteractions.status,
        dueAt: coachPlayerInteractions.dueAt,
        completedAt: coachPlayerInteractions.completedAt,
        createdAt: coachPlayerInteractions.createdAt,
        updatedAt: coachPlayerInteractions.updatedAt,
        coachName: users.name,
      })
      .from(coachPlayerInteractions)
      .leftJoin(users, eq(users.id, coachPlayerInteractions.coachUserId))
      .where(
        and(
          eq(coachPlayerInteractions.playerUserId, coachUserId),
          eq(coachPlayerInteractions.visibility, "player_visible"),
        ),
      )
      .orderBy(desc(coachPlayerInteractions.createdAt))
      .limit(30),
  ]);
  const preferenceMap = new Map(playerPreferences);
  const players = rosterRows.map((player) => {
    const activity = activityRows.find((row) => row.userId === player.id);
    return {
      id: player.id,
      name: player.name || player.fallbackName || player.email || "Assigned player",
      email: player.email,
      latestActivity: activity?.latest ?? null,
      sessionCount: Number(activity?.sessionCount ?? 0),
      openActions: Number(openRows.find((row) => row.playerUserId === player.id)?.total ?? 0),
      goal: preferenceMap.get(player.id)?.goals[0] ?? null,
    };
  });
  const selected = players.find((player) => player.id === requestedPlayerId) ?? players[0] ?? null;
  if (!selected) return { players, selected: null, playerDetail: null, playerInbox };

  const [progress, recentSessions, plans, interactions] = await Promise.all([
    getProgressData(selected.id),
    db
      .select({
        id: sessions.id,
        date: sessions.date,
        type: sessions.type,
        source: sessions.source,
        courseName: sessions.courseName,
        fileName: sessions.fileName,
        equipmentNotes: sessions.equipmentNotes,
        shotCount: count(shots.id),
      })
      .from(sessions)
      .leftJoin(shots, and(eq(shots.sessionId, sessions.id), eq(shots.userId, selected.id)))
      .where(eq(sessions.userId, selected.id))
      .groupBy(
        sessions.id,
        sessions.date,
        sessions.type,
        sessions.source,
        sessions.courseName,
        sessions.fileName,
        sessions.equipmentNotes,
      )
      .orderBy(desc(sessions.date))
      .limit(10),
    db
      .select({
        id: practicePlans.id,
        title: practicePlans.title,
        status: practicePlans.status,
        plannedAt: practicePlans.plannedAt,
      })
      .from(practicePlans)
      .where(eq(practicePlans.userId, selected.id))
      .orderBy(desc(practicePlans.plannedAt))
      .limit(10),
    db
      .select()
      .from(coachPlayerInteractions)
      .where(
        and(
          eq(coachPlayerInteractions.coachUserId, coachUserId),
          eq(coachPlayerInteractions.playerUserId, selected.id),
        ),
      )
      .orderBy(desc(coachPlayerInteractions.createdAt))
      .limit(50),
  ]);
  const preferences = preferenceMap.get(selected.id) ?? (await getProductPreferences(selected.id));
  const coach = buildCoachSummary(progress.clubs);
  const openItems = interactions.filter((item) => item.status === "open");
  return {
    players,
    selected,
    playerInbox,
    playerDetail: {
      sessions: recentSessions.map((session) => ({
        ...session,
        shotCount: Number(session.shotCount),
      })),
      plans,
      interactions,
      goals: preferences.goals,
      goal: preferences.goals[0] ?? null,
      priority: coach.clubCards[0] ?? null,
      openAssignment:
        openItems.find((item) => item.interactionType === "practice_assignment") ?? null,
      upcomingReview:
        openItems
          .filter((item) => item.dueAt)
          .sort((left, right) => left.dueAt!.getTime() - right.dueAt!.getTime())[0] ?? null,
    },
  };
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value);
}

function formatSessionType(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
