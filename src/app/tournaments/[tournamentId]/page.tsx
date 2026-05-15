import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, MessageCircle, Send, ShieldCheck, Trophy } from "lucide-react";

import { addTournamentCommentAction, submitTournamentRoundAction } from "@/app/tournaments/actions";
import { PageShell, StatusPill } from "@/components/premium";
import { ScorecardProofUploader } from "@/components/scorecard-proof-uploader";
import { TournamentEntryModal } from "@/components/tournament-entry-modal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hasCurrentTournamentEntryTermsMetadata } from "@/lib/tournament-entry-terms";
import { formatLabel, getTournamentDetailData } from "@/lib/tournaments";

export const dynamic = "force-dynamic";

type TournamentDetailPageProps = {
  params: Promise<{ tournamentId: string }>;
  searchParams?: Promise<{ joined?: string; submission?: string; comment?: string; entryError?: string }>;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });

export default async function TournamentDetailPage({ params, searchParams }: TournamentDetailPageProps) {
  const [{ tournamentId }, query] = await Promise.all([params, searchParams]);
  const data = await getTournamentDetailData(tournamentId);

  if (!data) {
    notFound();
  }

  const podium = data.standings.slice(0, 3);
  const viewerStanding = data.standings.find((row) => row.standing.userId === data.viewerUserId) ?? null;
  const viewerTermsCurrent = data.viewerEntry
    ? hasCurrentTournamentEntryTermsMetadata(data.viewerEntry.metadataJson)
    : false;

  return (
    <PageShell size="7xl">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" className="px-0">
          <Link href="/tournaments" prefetch={false}>
            <ArrowLeft className="size-4" />
            Tournaments
          </Link>
        </Button>
        <Badge variant={data.tournament.directRapsodoRequired ? "secondary" : "outline"}>
          {data.tournament.directRapsodoRequired ? "Gold verification" : "Mixed verification"}
        </Badge>
      </div>

      <header className="rounded-xl border bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
          <div>
            <StatusPill tone="amber">{formatLabel(data.tournament.format)}</StatusPill>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal text-balance">{data.tournament.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {data.course?.name ?? "Course TBD"} · {data.teeSet?.name ?? "Any tee"} · {data.tournament.roundCount} rounds
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {data.tournament.endsAt ? (
                <Badge variant="outline" className="gap-1">
                  <CalendarDays className="size-3" />
                  Closes {dateFormatter.format(data.tournament.endsAt)}
                </Badge>
              ) : null}
              <Badge variant="outline">{data.entries.length} entries</Badge>
              <Badge variant="outline">{data.submissions.length} submissions</Badge>
              {query?.joined ? <Badge variant="secondary">Entered</Badge> : null}
              {query?.submission ? <Badge variant="secondary">Submission saved</Badge> : null}
            </div>
            {query?.entryError === "terms" ? (
              <Alert variant="destructive" className="mt-4 max-w-2xl">
                <AlertTitle>Terms must be accepted</AlertTitle>
                <AlertDescription>Accept the tournament entry terms before registering.</AlertDescription>
              </Alert>
            ) : null}
          </div>
          <div className="rounded-xl border bg-slate-50 p-4">
            <p className="text-sm font-semibold">Your entry</p>
            {data.viewerEntered ? (
              <div className="mt-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{viewerStanding ? `Rank #${viewerStanding.standing.rank}` : "Entered"}</Badge>
                  <Badge variant={viewerTermsCurrent ? "secondary" : "outline"}>
                    {viewerTermsCurrent ? "Terms accepted" : "Terms update needed"}
                  </Badge>
                </div>
                <p className="mt-3 text-2xl font-semibold tracking-normal">
                  Round {data.nextRoundNumber ?? data.tournament.roundCount}: {data.nextRoundNumber ? "Needed" : "Complete"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {data.viewerSubmissions.length}/{data.tournament.roundCount} rounds submitted
                </p>
                {viewerTermsCurrent ? (
                  <Button asChild className="mt-3 w-full rounded-xl bg-[#111827] text-white">
                    <a href="#submit-round">Submit round</a>
                  </Button>
                ) : (
                  <div className="mt-3 grid gap-3">
                    <p className="rounded-xl border border-dashed bg-white p-3 text-sm text-muted-foreground">
                      Accept the current no-mulligans tournament terms before submitting.
                    </p>
                    <TournamentEntryModal
                      tournamentId={data.tournament.id}
                      tournamentTitle={data.tournament.title}
                      courseName={data.course?.name ?? "Course TBD"}
                      teeSetName={data.teeSet?.name ?? "Any tee"}
                      roundCount={data.tournament.roundCount}
                      triggerLabel="Review & accept terms"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-3">
                <p className="mb-3 rounded-xl border border-dashed bg-white p-3 text-sm text-muted-foreground">
                  Open the entry terms, confirm the simulator setup rules, then accept to register.
                </p>
                <TournamentEntryModal
                  tournamentId={data.tournament.id}
                  tournamentTitle={data.tournament.title}
                  courseName={data.course?.name ?? "Course TBD"}
                  teeSetName={data.teeSet?.name ?? "Any tee"}
                  roundCount={data.tournament.roundCount}
                />
              </div>
            )}
          </div>
        </div>
      </header>

      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Tournament views">
        <Anchor href="#overview" label="Overview" />
        <Anchor href="#submit-round" label="My rounds" />
        <Anchor href="#standings" label="Standings" />
        <Anchor href="#rules" label="Rules" />
        <Anchor href="#chat" label="Chat" />
      </nav>

      <section id="overview" className="grid scroll-mt-28 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <article className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Trophy className="size-4 text-amber-600" />
            Podium
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {podium.length > 0 ? (
              podium.map(({ standing, profile }) => (
                <div key={standing.id} className={standing.rank === 1 ? "rounded-xl border border-amber-200 bg-amber-50 p-4" : "rounded-xl border bg-slate-50 p-4"}>
                  <Badge variant={standing.rank === 1 ? "default" : "outline"}>#{standing.rank ?? "--"}</Badge>
                  <p className="mt-3 font-semibold tracking-normal">{profile?.displayName ?? "Player"}</p>
                  <p className="mt-1 text-2xl font-semibold tracking-normal">{standing.grossTotal}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{standing.roundsCompleted} rounds</p>
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground md:col-span-3">
                No accepted submissions yet.
              </p>
            )}
          </div>
        </article>

        <article className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="size-4 text-emerald-600" />
            Proof model
          </p>
          <div className="mt-3 grid gap-2 text-sm">
            <ProofRow label="Rapsodo direct" active={data.tournament.directRapsodoRequired} />
            <ProofRow label="Scorecard screenshot" active={data.tournament.screenshotRequired} />
            <ProofRow label="Course/date/tee match" active />
            <ProofRow label="Duplicate import check" active />
            <ProofRow label="No mulligans" active />
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <article id="submit-round" className="scroll-mt-28 rounded-xl border bg-white p-4 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Send className="size-4 text-emerald-600" />
            Submit round
          </p>
          {data.viewerEntered && viewerTermsCurrent ? (
            <form action={submitTournamentRoundAction} className="mt-4 grid gap-3" data-tournament-submit-form>
              <input type="hidden" name="tournamentId" value={data.tournament.id} />
              <label className="grid gap-1 text-sm font-medium">
                Round
                <Input name="roundNumber" type="number" min={1} max={data.tournament.roundCount} defaultValue={data.nextRoundNumber ?? data.tournament.roundCount} className="h-10 rounded-xl bg-white" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1 text-sm font-medium">
                  Gross
                  <Input name="grossScore" inputMode="numeric" className="h-10 rounded-xl bg-white" required />
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  Net
                  <Input name="netScore" inputMode="numeric" className="h-10 rounded-xl bg-white" />
                </label>
              </div>
              <label className="grid gap-1 text-sm font-medium">
                Imported session id
                <Input name="sessionId" placeholder="Optional linked round/session id" className="h-10 rounded-xl bg-white" />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                CSV hash
                <Input name="csvHash" placeholder="Rapsodo CSV hash" className="h-10 rounded-xl bg-white" />
              </label>
              <ScorecardProofUploader
                screenshotFieldName="scorecardScreenshotPath"
                extractedTotalFieldName="extractedScorecardTotal"
                extractedTotalLabel="Extracted total"
              />
              <div className="grid gap-2 rounded-xl bg-slate-50 p-3 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="hasRapsodoDirect" className="size-4 accent-[#111827]" />
                  Direct Rapsodo import
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="manualEdit" className="size-4 accent-[#111827]" />
                  Manual edit flagged
                </label>
              </div>
              <Button type="submit" className="rounded-xl bg-[#111827] text-white">
                <Send className="size-4" />
                Submit
              </Button>
            </form>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              {data.viewerEntered ? "Accept the current no-mulligans terms before submitting." : "Enter the tournament before submitting."}
            </p>
          )}
        </article>

        <main className="grid gap-4">
          <section id="standings" className="scroll-mt-28 rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold">Standings</p>
            <div className="mt-4 grid gap-2">
              {data.standings.map(({ standing, profile }) => (
                <div key={standing.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                  <Badge variant={standing.rank === 1 ? "default" : "outline"}>#{standing.rank ?? "--"}</Badge>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{profile?.displayName ?? "Player"}</p>
                    <p className="text-xs text-muted-foreground">{standing.roundsCompleted}/{data.tournament.roundCount} rounds</p>
                  </div>
                  <p className="font-semibold">{standing.grossTotal}</p>
                </div>
              ))}
              {data.standings.length === 0 ? <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No standings yet.</p> : null}
            </div>
          </section>

          <section id="rules" className="scroll-mt-28 rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold">Rules</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Rule label="Format" value={formatLabel(data.tournament.format)} />
              <Rule label="Rounds" value={String(data.tournament.roundCount)} />
              <Rule label="Mulligans" value="Not allowed in any tournament round" />
              <Rule label="Gimmes" value="10 ft for 1-putt, 20 ft for 2-putt; outside that, hole out or use event scoring." />
              <Rule label="Cut" value={JSON.stringify(data.tournament.cutRuleJson)} />
              <Rule label="Tiebreaker" value={JSON.stringify(data.tournament.playoffRuleJson)} />
            </div>
          </section>

          <section id="chat" className="scroll-mt-28 rounded-xl border bg-white p-4 shadow-sm">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <MessageCircle className="size-4 text-sky-600" />
              Chat
            </p>
            <div className="mt-4 grid gap-2">
              {data.comments.map(({ comment, profile }) => (
                <div key={comment.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                  <p className="font-medium">{profile?.displayName ?? "Player"}</p>
                  <p className="text-muted-foreground">{comment.body}</p>
                </div>
              ))}
            </div>
            <form action={addTournamentCommentAction} className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
              <input type="hidden" name="tournamentId" value={data.tournament.id} />
              <Input name="body" placeholder="Add a comment" className="h-10 rounded-xl bg-white" />
              <Button type="submit" variant="outline">
                <MessageCircle className="size-4" />
                Comment
              </Button>
            </form>
          </section>
        </main>
      </section>
    </PageShell>
  );
}

function Anchor({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="inline-flex min-h-11 shrink-0 items-center rounded-xl border bg-white px-3 text-sm font-semibold">
      {label}
    </a>
  );
}

function ProofRow({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
      <span>{label}</span>
      <Badge variant={active ? "secondary" : "outline"}>{active ? "On" : "Optional"}</Badge>
    </div>
  );
}

function Rule({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 break-words">{value === "{}" ? "None" : value}</p>
    </div>
  );
}
