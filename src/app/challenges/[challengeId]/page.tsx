import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, MessageCircle, Plus, Send, ShieldCheck, Trophy, Users } from "lucide-react";

import {
  addChallengeCommentAction,
  inviteFriendToChallengeAction,
  joinChallengeAction,
} from "@/app/challenges/actions";
import {
  DataPanel,
  DataTableFrame,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import {
  CompactLeaderboard,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
    <PageShell size="7xl">
      <MobileAppShell>
        <MobileTopBar
          title={data.challenge.title}
          leading={
            <Button asChild variant="ghost" size="icon" className="size-10 rounded-full">
              <Link href="/challenges" prefetch={false} aria-label="Challenges">
                <ArrowLeft className="size-5" />
              </Link>
            </Button>
          }
          actions={<Badge variant="outline">{data.challenge.templateName}</Badge>}
        />
        <MobileStatusAction
          label="Imported result"
          value={viewerResult ? `#${viewerResult.result.rank}` : "No qualifying shots"}
          detail={viewerResult ? `${viewerResult.result.scoreLabel} · ${viewerResult.verificationLabel}` : `${data.challenge.participantCount} players · ${verificationMode}`}
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
                <Link href="/import" prefetch={false}>Import data</Link>
              </Button>
            )
          }
        />
        <section className="rounded-lg border border-[#E5E7EB] bg-white p-3">
          <p className="text-sm font-semibold text-[#0B7A3B]">Challenge</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-normal">{data.challenge.title}</h2>
          <p className="mt-1 text-sm leading-5 text-[#6B7280]">{data.challenge.rulesSummary}</p>
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
        {activeTab === "rules" ? (
          <NativeListSection title="Rules" description={data.challenge.rulesSummary}>
            {data.challenge.rulesBullets.map((rule) => (
              <div key={rule} className="rounded-lg border border-[#E5E7EB] bg-white p-3 text-sm leading-5 text-[#050505]">
                {rule}
              </div>
            ))}
          </NativeListSection>
        ) : activeTab === "shots" ? (
          <NativeListSection title="Imported shots" description="This board is calculated from qualifying imported shots. New imports update it automatically.">
            {data.attempts.slice(0, 8).map(({ attempt, profile }) => (
              <div key={attempt.id} className="rounded-lg border border-[#E5E7EB] bg-white p-3 text-sm">
                <Link href={`/profile/${profile.username}`} prefetch={false} className="font-semibold hover:underline">
                  {profile.displayName}
                </Link>
                <p className="mt-1 text-[#6B7280]">{attemptScoreLabel(attempt)} · {attempt.verificationLabel}</p>
                <p className="mt-1 text-xs text-[#6B7280]">{attemptMetadataLabel(attempt.metadataJson)}</p>
              </div>
            ))}
            {data.attempts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#E5E7EB] bg-white p-3 text-sm text-[#6B7280]">
                No qualifying imported shots yet. Import shots during the challenge window and they will appear here automatically.
              </div>
            ) : null}
          </NativeListSection>
        ) : activeTab === "chat" ? (
          <NativeListSection title="Chat">
            {data.comments.map((comment) => (
              <div key={comment.id} className="rounded-lg bg-[#F5F6F4] px-3 py-2 text-sm">
                <Link href={`/profile/${comment.profile.username}`} prefetch={false} className="font-semibold hover:underline">
                  {comment.profile.displayName}
                </Link>
                <p className="mt-1 text-[#6B7280]">{comment.body}</p>
              </div>
            ))}
            <form action={addChallengeCommentAction} className="grid gap-2">
              <input type="hidden" name="challengeId" value={data.challenge.id} />
              <Input name="body" placeholder="Add a comment" className="h-11 rounded-lg bg-white" />
              <Button type="submit" variant="outline" className="rounded-full">Comment</Button>
            </form>
          </NativeListSection>
        ) : (
          <NativeListSection title="Podium">
            <CompactLeaderboard
              current={viewerResult ? `You are #${viewerResult.result.rank} · ${viewerResult.result.scoreLabel}` : "No qualifying imported shots yet"}
              items={podium.map((row) => ({
                rank: row.result.rank,
                name: row.profile.displayName,
                href: `/profile/${row.profile.username}`,
                value: row.result.scoreLabel,
                detail: row.verificationLabel,
              }))}
              viewAllHref={`/challenges/${data.challenge.id}#board`}
            />
          </NativeListSection>
        )}
      </MobileAppShell>

      <div className="hidden items-center justify-between gap-3 sm:flex">
        <Button asChild variant="ghost" className="px-0">
          <Link href="/challenges" prefetch={false}>
            <ArrowLeft className="size-4" />
            Challenges
          </Link>
        </Button>
        <Badge variant="outline">{data.challenge.templateName}</Badge>
      </div>

      <div className="hidden sm:contents">
      <PageHeader
        eyebrow={<StatusPill tone="amber">Challenge</StatusPill>}
        title={data.challenge.title}
        description={data.challenge.description ?? data.challenge.coachNote}
        metrics={[
          { label: "Participants", value: data.challenge.participantCount, detail: "Joined entries" },
          { label: "Visibility", value: titleCase(data.challenge.visibility), detail: "Private friend-safe scope" },
          { label: "Your rank", value: data.challenge.viewerRank ? `#${data.challenge.viewerRank}` : "--", detail: "From imported shots" },
          { label: "Scoring", value: data.challenge.scoringDirection === "desc" ? "High wins" : "Low wins", detail: "Automatic from imports" },
        ]}
      />

      {query?.invite ? (
        <Badge variant="secondary" className="w-fit">Invite sent</Badge>
      ) : null}

      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Challenge views">
        <Anchor href="#board" label="Board" />
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
                Imported shots inside the challenge window decide this board. Full rankings stay below for dense review.
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
                No qualifying imported shots yet. New imports during the active window will update this board automatically.
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
              <p className="mt-3 text-2xl font-semibold tracking-normal">{viewerResult.result.scoreLabel}</p>
              <p className="mt-1 text-sm text-muted-foreground">{viewerResult.verificationLabel}</p>
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
              <Link href="/import" prefetch={false}>Import data</Link>
            </Button>
          </div>
        </article>
      </section>

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
                  <Button type="submit" className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
                    <Plus className="size-4" />
                    Join challenge
                  </Button>
                </form>
              ) : (
                <Button asChild variant="outline" className="rounded-xl">
                  <Link href="/import" prefetch={false}>Open import</Link>
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
                <div key={rule} className="rounded-lg border bg-white px-3 py-2 text-sm leading-5">
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
                  <select name="inviteeUserId" className="h-10 rounded-xl border bg-white px-3 text-sm">
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
                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Add friends before sending challenge invites.</p>
              )}
            </CardContent>
          </DataPanel>
        </div>

        <div className="grid gap-4">
          <DataPanel>
            <SectionHeader
              title="Full leaderboard"
              description="Expanded ranking uses the template scoring direction and best imported result per player."
              action={<Trophy className="size-5 text-amber-600" />}
            />
            <CardContent>
              <details className="rounded-lg border bg-[#F5F6F4]">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                  View full leaderboard
                </summary>
                <div className="border-t bg-white p-3">
                  <DataTableFrame>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Rank</TableHead>
                          <TableHead>Player</TableHead>
                          <TableHead className="text-right">Score</TableHead>
                          <TableHead className="text-right">Verification</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.results.map(({ result, profile, verificationLabel }) => (
                          <TableRow key={result.id}>
                            <TableCell><Badge variant={result.rank === 1 ? "default" : "outline"}>{result.rank ?? "--"}</Badge></TableCell>
                            <TableCell>
                              <Link href={`/profile/${profile.username}`} prefetch={false} className="font-medium hover:underline">
                                {profile.displayName}
                              </Link>
                            </TableCell>
                            <TableCell className="text-right">{result.scoreLabel}</TableCell>
                            <TableCell className="text-right">{verificationLabel}</TableCell>
                          </TableRow>
                        ))}
                        {data.results.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No qualifying imported shots yet.</TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </DataTableFrame>
                </div>
              </details>
            </CardContent>
          </DataPanel>

          <section className="grid gap-4 md:grid-cols-2">
            <Card id="chat" className="premium-card scroll-mt-28">
              <CardHeader>
                <CardTitle>Recent imported results</CardTitle>
                <CardDescription>Latest qualifying import-derived entries for this challenge.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2">
                {data.attempts.slice(0, 6).map(({ attempt, profile }) => (
                  <div key={attempt.id} className="rounded-lg border bg-white px-3 py-2 text-sm">
                    <Link href={`/profile/${profile.username}`} prefetch={false} className="font-medium hover:underline">
                      {profile.displayName}
                    </Link>
                    <p className="text-muted-foreground">{attemptScoreLabel(attempt)} · {attempt.verificationLabel}</p>
                    <p className="text-xs text-muted-foreground">{attemptMetadataLabel(attempt.metadataJson)}</p>
                  </div>
                ))}
                {data.attempts.length === 0 ? <p className="text-sm text-muted-foreground">No qualifying imported shots yet.</p> : null}
              </CardContent>
            </Card>

            <Card className="premium-card">
              <CardHeader>
                <CardTitle>Comments</CardTitle>
                <CardDescription>Keep challenge talk attached to the challenge.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {data.comments.map((comment) => (
                  <div key={comment.id} className="rounded-lg border bg-white px-3 py-2 text-sm">
                    <Link href={`/profile/${comment.profile.username}`} prefetch={false} className="font-medium hover:underline">
                      {comment.profile.displayName}
                    </Link>
                    <p className="text-muted-foreground">{comment.body}</p>
                  </div>
                ))}
                <form action={addChallengeCommentAction} className="grid gap-2">
                  <input type="hidden" name="challengeId" value={data.challenge.id} />
                  <Input name="body" placeholder="Add a comment" className="h-9 rounded-xl bg-white" />
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
      </div>
    </PageShell>
  );
}

type PodiumRow = NonNullable<Awaited<ReturnType<typeof getChallengeDetailData>>>["results"][number];

function PodiumCard({ row }: { row: PodiumRow }) {
  const rank = row.result.rank ?? 0;

  return (
    <article className={rank === 1 ? "rounded-lg border border-amber-200 bg-amber-50 p-4" : "rounded-lg border bg-[#F5F6F4] p-4"}>
      <Badge variant={rank === 1 ? "default" : "outline"}>#{rank || "--"}</Badge>
      <Link href={`/profile/${row.profile.username}`} prefetch={false} className="mt-3 block text-lg font-semibold tracking-normal hover:underline">
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

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(value);
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
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
    <a href={href} className="inline-flex min-h-11 shrink-0 items-center rounded-xl border bg-white px-3 text-sm font-semibold">
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
