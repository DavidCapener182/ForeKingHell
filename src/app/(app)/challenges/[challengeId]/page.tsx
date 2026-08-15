import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  MessageCircle,
  Plus,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";

import {
  addChallengeCommentAction,
  inviteFriendToChallengeAction,
  joinChallengeAction,
} from "@/app/challenges/actions";
import { ChallengeJoinDialog } from "@/app/challenges/challenge-join-dialog";
import { ChallengeLeaveDialog } from "@/app/challenges/challenge-leave-dialog";
import { StatusTimeline } from "@/components/app/status-timeline";
import type {
  DesktopSavedViewSuggestion,
  DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import {
  DataPanel,
  DataTableFrame,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
} from "@/components/app/ios-mobile";
import { MobilePageTabs } from "@/components/app/mobile-controls";
import {
  BottomSheet,
  MobileAppShell,
  MobileStatusAction,
  MobileTopBar,
  NativeListSection,
} from "@/components/mobile-sports";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getChallengeDetailData } from "@/lib/challenges";
import { getRequestAppSurface } from "@/lib/app-surface-server";

export const dynamic = "force-dynamic";

type ChallengePageProps = {
  params: Promise<{
    challengeId: string;
  }>;
  searchParams?: Promise<{
    invite?: string;
    tab?: string;
  }>;
};

type ChallengeDetail = NonNullable<Awaited<ReturnType<typeof getChallengeDetailData>>>;
type ChallengeResultRow = ChallengeDetail["results"][number];

const challengeLeaderboardColumns: DesktopWorkbenchColumn[] = [
  { id: "rank", label: "Rank", locked: true },
  { id: "player", label: "Player" },
  { id: "score", label: "Score" },
  { id: "verification", label: "Verification" },
  { id: "calculated", label: "Calculated" },
  { id: "action", label: "Action", locked: true },
];

export default async function ChallengePage({ params, searchParams }: ChallengePageProps) {
  const [{ challengeId }, query] = await Promise.all([params, searchParams]);
  const [data, surface] = await Promise.all([
    getChallengeDetailData(challengeId),
    getRequestAppSurface(),
  ]);

  if (!data) {
    notFound();
  }

  const workbench =
    surface === "workbench" ? await import("@/components/app/desktop-workbench") : null;
  const DesktopWorkbenchLayout = workbench?.DesktopWorkbenchLayout;

  const podium = data.results.slice(0, 3);
  const viewerResult = data.results.find((row) => row.result.userId === data.viewerUserId);
  const verificationMode = boardVerificationMode(data.results.map((row) => row.verificationLabel));
  const activeTab = parseChallengeDetailTab(query?.tab);

  return (
    <PageShell>
      {surface === "companion" ? (
        <MobileAppShell>
          <MobileTopBar
            title={data.challenge.title}
            actions={<Badge variant="outline">{data.challenge.templateName}</Badge>}
          />
          <MobileStatusAction
            label="Imported result"
            value={viewerResult ? `#${viewerResult.result.rank}` : "No qualifying shots"}
            detail={
              viewerResult
                ? `${viewerResult.result.scoreLabel} · ${viewerResult.verificationLabel}`
                : `${data.challenge.participantCount} players · ${verificationMode}`
            }
            action={
              !data.challenge.viewerJoined ? (
                <form action={joinChallengeAction}>
                  <input type="hidden" name="challengeId" value={data.challenge.id} />
                  <Button type="submit" className="rounded-full">
                    <Plus className="size-4" />
                    Join
                  </Button>
                </form>
              ) : (
                <Button asChild className="rounded-full">
                  <Link href="/import" prefetch={false}>
                    Import data
                  </Link>
                </Button>
              )
            }
          />
          <section className="ios-grouped-list p-4">
            <p className="text-sm font-semibold text-primary">Challenge</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-normal">{data.challenge.title}</h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              {data.challenge.rulesSummary}
            </p>
          </section>
          {query?.invite ? (
            <IOSInlineStatus label="Invite sent" tone="positive" className="px-1" />
          ) : null}
          <MobileChallengeSections
            data={data}
            activeTab={activeTab}
            viewerResult={viewerResult}
            podium={podium}
          />
        </MobileAppShell>
      ) : null}

      {surface === "workbench" && DesktopWorkbenchLayout ? (
        <DesktopWorkbenchLayout scope="challenge-detail">
          <div className="flex items-center justify-between gap-3">
            <Button asChild variant="ghost" className="px-0">
              <Link href="/challenges" prefetch={false}>
                <ArrowLeft className="size-4" />
                Challenges
              </Link>
            </Button>
            <Badge variant="outline">{data.challenge.templateName}</Badge>
          </div>

          <PageHeader
            eyebrow={<StatusPill tone="amber">Challenge</StatusPill>}
            title={data.challenge.title}
            description={data.challenge.description ?? data.challenge.coachNote}
            metrics={[
              {
                label: "Participants",
                value: data.challenge.participantCount,
                detail: "Joined entries",
              },
              {
                label: "Visibility",
                value: titleCase(data.challenge.visibility),
                detail: "Private friend-safe scope",
              },
              {
                label: "Your rank",
                value: data.challenge.viewerRank ? `#${data.challenge.viewerRank}` : "--",
                detail: "From imported shots",
              },
              {
                label: "Scoring",
                value: data.challenge.scoringDirection === "desc" ? "High wins" : "Low wins",
                detail: "Automatic from imports",
              },
            ]}
          />

          {query?.invite ? (
            <Badge variant="secondary" className="w-fit">
              Invite sent
            </Badge>
          ) : null}

          <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Challenge views">
            <Anchor href="#board" label="Board" />
            <Anchor href="#challenge-command" label="Command board" />
            <Sheet>
              <span id="rules" className="scroll-mt-28">
                <SheetTrigger
                  type="button"
                  data-variant="outline"
                  data-size="sm"
                  className={buttonVariants({
                    variant: "outline",
                    size: "sm",
                    className: "min-h-11 rounded-xl",
                  })}
                >
                  <ShieldCheck className="size-4" />
                  Rules
                </SheetTrigger>
              </span>
              <SheetContent className="overflow-y-auto sm:max-w-lg">
                <SheetHeader>
                  <SheetTitle>Challenge rules</SheetTitle>
                  <SheetDescription>{data.challenge.rulesSummary}</SheetDescription>
                </SheetHeader>
                <div className="grid gap-3 px-4 pb-4">
                  {data.challenge.rulesBullets.map((rule) => (
                    <div key={rule} className="rounded-lg border bg-card p-3 text-sm leading-5">
                      {rule}
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">Imported shots only</Badge>
                    <Badge variant="outline">Active window only</Badge>
                    <Badge variant="outline">Auto-scored board</Badge>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            <Anchor href="#challenge-attempts" label="Attempts" />
            <Anchor href="#chat" label="Chat" />
            {data.challenge.creatorUserId === data.viewerUserId ? (
              <Button asChild variant="outline" size="sm" className="min-h-11 shrink-0 rounded-xl">
                <Link href={`/tournaments?fromChallenge=${data.challenge.id}`} prefetch={false}>
                  Convert to tournament
                </Link>
              </Button>
            ) : null}
          </nav>

          <section
            id="board"
            className="grid scroll-mt-28 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]"
          >
            <Card className="gap-0 py-0">
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 p-5 pb-0">
                <div>
                  <StatusPill tone="green">Event board</StatusPill>
                  <h2 className="mt-3 text-2xl font-semibold tracking-normal">Podium</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Imported shots inside the challenge window decide this board. Full rankings stay
                    below for dense review.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <ShieldCheck className="size-3" />
                    {verificationMode}
                  </Badge>
                  {data.challenge.endsAt ? (
                    <Badge variant="outline" className="gap-1">
                      <CalendarDays className="size-3" />
                      Ends {formatDate(data.challenge.endsAt)}
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {podium.length === 0 ? (
                    <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground md:col-span-3">
                      No qualifying imported shots yet. New imports during the active window will
                      update this board automatically.
                    </p>
                  ) : (
                    podium.map((row) => <PodiumCard key={row.result.id} row={row} />)
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="gap-0 py-0">
              <CardHeader className="p-4 pb-0">
                <CardTitle className="text-sm font-semibold">Your imported result</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {viewerResult ? (
                  <div className="mt-3 rounded-lg bg-muted/55 p-4">
                    <Badge variant="secondary">Rank #{viewerResult.result.rank}</Badge>
                    <p className="mt-3 text-2xl font-semibold tracking-normal">
                      {viewerResult.result.scoreLabel}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {viewerResult.verificationLabel}
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    {data.challenge.viewerJoined
                      ? "No qualifying imported shots yet. Import shots during the active window and the board will update automatically."
                      : "Join the challenge to have your qualifying imports counted on this board."}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {!data.challenge.viewerJoined ? (
                    <ChallengeJoinDialog
                      challengeId={data.challenge.id}
                      challengeTitle={data.challenge.title}
                      size="default"
                    />
                  ) : null}
                  <Button asChild variant="outline">
                    <Link href="/import" prefetch={false}>
                      Import data
                    </Link>
                  </Button>
                  {data.challenge.viewerJoined &&
                  data.challenge.creatorUserId !== data.viewerUserId ? (
                    <ChallengeLeaveDialog
                      challengeId={data.challenge.id}
                      challengeTitle={data.challenge.title}
                    />
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </section>

          <ChallengeCommandTables data={data} verificationMode={verificationMode} />

          <section className="grid gap-4 lg:grid-cols-[0.34fr_0.66fr]">
            <div className="grid gap-4">
              <DataPanel id="imported-shots">
                <SectionHeader
                  title="Imported shot status"
                  description="Challenge results are calculated from qualifying imports only."
                  action={<ShieldCheck className="size-5 text-primary" />}
                />
                <CardContent className="grid gap-3 text-sm">
                  <p className="rounded-lg border bg-muted/55 p-3 text-muted-foreground">
                    {data.challenge.rulesSummary}
                  </p>
                  {!data.challenge.viewerJoined ? (
                    <form action={joinChallengeAction}>
                      <input type="hidden" name="challengeId" value={data.challenge.id} />
                      <Button type="submit" className="rounded-lg">
                        <Plus className="size-4" />
                        Join challenge
                      </Button>
                    </form>
                  ) : (
                    <Button asChild variant="outline" className="rounded-xl">
                      <Link href="/import" prefetch={false}>
                        Open import
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </DataPanel>

              <DataPanel>
                <SectionHeader
                  title="Invite friends"
                  description="Invite links keep friend challenges scoped without granting account access."
                  action={<Users className="size-5 text-[var(--status-information-foreground)]" />}
                />
                <CardContent>
                  {data.friendOptions.length > 0 ? (
                    <form action={inviteFriendToChallengeAction} className="grid gap-3">
                      <input type="hidden" name="challengeId" value={data.challenge.id} />
                      <Select name="inviteeUserId" defaultValue={data.friendOptions[0]?.userId}>
                        <SelectTrigger className="h-10 w-full" aria-label="Friend to invite">
                          <SelectValue placeholder="Select a friend" />
                        </SelectTrigger>
                        <SelectContent>
                          {data.friendOptions.map((friend) => (
                            <SelectItem key={friend.userId} value={friend.userId}>
                              {friend.displayName} (@{friend.username})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="submit" variant="outline">
                        <Send className="size-4" />
                        Invite
                      </Button>
                    </form>
                  ) : (
                    <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                      Add friends before sending challenge invites.
                    </p>
                  )}
                </CardContent>
              </DataPanel>
            </div>

            <div className="grid gap-4">
              <section className="grid gap-4 md:grid-cols-2">
                <Card id="chat" className="premium-card scroll-mt-28">
                  <CardHeader>
                    <CardTitle>Comments</CardTitle>
                    <CardDescription>
                      Keep challenge talk attached to the challenge.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    {data.comments.map((comment) => (
                      <div key={comment.id} className="rounded-lg border bg-card px-3 py-2 text-sm">
                        <Link
                          href={`/profile/${comment.profile.username}`}
                          prefetch={false}
                          className="font-medium hover:underline"
                        >
                          {comment.profile.displayName}
                        </Link>
                        <p className="text-muted-foreground">{comment.body}</p>
                      </div>
                    ))}
                    <form action={addChallengeCommentAction} className="grid gap-2">
                      <input type="hidden" name="challengeId" value={data.challenge.id} />
                      <Input
                        name="body"
                        placeholder="Add a comment"
                        className="h-9 rounded-xl bg-background"
                      />
                      <Button type="submit" variant="outline">
                        <MessageCircle className="size-4" />
                        Comment
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </section>
            </div>
          </section>
        </DesktopWorkbenchLayout>
      ) : null}
    </PageShell>
  );
}

function MobileChallengeSections({
  data,
  activeTab,
  viewerResult,
  podium,
}: {
  data: ChallengeDetail;
  activeTab: "board" | "rules" | "shots" | "chat";
  viewerResult: ChallengeResultRow | undefined;
  podium: ChallengeResultRow[];
}) {
  const baseHref = `/challenges/${data.challenge.id}`;

  return (
    <MobilePageTabs
      initialValue={activeTab}
      ariaLabel="Challenge sections"
      tabs={[
        {
          value: "board",
          label: "Board",
          href: baseHref,
          content: (
            <NativeListSection
              title="Leaderboard"
              description={
                viewerResult
                  ? `You are #${viewerResult.result.rank} · ${viewerResult.result.scoreLabel}`
                  : "No qualifying imported shots yet"
              }
            >
              <IOSGroupedList label="Challenge podium">
                {podium.length > 0 ? (
                  podium.map((row) => (
                    <IOSListRow
                      key={row.result.userId}
                      label={`${row.result.rank}. ${row.profile.displayName}`}
                      value={row.result.scoreLabel}
                      detail={row.verificationLabel}
                      href={`/profile/${row.profile.username}`}
                    />
                  ))
                ) : (
                  <IOSListRow
                    label="No leaderboard result yet"
                    detail="Qualifying imported shots will populate this board automatically."
                  />
                )}
              </IOSGroupedList>
              {data.results.length > 3 ? (
                <IOSDisclosureGroup
                  label="Full challenge leaderboard"
                  items={[
                    {
                      value: "full-board",
                      title: "Full leaderboard",
                      summary: `${data.results.length}`,
                      description: "Every qualifying result",
                      content: (
                        <IOSGroupedList label="All challenge leaderboard results">
                          {data.results.map((row) => (
                            <IOSListRow
                              key={row.result.userId}
                              label={`${row.result.rank}. ${row.profile.displayName}`}
                              value={row.result.scoreLabel}
                              detail={row.verificationLabel}
                              href={`/profile/${row.profile.username}`}
                            />
                          ))}
                        </IOSGroupedList>
                      ),
                    },
                  ]}
                />
              ) : null}
              <ChallengeInviteSheet data={data} />
            </NativeListSection>
          ),
        },
        {
          value: "rules",
          label: "Rules",
          href: `${baseHref}?tab=rules`,
          content: (
            <NativeListSection title="Rules" description={data.challenge.rulesSummary}>
              <IOSGroupedList label="Challenge rules">
                {data.challenge.rulesBullets.map((rule) => (
                  <IOSListRow
                    key={rule}
                    label={rule}
                    leading={<ShieldCheck className="size-5 shrink-0 text-primary" aria-hidden />}
                  />
                ))}
              </IOSGroupedList>
            </NativeListSection>
          ),
        },
        {
          value: "shots",
          label: "Attempts",
          href: `${baseHref}?tab=shots`,
          content: (
            <NativeListSection
              title="Attempt timeline"
              description="Every qualifying imported attempt, in the order it reached the challenge."
            >
              <StatusTimeline
                label="Challenge attempt timeline"
                items={data.attempts.map((row) => challengeAttemptTimelineItem(row))}
                empty={
                  <p className="text-sm text-muted-foreground">
                    No qualifying attempts yet. Import shots during the active window to start the
                    timeline.
                  </p>
                }
              />
            </NativeListSection>
          ),
        },
        {
          value: "chat",
          label: "Chat",
          href: `${baseHref}?tab=chat`,
          content: (
            <NativeListSection title="Chat">
              <IOSGroupedList label="Challenge comments">
                {data.comments.length > 0 ? (
                  data.comments.map((comment) => (
                    <IOSListRow
                      key={comment.id}
                      label={comment.profile.displayName}
                      detail={comment.body}
                      href={`/profile/${comment.profile.username}`}
                    />
                  ))
                ) : (
                  <IOSListRow
                    label="No comments yet"
                    detail="Start the challenge conversation below."
                  />
                )}
              </IOSGroupedList>
              <form action={addChallengeCommentAction} className="grid gap-2">
                <input type="hidden" name="challengeId" value={data.challenge.id} />
                <Input
                  name="body"
                  placeholder="Add a comment"
                  className="h-11 rounded-xl bg-card text-base"
                />
                <Button type="submit" variant="outline" className="min-h-11 rounded-xl">
                  Comment
                </Button>
              </form>
            </NativeListSection>
          ),
        },
      ]}
    />
  );
}

type PodiumRow = NonNullable<Awaited<ReturnType<typeof getChallengeDetailData>>>["results"][number];

function ChallengeInviteSheet({ data }: { data: ChallengeDetail }) {
  return (
    <BottomSheet
      label={
        <>
          <Send className="size-4" aria-hidden />
          Invite a friend
        </>
      }
      title="Invite to this challenge"
      triggerClassName="min-h-11 w-full rounded-xl border border-border bg-card text-foreground"
    >
      {data.friendOptions.length > 0 ? (
        <form
          action={inviteFriendToChallengeAction}
          className="grid gap-4 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <input type="hidden" name="challengeId" value={data.challenge.id} />
          <label className="grid gap-1.5 text-sm font-semibold">
            Friend
            <Select name="inviteeUserId" defaultValue={data.friendOptions[0]?.userId}>
              <SelectTrigger className="min-h-11 w-full" aria-label="Friend to invite">
                <SelectValue placeholder="Select a friend" />
              </SelectTrigger>
              <SelectContent>
                {data.friendOptions.map((friend) => (
                  <SelectItem key={friend.userId} value={friend.userId}>
                    {friend.displayName} (@{friend.username})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <Button type="submit" className="min-h-11 rounded-xl">
            <Send className="size-4" aria-hidden />
            Send invitation
          </Button>
        </form>
      ) : (
        <div className="grid gap-3 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <p className="text-sm leading-6 text-muted-foreground">
            Add friends before sending a private challenge invitation.
          </p>
          <Button asChild variant="outline" className="min-h-11 rounded-xl">
            <Link href="/friends" prefetch={false}>
              Open Friends
            </Link>
          </Button>
        </div>
      )}
    </BottomSheet>
  );
}

function ChallengeCommandTables({
  data,
  verificationMode,
}: {
  data: ChallengeDetail;
  verificationMode: string;
}) {
  return (
    <section id="challenge-command" className="grid scroll-mt-28 gap-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-normal">Challenge command board</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            The leaderboard and chronological attempt trail come from the same qualifying imports
            that decide the podium.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill tone={data.results.length > 0 ? "green" : "slate"}>
            {data.results.length} ranked
          </StatusPill>
          <StatusPill tone={data.attempts.length > 0 ? "amber" : "slate"}>
            {data.attempts.length} attempts
          </StatusPill>
        </div>
      </div>

      <ChallengeLeaderboardTable data={data} verificationMode={verificationMode} />
      <section
        id="challenge-attempts"
        className="scroll-mt-28 rounded-xl border bg-card p-4"
        data-challenge-attempt-timeline
      >
        <div className="mb-4">
          <p className="font-semibold">Attempt history</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Recent qualifying imports in chronological context.
          </p>
        </div>
        <StatusTimeline
          label="Challenge attempt history"
          items={data.attempts.map((row) => challengeAttemptTimelineItem(row))}
          empty={
            <p className="text-sm text-muted-foreground">
              No qualifying attempts have arrived yet.
            </p>
          }
        />
      </section>
    </section>
  );
}

async function ChallengeLeaderboardTable({
  data,
  verificationMode,
}: {
  data: ChallengeDetail;
  verificationMode: string;
}) {
  const { DesktopTableWorkbenchControls } = await import("@/components/app/desktop-workbench");
  const suggestedViews = challengeLeaderboardSuggestedViews(data.challenge.id);

  return (
    <section className="grid gap-3" data-workbench-scope="challenge-leaderboard">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Full leaderboard</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Template scoring direction, best imported result per player and verification state.
          </p>
        </div>
        <StatusPill tone={data.results.length > 0 ? "green" : "slate"}>
          {verificationMode}
        </StatusPill>
      </div>

      <DesktopTableWorkbenchControls
        viewKey={`challenge-leaderboard-${data.challenge.id}`}
        scope="challenge-leaderboard"
        currentViewLabel={`${data.challenge.title} leaderboard`}
        resultLabel={`${data.results.length} ranked players`}
        columns={challengeLeaderboardColumns}
        suggestedViews={suggestedViews}
        exportTableId="challenge-leaderboard"
        exportFileName={`forekinghell-challenge-${data.challenge.id}-leaderboard.csv`}
      />

      <DataTableFrame mainTable mainTableLabel="Challenge leaderboard table" stickyFirstColumn>
        <Table
          data-workbench-export-table="challenge-leaderboard"
          aria-describedby="challenge-leaderboard-summary"
        >
          <TableCaption id="challenge-leaderboard-summary" className="sr-only">
            Challenge leaderboard table showing rank, player, score, verification, calculation time
            and action.
          </TableCaption>
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-muted">
            <TableRow>
              <TableHead
                data-column="rank"
                className="sticky left-0 z-20 min-w-24 bg-muted shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
              >
                Rank
              </TableHead>
              <TableHead data-column="player">Player</TableHead>
              <TableHead data-column="score" className="text-right">
                Score
              </TableHead>
              <TableHead data-column="verification">Verification</TableHead>
              <TableHead data-column="calculated">Calculated</TableHead>
              <TableHead data-column="action" className="text-right">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.results.length > 0 ? (
              data.results.map((row) => <ChallengeLeaderboardRow key={row.result.id} row={row} />)
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  No qualifying imported shots yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DataTableFrame>
    </section>
  );
}

function ChallengeLeaderboardRow({ row }: { row: ChallengeResultRow }) {
  return (
    <TableRow tabIndex={0} className="focus-aaa outline-none">
      <TableCell
        data-column="rank"
        className="sticky left-0 z-10 min-w-24 bg-card shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
      >
        <Badge variant={row.result.rank === 1 ? "default" : "outline"}>
          {row.result.rank ? `#${row.result.rank}` : "--"}
        </Badge>
      </TableCell>
      <TableCell data-column="player">
        <Link
          href={`/profile/${row.profile.username}`}
          prefetch={false}
          className="font-semibold text-primary hover:underline"
        >
          {row.profile.displayName}
        </Link>
        <p className="mt-1 text-xs text-muted-foreground">@{row.profile.username}</p>
      </TableCell>
      <TableCell data-column="score" className="text-right font-semibold">
        {row.result.scoreLabel}
      </TableCell>
      <TableCell data-column="verification">{row.verificationLabel}</TableCell>
      <TableCell data-column="calculated">
        {challengeDateTimeFormatter.format(row.result.calculatedAt)}
      </TableCell>
      <TableCell data-column="action" className="text-right">
        <Button asChild variant="outline" size="sm">
          <Link href={`/profile/${row.profile.username}`} prefetch={false}>
            Open profile
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}

function PodiumCard({ row }: { row: PodiumRow }) {
  const rank = row.result.rank ?? 0;

  return (
    <article
      className={
        rank === 1
          ? "rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] p-4"
          : "rounded-lg border bg-muted/55 p-4"
      }
    >
      <Badge variant={rank === 1 ? "default" : "outline"}>#{rank || "--"}</Badge>
      <Link
        href={`/profile/${row.profile.username}`}
        prefetch={false}
        className="mt-3 block text-lg font-semibold tracking-normal hover:underline"
      >
        {row.profile.displayName}
      </Link>
      <p className="mt-1 text-2xl font-semibold tracking-normal">{row.result.scoreLabel}</p>
      <p className="mt-1 text-sm text-muted-foreground">{row.verificationLabel}</p>
    </article>
  );
}

function boardVerificationMode(labels: string[]) {
  if (labels.length === 0) {
    return "Awaiting imports";
  }

  return "Import-scored board";
}

const challengeDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(value);
}

function titleCase(value: string) {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function challengeLeaderboardSuggestedViews(challengeId: string): DesktopSavedViewSuggestion[] {
  return [
    {
      title: "Leaderboard",
      href: `/challenges/${challengeId}#challenge-command`,
      detail: "Full ranking, score and verification evidence.",
    },
    {
      title: "Attempt timeline",
      href: `/challenges/${challengeId}#challenge-attempts`,
      detail: "Qualifying evidence in chronological order.",
    },
    {
      title: "Challenge centre",
      href: "/challenges",
      detail: "Active, invited and recommended challenge boards.",
    },
  ];
}

function scoreDisplay(value: number) {
  return value.toFixed(1);
}

function attemptScoreLabel(attempt: { metricLabel: string; metricValue: number }) {
  switch (attempt.metricLabel) {
    case "Total distance":
      return `${scoreDisplay(attempt.metricValue)} yd`;
    case "Offline miss":
      return `${scoreDisplay(attempt.metricValue)} yd offline`;
    case "Average error":
    case "Distance to pin":
      return `${scoreDisplay(attempt.metricValue)} yd error`;
    case "Carry spread":
      return `${scoreDisplay(attempt.metricValue)} yd spread`;
    case "Practice days":
      return `${Math.round(attempt.metricValue)} days`;
    default:
      return scoreDisplay(attempt.metricValue);
  }
}

function attemptMetadataLabel(metadata: Record<string, unknown>) {
  const shotCount = typeof metadata.shotCount === "number" ? metadata.shotCount : null;
  const sessionCount = typeof metadata.sessionCount === "number" ? metadata.sessionCount : null;

  if (shotCount && sessionCount) {
    return `${shotCount} imported shots · ${sessionCount} session${sessionCount === 1 ? "" : "s"}`;
  }

  if (shotCount) {
    return `${shotCount} imported shots`;
  }

  return "Imported shots";
}

function challengeAttemptTimelineItem(row: ChallengeDetail["attempts"][number]) {
  return {
    id: row.attempt.id,
    timestamp: challengeDateTimeFormatter.format(row.attempt.attemptedAt),
    title: `${row.profile.displayName} · ${attemptScoreLabel(row.attempt)}`,
    description: `${titleCase(row.attempt.sourceType)} · ${attemptMetadataLabel(row.attempt.metadataJson)}`,
    status: row.attempt.verificationLabel,
    kind: "import" as const,
    href: `/profile/${row.profile.username}`,
  };
}

function Anchor({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="inline-flex min-h-11 shrink-0 items-center rounded-xl border bg-card px-3 text-sm font-semibold"
    >
      {label}
    </a>
  );
}

function parseChallengeDetailTab(value?: string) {
  if (value === "rules" || value === "shots" || value === "chat") {
    return value;
  }

  return "board";
}
