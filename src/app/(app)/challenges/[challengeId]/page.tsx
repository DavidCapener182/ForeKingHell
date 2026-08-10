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
import {
  DesktopTableWorkbenchControls,
  DesktopWorkbenchLayout,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
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
import {
  BottomSheet,
  MobileAppShell,
  MobileStatusAction,
  MobileTabBar,
  MobileTopBar,
  NativeListSection,
} from "@/components/mobile-sports";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
type ChallengeAttemptEntry = ChallengeDetail["attempts"][number];

const challengeLeaderboardColumns: DesktopWorkbenchColumn[] = [
  { id: "rank", label: "Rank", locked: true },
  { id: "player", label: "Player" },
  { id: "score", label: "Score" },
  { id: "verification", label: "Verification" },
  { id: "calculated", label: "Calculated" },
  { id: "action", label: "Action", locked: true },
];

const challengeAttemptColumns: DesktopWorkbenchColumn[] = [
  { id: "player", label: "Player", locked: true },
  { id: "metric", label: "Metric" },
  { id: "source", label: "Source" },
  { id: "verification", label: "Verification" },
  { id: "evidence", label: "Evidence" },
  { id: "attempted", label: "Attempted" },
  { id: "action", label: "Action", locked: true },
];

export default async function ChallengePage({ params, searchParams }: ChallengePageProps) {
  const [{ challengeId }, query] = await Promise.all([params, searchParams]);
  const data = await getChallengeDetailData(challengeId);

  if (!data) {
    notFound();
  }

  const podium = data.results.slice(0, 3);
  const viewerResult = data.results.find((row) => row.result.userId === data.viewerUserId);
  const verificationMode = boardVerificationMode(data.results.map((row) => row.verificationLabel));
  const activeTab = parseChallengeDetailTab(query?.tab);

  return (
    <PageShell>
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
                <Button type="submit" className="rounded-full bg-[#0B7A3B] text-white">
                  <Plus className="size-4" />
                  Join
                </Button>
              </form>
            ) : (
              <Button asChild className="rounded-full bg-[#0B7A3B] text-white">
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
        <MobileTabBar
          activeKey={activeTab}
          tabs={[
            { key: "board", label: "Board", href: `/challenges/${data.challenge.id}` },
            { key: "rules", label: "Rules", href: `/challenges/${data.challenge.id}?tab=rules` },
            { key: "shots", label: "Shots", href: `/challenges/${data.challenge.id}?tab=shots` },
            { key: "chat", label: "Chat", href: `/challenges/${data.challenge.id}?tab=chat` },
          ]}
        />
        {query?.invite ? (
          <IOSInlineStatus label="Invite sent" tone="positive" className="px-1" />
        ) : null}
        {activeTab === "rules" ? (
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
        ) : activeTab === "shots" ? (
          <NativeListSection
            title="Imported shots"
            description="This board is calculated from qualifying imported shots. New imports update it automatically."
          >
            <IOSGroupedList label="Recent qualifying challenge shots">
              {data.attempts.length > 0 ? (
                data.attempts
                  .slice(0, 8)
                  .map(({ attempt, profile }) => (
                    <IOSListRow
                      key={attempt.id}
                      label={profile.displayName}
                      value={attemptScoreLabel(attempt)}
                      detail={`${attempt.verificationLabel} · ${attemptMetadataLabel(attempt.metadataJson)}`}
                      href={`/profile/${profile.username}`}
                    />
                  ))
              ) : (
                <IOSListRow
                  label="No qualifying imported shots yet"
                  detail="Import shots during the challenge window and they will appear automatically."
                />
              )}
            </IOSGroupedList>
            {data.attempts.length > 8 ? (
              <IOSDisclosureGroup
                label="Older challenge attempts"
                items={[
                  {
                    value: "older-attempts",
                    title: "Older qualifying shots",
                    summary: `${data.attempts.length - 8}`,
                    content: (
                      <IOSGroupedList label="Older qualifying challenge shots">
                        {data.attempts.slice(8).map(({ attempt, profile }) => (
                          <IOSListRow
                            key={attempt.id}
                            label={profile.displayName}
                            value={attemptScoreLabel(attempt)}
                            detail={`${attempt.verificationLabel} · ${attemptMetadataLabel(attempt.metadataJson)}`}
                            href={`/profile/${profile.username}`}
                          />
                        ))}
                      </IOSGroupedList>
                    ),
                  },
                ]}
              />
            ) : null}
          </NativeListSection>
        ) : activeTab === "chat" ? (
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
        ) : (
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
        )}
      </MobileAppShell>

      <DesktopWorkbenchLayout scope="challenge-detail" className="hidden lg:grid">
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
          <Anchor href="#rules" label="Rules" />
          <Anchor href="#imported-shots" label="Imported shots" />
          <Anchor href="#chat" label="Chat" />
          {data.challenge.creatorUserId === data.viewerUserId ? (
            <Button asChild variant="outline" size="sm" className="min-h-11 shrink-0 rounded-xl">
              <Link href={`/tournaments?fromChallenge=${data.challenge.id}`} prefetch={false}>
                Convert to tournament
              </Link>
            </Button>
          ) : null}
        </nav>

        <section id="board" className="grid scroll-mt-28 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <article className="premium-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
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
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {podium.length === 0 ? (
                <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground md:col-span-3">
                  No qualifying imported shots yet. New imports during the active window will update
                  this board automatically.
                </p>
              ) : (
                podium.map((row) => <PodiumCard key={row.result.id} row={row} />)
              )}
            </div>
          </article>

          <article className="premium-card p-4">
            <p className="text-sm font-semibold">Your imported result</p>
            {viewerResult ? (
              <div className="mt-3 rounded-lg bg-[#F5F6F4] p-4">
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
                <form action={joinChallengeAction}>
                  <input type="hidden" name="challengeId" value={data.challenge.id} />
                  <Button type="submit">
                    <Plus className="size-4" />
                    Join
                  </Button>
                </form>
              ) : null}
              <Button asChild variant="outline">
                <Link href="/import" prefetch={false}>
                  Import data
                </Link>
              </Button>
            </div>
          </article>
        </section>

        <ChallengeCommandTables data={data} verificationMode={verificationMode} />

        <section className="grid gap-4 lg:grid-cols-[0.34fr_0.66fr]">
          <div className="grid gap-4">
            <DataPanel id="imported-shots">
              <SectionHeader
                title="Imported shot status"
                description="Challenge results are calculated from qualifying imports only."
                action={<ShieldCheck className="size-5 text-emerald-600" />}
              />
              <CardContent className="grid gap-3 text-sm">
                <p className="rounded-lg border bg-[#F5F6F4] p-3 text-muted-foreground">
                  {data.challenge.rulesSummary}
                </p>
                {!data.challenge.viewerJoined ? (
                  <form action={joinChallengeAction}>
                    <input type="hidden" name="challengeId" value={data.challenge.id} />
                    <Button
                      type="submit"
                      className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]"
                    >
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

            <DataPanel id="rules">
              <SectionHeader
                title="Rules"
                description="Plain-language scoring requirements for this challenge."
                action={<ShieldCheck className="size-5 text-emerald-600" />}
              />
              <CardContent className="grid gap-2">
                {data.challenge.rulesBullets.map((rule) => (
                  <div
                    key={rule}
                    className="rounded-lg border bg-white px-3 py-2 text-sm leading-5"
                  >
                    {rule}
                  </div>
                ))}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Badge variant="outline">Imported shots only</Badge>
                  <Badge variant="outline">Active window only</Badge>
                  <Badge variant="outline">Auto-scored board</Badge>
                </div>
              </CardContent>
            </DataPanel>

            <DataPanel>
              <SectionHeader
                title="Invite friends"
                description="Invite links keep friend challenges scoped without granting account access."
                action={<Users className="size-5 text-sky-600" />}
              />
              <CardContent>
                {data.friendOptions.length > 0 ? (
                  <form action={inviteFriendToChallengeAction} className="grid gap-3">
                    <input type="hidden" name="challengeId" value={data.challenge.id} />
                    <select
                      name="inviteeUserId"
                      className="h-10 rounded-xl border bg-white px-3 text-sm"
                    >
                      {data.friendOptions.map((friend) => (
                        <option key={friend.userId} value={friend.userId}>
                          {friend.displayName} (@{friend.username})
                        </option>
                      ))}
                    </select>
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
                  <CardDescription>Keep challenge talk attached to the challenge.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {data.comments.map((comment) => (
                    <div key={comment.id} className="rounded-lg border bg-white px-3 py-2 text-sm">
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
                      className="h-9 rounded-xl bg-white"
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
    </PageShell>
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
            <select
              name="inviteeUserId"
              className="min-h-11 rounded-xl border bg-card px-3 text-base"
            >
              {data.friendOptions.map((friend) => (
                <option key={friend.userId} value={friend.userId}>
                  {friend.displayName} (@{friend.username})
                </option>
              ))}
            </select>
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
            Exportable leaderboard and imported-shot evidence from the same qualifying imports that
            decide the podium.
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
      <ChallengeAttemptEvidenceTable data={data} />
    </section>
  );
}

function ChallengeLeaderboardTable({
  data,
  verificationMode,
}: {
  data: ChallengeDetail;
  verificationMode: string;
}) {
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
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
            <TableRow>
              <TableHead
                data-column="rank"
                className="sticky left-0 z-20 min-w-24 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
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
        className="sticky left-0 z-10 min-w-24 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
      >
        <Badge variant={row.result.rank === 1 ? "default" : "outline"}>
          {row.result.rank ? `#${row.result.rank}` : "--"}
        </Badge>
      </TableCell>
      <TableCell data-column="player">
        <Link
          href={`/profile/${row.profile.username}`}
          prefetch={false}
          className="font-semibold text-emerald-700 hover:underline"
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

function ChallengeAttemptEvidenceTable({ data }: { data: ChallengeDetail }) {
  const suggestedViews = challengeAttemptSuggestedViews(data.challenge.id);

  return (
    <section className="grid gap-3" data-workbench-scope="challenge-attempts">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Imported shot evidence</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Qualifying attempts that feed the leaderboard, including source and sample evidence.
          </p>
        </div>
        <StatusPill tone={data.attempts.length > 0 ? "amber" : "slate"}>
          {data.attempts.length} attempts
        </StatusPill>
      </div>

      <DesktopTableWorkbenchControls
        viewKey={`challenge-attempts-${data.challenge.id}`}
        scope="challenge-attempts"
        currentViewLabel={`${data.challenge.title} attempts`}
        resultLabel={`${data.attempts.length} imported attempts`}
        columns={challengeAttemptColumns}
        suggestedViews={suggestedViews}
        exportTableId="challenge-attempts"
        exportFileName={`forekinghell-challenge-${data.challenge.id}-attempts.csv`}
      />

      <DataTableFrame label="Challenge imported shot evidence table" stickyFirstColumn>
        <Table
          data-workbench-export-table="challenge-attempts"
          aria-describedby="challenge-attempts-summary"
        >
          <TableCaption id="challenge-attempts-summary" className="sr-only">
            Challenge imported shot evidence table showing player, metric, source, verification,
            evidence, attempted time and action.
          </TableCaption>
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
            <TableRow>
              <TableHead
                data-column="player"
                className="sticky left-0 z-20 min-w-64 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
              >
                Player
              </TableHead>
              <TableHead data-column="metric">Metric</TableHead>
              <TableHead data-column="source">Source</TableHead>
              <TableHead data-column="verification">Verification</TableHead>
              <TableHead data-column="evidence">Evidence</TableHead>
              <TableHead data-column="attempted">Attempted</TableHead>
              <TableHead data-column="action" className="text-right">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.attempts.length > 0 ? (
              data.attempts.map((row) => (
                <ChallengeAttemptTableRow key={row.attempt.id} row={row} />
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  No qualifying imported attempts yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DataTableFrame>
    </section>
  );
}

function ChallengeAttemptTableRow({ row }: { row: ChallengeAttemptEntry }) {
  return (
    <TableRow tabIndex={0} className="focus-aaa outline-none">
      <TableCell
        data-column="player"
        className="sticky left-0 z-10 min-w-64 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
      >
        <Link
          href={`/profile/${row.profile.username}`}
          prefetch={false}
          className="font-semibold text-emerald-700 hover:underline"
        >
          {row.profile.displayName}
        </Link>
        <p className="mt-1 text-xs text-muted-foreground">@{row.profile.username}</p>
      </TableCell>
      <TableCell data-column="metric">
        <span className="font-medium">{attemptScoreLabel(row.attempt)}</span>
        <p className="mt-1 text-xs text-muted-foreground">{row.attempt.metricLabel}</p>
      </TableCell>
      <TableCell data-column="source">{titleCase(row.attempt.sourceType)}</TableCell>
      <TableCell data-column="verification">{row.attempt.verificationLabel}</TableCell>
      <TableCell data-column="evidence">{attemptMetadataLabel(row.attempt.metadataJson)}</TableCell>
      <TableCell data-column="attempted">
        {challengeDateTimeFormatter.format(row.attempt.attemptedAt)}
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
          ? "rounded-lg border border-amber-200 bg-amber-50 p-4"
          : "rounded-lg border bg-[#F5F6F4] p-4"
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
      title: "Imported shots",
      href: `/challenges/${challengeId}#imported-shots`,
      detail: "Challenge rules and import status.",
    },
    {
      title: "Challenge centre",
      href: "/challenges",
      detail: "Active, invited and recommended challenge boards.",
    },
  ];
}

function challengeAttemptSuggestedViews(challengeId: string): DesktopSavedViewSuggestion[] {
  return [
    {
      title: "Imported attempts",
      href: `/challenges/${challengeId}#challenge-command`,
      detail: "Every qualifying attempt that feeds this leaderboard.",
    },
    {
      title: "Import data",
      href: "/import",
      detail: "Upload or connect new challenge evidence.",
    },
    {
      title: "Compare",
      href: "/compare",
      detail: "Compare sessions, clubs and before-after periods.",
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

function Anchor({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="inline-flex min-h-11 shrink-0 items-center rounded-xl border bg-white px-3 text-sm font-semibold"
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
