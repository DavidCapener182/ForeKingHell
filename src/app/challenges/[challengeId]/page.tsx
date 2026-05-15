import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageCircle, Plus, Send, Target, Trophy, Users } from "lucide-react";

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

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
        <Card className="premium-card">
          <CardHeader>
            <CardTitle>Your attempt</CardTitle>
            <CardDescription>{data.challenge.viewerJoined ? "Submit another verified score when you improve." : "Join before submitting an attempt."}</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant={data.challenge.viewerJoined ? "secondary" : "outline"}>{data.challenge.viewerJoined ? "Entered" : "Not entered"}</Badge>
            <p className="mt-3 text-2xl font-semibold">{data.challenge.viewerRank ? `#${data.challenge.viewerRank}` : "--"}</p>
            <p className="text-sm text-muted-foreground">Current rank</p>
          </CardContent>
        </Card>
        <Card className="premium-card">
          <CardHeader>
            <CardTitle>Rules</CardTitle>
            <CardDescription>{data.challenge.scoringDirection === "desc" ? "Highest score wins." : "Lowest score wins."}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="outline">{data.challenge.templateName}</Badge>
            <Badge variant="outline">{titleCase(data.challenge.visibility)}</Badge>
            <Badge variant="secondary">Verified or mixed board</Badge>
          </CardContent>
        </Card>
        <Card className="premium-card">
          <CardHeader>
            <CardTitle>Anti-gaming checks</CardTitle>
            <CardDescription>Public boards flag outliers without making private friend challenges heavy.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="outline">Duplicate attempt</Badge>
            <Badge variant="outline">Outside date window</Badge>
            <Badge variant="outline">Wrong club type</Badge>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.34fr_0.66fr]">
        <div className="grid gap-4">
          <DataPanel>
            <SectionHeader
              title="Submit attempt"
              description={data.challenge.coachNote}
              action={<Target className="size-5 text-emerald-600" />}
            />
            <CardContent>
              {data.challenge.viewerJoined ? (
                <form action={submitChallengeAttemptAction} className="grid gap-4">
                  <input type="hidden" name="challengeId" value={data.challenge.id} />
                  <label className="grid gap-2 text-sm font-medium">
                    <span>Score</span>
                    <Input name="metricValue" inputMode="decimal" placeholder="e.g. 190.4" className="h-10 rounded-xl bg-white" required />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    <span>Verification</span>
                    <select name="verificationLabel" defaultValue="Manual" className="h-10 rounded-xl border bg-white px-3 text-sm">
                      {challengeVerificationLabels.map((label) => (
                        <option key={label} value={label}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    <span>Notes</span>
                    <textarea name="notes" rows={3} className="rounded-xl border bg-white px-3 py-2 text-sm" />
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
              title="Leaderboard"
              description="Challenge ranking uses the template scoring direction and best attempt per player."
              action={<Trophy className="size-5 text-amber-600" />}
            />
            <CardContent>
              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                {data.results.slice(0, 3).map(({ result, profile, verificationLabel }) => (
                  <div key={result.id} className="rounded-xl border bg-gradient-to-br from-amber-50 to-white p-3 text-sm">
                    <Badge variant={result.rank === 1 ? "default" : "secondary"}>#{result.rank ?? "--"}</Badge>
                    <p className="mt-3 font-semibold">{profile.displayName}</p>
                    <p className="text-muted-foreground">{result.scoreLabel}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{verificationLabel}</p>
                  </div>
                ))}
                {data.results.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground sm:col-span-3">No podium yet. Submit the first attempt.</p>
                ) : null}
              </div>
              <details className="rounded-xl border bg-white" open>
                <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">View full leaderboard</summary>
                <div className="border-t">
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
            <Card className="premium-card">
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

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
