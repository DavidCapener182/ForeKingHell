import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, MessageCircle, Plus, Send, ShieldCheck, Target, Trophy, Users } from "lucide-react";

import {
  addChallengeCommentAction,
  inviteFriendToChallengeAction,
  joinChallengeAction,
  submitChallengeAttemptAction,
} from "@/app/challenges/actions";
import {
  DataPanel,
  DataTableFrame,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { challengeVerificationLabels, getChallengeDetailData } from "@/lib/challenges";

export const dynamic = "force-dynamic";

type ChallengePageProps = {
  params: Promise<{
    challengeId: string;
  }>;
  searchParams?: Promise<{
    attempt?: string;
    invite?: string;
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

  return (
    <PageShell size="7xl">
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
          { label: "Participants", value: data.challenge.participantCount, detail: "Joined entries" },
          { label: "Visibility", value: titleCase(data.challenge.visibility), detail: "Private friend-safe scope" },
          { label: "Your rank", value: data.challenge.viewerRank ? `#${data.challenge.viewerRank}` : "--", detail: "After your best attempt" },
          { label: "Scoring", value: data.challenge.scoringDirection === "desc" ? "High wins" : "Low wins", detail: "Template rules engine" },
        ]}
      />

      {query?.attempt ? (
        <Badge variant="secondary" className="w-fit">Attempt saved</Badge>
      ) : null}
      {query?.invite ? (
        <Badge variant="secondary" className="w-fit">Invite sent</Badge>
      ) : null}

      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Challenge views">
        <Anchor href="#board" label="Board" />
        <Anchor href="#submit-attempt" label="Submit" />
        <Anchor href="#rules" label="Rules" />
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
        <article className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <StatusPill tone="green">Event board</StatusPill>
              <h2 className="mt-3 text-2xl font-semibold tracking-normal">Podium</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Top verified attempts first. Full rankings stay below for dense review.
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
              <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground md:col-span-3">No attempts yet. Join and set the first score.</p>
            ) : (
              podium.map((row) => <PodiumCard key={row.result.id} row={row} />)
            )}
          </div>
        </article>

        <article className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold">Your attempt</p>
          {viewerResult ? (
            <div className="mt-3 rounded-xl bg-slate-50 p-4">
              <Badge variant="secondary">Rank #{viewerResult.result.rank}</Badge>
              <p className="mt-3 text-2xl font-semibold tracking-normal">{viewerResult.result.scoreLabel}</p>
              <p className="mt-1 text-sm text-muted-foreground">{viewerResult.verificationLabel}</p>
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              {data.challenge.viewerJoined ? "Submit your first attempt to enter the board." : "Join the challenge before submitting an attempt."}
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
              <Link href="#submit-attempt" prefetch={false}>Submit attempt</Link>
            </Button>
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.34fr_0.66fr]">
        <div className="grid gap-4">
          <DataPanel id="submit-attempt">
            <SectionHeader
              title="Submit attempt"
              description={data.challenge.coachNote}
              action={<Target className="size-5 text-emerald-600" />}
            />
            <CardContent>
              {data.challenge.viewerJoined ? (
                <form action={submitChallengeAttemptAction} className="grid gap-4" data-challenge-attempt-form>
                  <input type="hidden" name="challengeId" value={data.challenge.id} />
                  <label className="grid gap-2 text-sm font-medium" htmlFor="challenge-attempt-score">
                    <span>Score</span>
                    <Input id="challenge-attempt-score" name="metricValue" inputMode="decimal" placeholder="e.g. 190.4" className="h-10 rounded-xl bg-white" required />
                  </label>
                  <label className="grid gap-2 text-sm font-medium" htmlFor="challenge-attempt-verification">
                    <span>Verification</span>
                    <select id="challenge-attempt-verification" name="verificationLabel" defaultValue="Manual" className="h-10 rounded-xl border bg-white px-3 text-sm">
                      {challengeVerificationLabels.map((label) => (
                        <option key={label} value={label}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-medium" htmlFor="challenge-attempt-notes">
                    <span>Notes</span>
                    <textarea id="challenge-attempt-notes" name="notes" rows={3} className="rounded-xl border bg-white px-3 py-2 text-sm" />
                  </label>
                  <Button type="submit" className="rounded-xl bg-[#111827] text-white">
                    <Send className="size-4" />
                    Submit attempt
                  </Button>
                </form>
              ) : (
                <form action={joinChallengeAction}>
                  <input type="hidden" name="challengeId" value={data.challenge.id} />
                  <Button type="submit" className="rounded-xl bg-[#111827] text-white">
                    <Plus className="size-4" />
                    Join challenge
                  </Button>
                </form>
              )}
            </CardContent>
          </DataPanel>

          <DataPanel id="rules">
            <SectionHeader
              title="Rules"
              description="Anti-gaming checks are shown as labels, not heavy-handed blockers."
              action={<ShieldCheck className="size-5 text-emerald-600" />}
            />
            <CardContent className="grid gap-2">
              {Object.entries(data.challenge.rulesJson).slice(0, 8).map(([key, value]) => (
                <div key={key} className="rounded-lg border bg-white px-3 py-2 text-sm">
                  <p className="font-medium">{titleCase(key.replace(/([A-Z])/g, " $1").replace(/_/g, " "))}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatRuleValue(value)}</p>
                </div>
              ))}
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="outline">Verified import</Badge>
                <Badge variant="outline">Manual entry</Badge>
                <Badge variant="outline">Outside date window flagged</Badge>
                <Badge variant="outline">Insufficient shots flagged</Badge>
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
              description="Expanded ranking uses the template scoring direction and best attempt per player."
              action={<Trophy className="size-5 text-amber-600" />}
            />
            <CardContent>
              <details className="rounded-xl border bg-slate-50">
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
                            <TableCell>{profile.displayName}</TableCell>
                            <TableCell className="text-right">{result.scoreLabel}</TableCell>
                            <TableCell className="text-right">{verificationLabel}</TableCell>
                          </TableRow>
                        ))}
                        {data.results.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No attempts yet.</TableCell>
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
                <CardTitle>Recent attempts</CardTitle>
                <CardDescription>Latest submissions for this challenge.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2">
                {data.attempts.slice(0, 6).map(({ attempt, profile }) => (
                  <div key={attempt.id} className="rounded-xl border bg-white/70 px-3 py-2 text-sm">
                    <p className="font-medium">{profile.displayName}</p>
                    <p className="text-muted-foreground">{attempt.metricValue.toFixed(1)} · {attempt.verificationLabel}</p>
                  </div>
                ))}
                {data.attempts.length === 0 ? <p className="text-sm text-muted-foreground">No attempts yet.</p> : null}
              </CardContent>
            </Card>

            <Card className="premium-card">
              <CardHeader>
                <CardTitle>Comments</CardTitle>
                <CardDescription>Keep challenge talk attached to the challenge.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {data.comments.map((comment) => (
                  <div key={comment.id} className="rounded-xl border bg-white/70 px-3 py-2 text-sm">
                    <p className="font-medium">{comment.profile.displayName}</p>
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
    </PageShell>
  );
}

type PodiumRow = NonNullable<Awaited<ReturnType<typeof getChallengeDetailData>>>["results"][number];

function PodiumCard({ row }: { row: PodiumRow }) {
  const rank = row.result.rank ?? 0;

  return (
    <article className={rank === 1 ? "rounded-xl border border-amber-200 bg-amber-50 p-4" : "rounded-xl border bg-slate-50 p-4"}>
      <Badge variant={rank === 1 ? "default" : "outline"}>#{rank || "--"}</Badge>
      <p className="mt-3 text-lg font-semibold tracking-normal">{row.profile.displayName}</p>
      <p className="mt-1 text-2xl font-semibold tracking-normal">{row.result.scoreLabel}</p>
      <p className="mt-1 text-sm text-muted-foreground">{row.verificationLabel}</p>
    </article>
  );
}

function boardVerificationMode(labels: string[]) {
  if (labels.length === 0) {
    return "Awaiting attempts";
  }

  if (labels.every((label) => label === "Manual" || label === "Unverified")) {
    return "Manual-only board";
  }

  if (labels.some((label) => label === "Manual" || label === "Unverified")) {
    return "Mixed board";
  }

  return "Verified board";
}

function formatRuleValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (value !== null && typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(value);
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function Anchor({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="inline-flex min-h-11 shrink-0 items-center rounded-xl border bg-white px-3 text-sm font-semibold">
      {label}
    </a>
  );
}
