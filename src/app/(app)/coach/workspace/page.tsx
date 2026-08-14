import Link from "next/link";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import {
  AlertTriangle,
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
import { AppEmptyState } from "@/components/app/app-empty-state";
import { DataWarning, RecommendedAction } from "@/components/app/evidence-status";
import { StatusTimeline } from "@/components/app/status-timeline";
import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
      <div className="grid gap-4">
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
          <Alert>
            <CheckCircle2 className="size-4" aria-hidden />
            <AlertTitle>
              Coach interaction saved with its visibility and evidence reference.
            </AlertTitle>
          </Alert>
        ) : null}
        {params?.error ? (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" aria-hidden />
            <AlertTitle>
              That coach action could not be saved. Check membership, linked evidence and required
              fields.
            </AlertTitle>
          </Alert>
        ) : null}

        {data.players.length && data.selected ? (
          <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <aside aria-labelledby="assigned-players">
              <Card size="sm" className="shadow-sm" data-assigned-player-card>
                <CardHeader>
                  <CardTitle id="assigned-players">Assigned players</CardTitle>
                  <CardDescription>
                    Active coach memberships only · {data.players.length} player
                    {data.players.length === 1 ? "" : "s"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <nav className="grid gap-2" aria-label="Assigned players">
                    {data.players.map((player) => (
                      <Link
                        key={player.id}
                        href={`/coach/workspace?playerId=${player.id}`}
                        aria-current={data.selected?.id === player.id ? "page" : undefined}
                        className="focus-aaa block rounded-xl outline-none"
                      >
                        <Item
                          variant="outline"
                          className={
                            data.selected?.id === player.id
                              ? "border-primary/40 bg-primary/5"
                              : "hover:bg-secondary/60"
                          }
                        >
                          <ItemContent>
                            <ItemTitle>{player.name}</ItemTitle>
                            <ItemDescription>
                              {player.latestActivity
                                ? `Last evidence ${formatDate(player.latestActivity)}`
                                : "No session evidence"}
                            </ItemDescription>
                            <div className="mt-2 flex flex-wrap gap-1">
                              <StatusPill tone={player.openActions > 0 ? "amber" : "green"}>
                                {player.openActions} open
                              </StatusPill>
                              {player.goal ? (
                                <StatusPill tone="sky">
                                  {goalProgress(player.goal)}% goal
                                </StatusPill>
                              ) : null}
                            </div>
                          </ItemContent>
                        </Item>
                      </Link>
                    ))}
                  </nav>
                </CardContent>
              </Card>
            </aside>

            <main className="grid min-w-0 gap-4">
              <Card
                aria-label="Player summary"
                className="gap-0 py-0 shadow-sm"
                data-player-summary-card
              >
                <CardContent className="grid gap-px bg-border p-0 sm:grid-cols-2 xl:grid-cols-4">
                  <SummaryMetric
                    label="Player"
                    value={data.selected.name}
                    detail={data.selected.email ?? "Private profile"}
                  />
                  <SummaryMetric
                    label="Last activity"
                    value={
                      data.selected.latestActivity
                        ? formatDate(data.selected.latestActivity)
                        : "No evidence"
                    }
                    detail={`${data.selected.sessionCount} measured session${data.selected.sessionCount === 1 ? "" : "s"}`}
                  />
                  <SummaryMetric
                    label="Current goal"
                    value={data.playerDetail.goal?.title ?? "No goal set"}
                    detail={
                      data.playerDetail.goal
                        ? `${goalProgress(data.playerDetail.goal)}% · ${data.playerDetail.goal.evidenceSource}`
                        : "Ask the player to define one measurable outcome"
                    }
                  />
                  <SummaryMetric
                    label="Outstanding practice"
                    value={data.playerDetail.openAssignment?.title ?? "Nothing overdue"}
                    detail={
                      data.playerDetail.openAssignment?.dueAt
                        ? `Due ${formatDate(data.playerDetail.openAssignment.dueAt)}`
                        : "Open assignments and evidence requests"
                    }
                  />
                </CardContent>
              </Card>

              <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
                <Card className="shadow-sm" data-current-coaching-read>
                  <CardHeader>
                    <p className="text-sm font-semibold text-primary">Current coaching read</p>
                    <CardTitle className="mt-1 text-2xl">
                      {data.playerDetail.priority
                        ? `${data.playerDetail.priority.clubName}: ${data.playerDetail.priority.issueLabel}`
                        : "Build a measured baseline before assigning a technical change"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-3">
                    <EvidenceItem
                      label="Flagged issue"
                      value={data.playerDetail.priority?.reason ?? "No supported club issue yet"}
                    />
                    <EvidenceItem
                      label="Freshness"
                      value={
                        data.selected.latestActivity
                          ? `Latest session ${formatDate(data.selected.latestActivity)}`
                          : "No imported session"
                      }
                    />
                    <EvidenceItem
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
                <Card className="shadow-sm" data-player-evidence-card>
                  <CardHeader>
                    <CardTitle>Player evidence</CardTitle>
                    <CardDescription>
                      Recent sessions, practice plans, equipment notes and round-review entries.
                    </CardDescription>
                    <CardAction>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/coach/reports?playerId=${data.selected.id}`}>
                          Build report
                        </Link>
                      </Button>
                    </CardAction>
                  </CardHeader>
                  <CardContent>
                    {data.playerDetail.sessions.length ? (
                      <div className="grid gap-2">
                        {data.playerDetail.sessions.map((session) => (
                          <Item key={session.id} variant="outline" className="items-start">
                            <ItemContent>
                              <ItemTitle>
                                {session.courseName ??
                                  session.fileName ??
                                  formatSessionType(session.type)}
                              </ItemTitle>
                              <ItemDescription>
                                {formatDate(session.date)} · {session.source} · {session.shotCount}{" "}
                                shots
                              </ItemDescription>
                              {session.equipmentNotes ? (
                                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                                  {session.equipmentNotes}
                                </p>
                              ) : null}
                            </ItemContent>
                            <ItemActions className="flex-wrap justify-end gap-1">
                              {session.type === "real_round" ? (
                                <StatusPill tone="sky">Round review</StatusPill>
                              ) : null}
                              {session.equipmentNotes ? (
                                <StatusPill tone="amber">Equipment change</StatusPill>
                              ) : null}
                            </ItemActions>
                          </Item>
                        ))}
                      </div>
                    ) : (
                      <AppEmptyState
                        icon={<ClipboardList className="size-5" aria-hidden />}
                        title="No player evidence yet"
                        description="No sessions are available for this assigned player."
                        primaryAction={
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/coach/reports?playerId=${data.selected.id}`}>
                              Prepare report
                            </Link>
                          </Button>
                        }
                        className="shadow-none"
                      />
                    )}
                  </CardContent>
                </Card>

                <form id="add-coach-interaction" action={createCoachInteractionAction}>
                  <Card className="shadow-sm" data-coach-interaction-form-card>
                    <CardHeader>
                      <CardTitle>Add coach interaction</CardTitle>
                      <CardDescription>
                        Private coach note is coach-only. Every other type is player-visible.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                      <input type="hidden" name="playerUserId" value={data.selected.id} />
                      <label className="grid gap-1 text-sm font-semibold">
                        Type and visibility
                        <Select name="interactionType" defaultValue="practice_assignment">
                          <SelectTrigger className="min-h-11 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {coachInteractionTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {coachInteractionTypeLabels[type]} ·{" "}
                                {type === "private_note" ? "Coach only" : "Player visible"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                        <Textarea
                          name="body"
                          rows={5}
                          maxLength={8000}
                          required
                          className="min-h-32"
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
                          <Select name="goalReference" defaultValue="__none__">
                            <SelectTrigger className="min-h-10 w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">No goal link</SelectItem>
                              {data.playerDetail.goals.map((goal) => (
                                <SelectItem key={goal.id} value={goal.id}>
                                  {goal.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </label>
                      </div>
                      <label className="grid gap-1 text-sm font-semibold">
                        Session evidence
                        <Select name="sessionId" defaultValue="__none__">
                          <SelectTrigger className="min-h-10 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">No session link</SelectItem>
                            {data.playerDetail.sessions.map((session) => (
                              <SelectItem key={session.id} value={session.id}>
                                {formatDate(session.date)} · {formatSessionType(session.type)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </label>
                      <label className="grid gap-1 text-sm font-semibold">
                        Practice plan
                        <Select name="practicePlanId" defaultValue="__none__">
                          <SelectTrigger className="min-h-10 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">No plan link</SelectItem>
                            {data.playerDetail.plans.map((plan) => (
                              <SelectItem key={plan.id} value={plan.id}>
                                {plan.title} · {plan.status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </label>
                      <Button type="submit" className="min-h-11 sm:w-fit">
                        <MessageSquareText className="size-4" aria-hidden />
                        Save interaction
                      </Button>
                    </CardContent>
                  </Card>
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
          <AppEmptyState
            icon={<UserRoundCheck className="size-5" aria-hidden />}
            title="No assigned players yet"
            description="A player must explicitly add you as a coach before their evidence appears here. Selective reports remain available without granting account membership."
            primaryAction={
              <Button asChild variant="outline">
                <Link href="/coach/reports">Open selective reports</Link>
              </Button>
            }
          />
        )}

        <InteractionTimeline
          title="My player-visible coach inbox"
          interactions={data.playerInbox}
          mode="player"
        />
      </div>
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
    <Card className="shadow-sm" aria-labelledby={`${mode}-interactions`} data-interaction-timeline>
      <CardHeader>
        <CardTitle id={`${mode}-interactions`} className="flex items-center gap-2">
          <ClipboardList className="size-5 text-primary" aria-hidden />
          {title}
        </CardTitle>
        <CardDescription>
          {mode === "coach"
            ? "Private notes, player-visible actions and linked evidence in date order."
            : "Feedback and assignments shared with your player account."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <StatusTimeline
          label={title}
          items={interactions.map((item) => ({
            id: item.id,
            dateGroup: formatDate(item.createdAt),
            timestamp: `${
              coachInteractionTypeLabels[item.interactionType as CoachInteractionType] ??
              item.interactionType
            }${item.coachName ? ` · ${item.coachName}` : ""}`,
            title: item.title,
            description: <p className="whitespace-pre-wrap text-foreground">{item.body}</p>,
            meta: (
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
                {item.dueAt ? <span>Due {formatDate(item.dueAt)}</span> : null}
                {item.sessionId ? <span>Session evidence linked</span> : null}
                {item.practicePlanId ? <span>Practice plan linked</span> : null}
                {item.goalReference ? <span>Goal linked</span> : null}
              </div>
            ),
            status: `${coachInteractionStatusLabel(item.status)} · ${
              item.visibility === "coach_only" ? "Coach only" : "Player visible"
            }`,
            kind:
              item.status === "completed"
                ? ("reviewed" as const)
                : item.status === "open"
                  ? ("warning" as const)
                  : undefined,
            icon: item.visibility === "coach_only" ? EyeOff : Eye,
            action: interactionAction(item, mode, playerUserId),
          }))}
          empty={
            <AppEmptyState
              icon={<ClipboardList className="size-5" aria-hidden />}
              title={mode === "coach" ? "No coach interactions yet" : "No shared coach actions"}
              description={
                mode === "coach"
                  ? "No coach interactions have been recorded for this player."
                  : "No player-visible coach feedback or assignments are waiting."
              }
              primaryAction={
                mode === "coach" ? (
                  <Button asChild variant="outline" size="sm">
                    <a href="#add-coach-interaction">Add first interaction</a>
                  </Button>
                ) : (
                  <Button asChild variant="outline" size="sm">
                    <Link href="/coach">Open coach overview</Link>
                  </Button>
                )
              }
              className="shadow-none"
            />
          }
        />
      </CardContent>
    </Card>
  );
}

function interactionAction(
  item: WorkspaceInteraction,
  mode: "coach" | "player",
  playerUserId?: string,
) {
  if (mode === "coach" && playerUserId && item.status === "open") {
    return (
      <div className="flex flex-wrap gap-2">
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
      </div>
    );
  }

  if (mode === "player" && interactionNeedsAction(item.interactionType, item.status)) {
    return (
      <form action={completePlayerInteractionAction}>
        <input type="hidden" name="interactionId" value={item.id} />
        <Button type="submit" size="sm" variant="outline">
          <CheckCircle2 className="size-4" aria-hidden />
          Mark complete
        </Button>
      </form>
    );
  }

  return undefined;
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

function SummaryMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0 bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-semibold">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

function EvidenceItem({ label, value }: { label: string; value: string }) {
  return (
    <Item variant="muted" className="items-start">
      <ItemContent>
        <ItemTitle className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </ItemTitle>
        <ItemDescription className="mt-2 whitespace-normal text-sm leading-6 text-foreground">
          {value}
        </ItemDescription>
      </ItemContent>
    </Item>
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
