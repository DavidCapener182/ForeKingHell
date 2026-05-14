import Link from "next/link";
import { ArrowLeft, CalendarDays, Plus, Trophy, Users } from "lucide-react";

import { createChallengeAction, joinChallengeAction } from "@/app/challenges/actions";
import {
  DataPanel,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getChallengesPageData, type ChallengeListItem } from "@/lib/challenges";
import { socialVisibilityOptions } from "@/lib/social";

export const dynamic = "force-dynamic";

export default async function ChallengesPage() {
  const data = await getChallengesPageData();

  return (
    <PageShell size="7xl">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" className="px-0">
          <Link href="/dashboard" prefetch={false}>
            <ArrowLeft className="size-4" />
            Dashboard
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/leaderboard?tab=challenges" prefetch={false}>
            <Trophy className="size-4" />
            Challenge boards
          </Link>
        </Button>
      </div>

      <PageHeader
        eyebrow={<StatusPill tone="amber">Challenges</StatusPill>}
        title="Challenges"
        description="Create private friend challenges, join monthly boards, submit verified attempts, and turn results into feed cards."
        metrics={[
          { label: "Active", value: data.active.length, detail: "Visible open challenges" },
          { label: "Joined", value: data.mine.length, detail: "Your active entries" },
          { label: "Templates", value: data.templates.length, detail: "Launch-monitor friendly formats" },
          { label: "Privacy", value: "Friends", detail: "Private challenges stay scoped" },
        ]}
      />

      <section className="grid gap-4 lg:grid-cols-[0.34fr_0.66fr]">
        <DataPanel>
          <SectionHeader
            title="Create challenge"
            description="Start with a template, then invite friends from the detail page."
            action={<Plus className="size-5 text-emerald-600" />}
          />
          <CardContent>
            <form action={createChallengeAction} className="grid gap-4">
              <label className="grid gap-2 text-sm font-medium">
                <span>Template</span>
                <select name="templateId" className="h-10 rounded-xl border bg-white px-3 text-sm">
                  {data.templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                <span>Title</span>
                <Input name="title" placeholder="May Wedge Control Challenge" className="h-10 rounded-xl bg-white" required />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                <span>Description</span>
                <textarea name="description" rows={3} className="rounded-xl border bg-white px-3 py-2 text-sm" />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                <span>Visibility</span>
                <select name="visibility" defaultValue="friends" className="h-10 rounded-xl border bg-white px-3 text-sm">
                  {socialVisibilityOptions.map((option) => (
                    <option key={option} value={option}>
                      {titleCase(option)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium">
                  <span>Starts</span>
                  <Input name="startsAt" type="date" className="h-10 rounded-xl bg-white" />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  <span>Ends</span>
                  <Input name="endsAt" type="date" className="h-10 rounded-xl bg-white" />
                </label>
              </div>
              <Button type="submit" className="rounded-xl bg-[#111827] text-white">
                <Plus className="size-4" />
                Create
              </Button>
            </form>
          </CardContent>
        </DataPanel>

        <DataPanel>
          <SectionHeader
            title="Visible challenges"
            description="Friends, public opt-in and joined challenge scopes."
            action={<Trophy className="size-5 text-amber-600" />}
          />
          <CardContent>
            <ChallengeGrid challenges={data.challenges} />
          </CardContent>
        </DataPanel>
      </section>
    </PageShell>
  );
}

function ChallengeGrid({ challenges }: { challenges: ChallengeListItem[] }) {
  if (challenges.length === 0) {
    return <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No challenges are visible yet. Create the first private friend challenge.</p>;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {challenges.map((challenge) => (
        <Card key={challenge.id} className="premium-card" size="sm">
          <CardHeader>
            <CardTitle>{challenge.title}</CardTitle>
            <CardDescription>{challenge.templateName}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="line-clamp-2 text-sm text-muted-foreground">{challenge.description ?? "No description."}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="gap-1">
                <Users className="size-3" />
                {challenge.participantCount}
              </Badge>
              <Badge variant="outline">{titleCase(challenge.visibility)}</Badge>
              {challenge.endsAt ? (
                <Badge variant="outline" className="gap-1">
                  <CalendarDays className="size-3" />
                  {formatDate(challenge.endsAt)}
                </Badge>
              ) : null}
            </div>
            {challenge.leader ? (
              <div className="rounded-xl border bg-white/70 p-3 text-sm">
                <p className="font-medium">Leader: {challenge.leader.displayName}</p>
                <p className="text-muted-foreground">{challenge.leader.scoreLabel} · {challenge.leader.verificationLabel}</p>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/challenges/${challenge.id}`} prefetch={false}>Open</Link>
              </Button>
              {!challenge.viewerJoined ? (
                <form action={joinChallengeAction}>
                  <input type="hidden" name="challengeId" value={challenge.id} />
                  <Button type="submit" size="sm">
                    Join
                  </Button>
                </form>
              ) : (
                <Badge variant="secondary">Joined{challenge.viewerRank ? ` · #${challenge.viewerRank}` : ""}</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(value);
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
