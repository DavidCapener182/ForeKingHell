import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, MessageCircle, Send, ShieldCheck, Trophy } from "lucide-react";

import { addTournamentCommentAction, submitTournamentRoundAction } from "@/app/tournaments/actions";
import { PageShell, StatusPill } from "@/components/premium";
import {
  BottomSheet,
  CompactLeaderboard,
  MobileAppShell,
  MobileStatusAction,
  MobileTabBar,
  MobileTopBar,
  NativeListSection,
  ProofBadge,
} from "@/components/mobile-sports";
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
  searchParams?: Promise<{ joined?: string; submission?: string; comment?: string; entryError?: string; tab?: string }>;
};

type TournamentDetailData = NonNullable<Awaited<ReturnType<typeof getTournamentDetailData>>>;
type MatchingTournamentRound = TournamentDetailData["matchingRounds"][number];

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
const roundDateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

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
  const activeTab = parseTournamentDetailTab(query?.tab);

  return (
    <PageShell size="7xl">
      <MobileAppShell>
        <MobileTopBar
          title={data.tournament.title}
          leading={
            <Button asChild variant="ghost" size="icon" className="size-10 rounded-full">
              <Link href="/tournaments" prefetch={false} aria-label="Tournaments">
                <ArrowLeft className="size-5" />
              </Link>
            </Button>
          }
          actions={<ProofBadge tier={data.tournament.directRapsodoRequired ? "gold" : "silver"} />}
        />
        <MobileStatusAction
          label="Your entry"
          value={
            data.viewerEntered
              ? data.nextRoundNumber
                ? `Round ${data.nextRoundNumber} needed`
                : "Complete"
              : "Not entered"
          }
          detail={`${data.viewerSubmissions.length}/${data.tournament.roundCount} rounds submitted · ${data.entries.length} entries`}
          action={
            data.viewerEntered && viewerTermsCurrent ? (
              <BottomSheet label={<><Send className="size-4" /> Submit</>} title="Submit tournament round">
                <div className="grid gap-4">
                  <MatchingRoundSubmitList
                    rounds={data.matchingRounds}
                    tournamentId={data.tournament.id}
                    roundNumber={data.nextRoundNumber}
                    courseName={data.course?.name ?? null}
                    compact
                  />
                  <div className="grid gap-2 border-t border-[#E5E7EB] pt-4">
                    <p className="text-sm font-semibold">Manual score</p>
                    <p className="text-xs leading-5 text-[#6B7280]">
                      Use this only if the saved round has not appeared yet.
                    </p>
                    <form action={submitTournamentRoundAction} className="grid gap-3" data-tournament-submit-form>
                      <input type="hidden" name="tournamentId" value={data.tournament.id} />
                      <Input name="roundNumber" type="number" min={1} max={data.tournament.roundCount} defaultValue={data.nextRoundNumber ?? data.tournament.roundCount} className="h-11 rounded-lg bg-white" />
                      <div className="grid grid-cols-2 gap-2">
                        <Input name="grossScore" inputMode="numeric" placeholder="Gross" className="h-11 rounded-lg bg-white" required />
                        <Input name="netScore" inputMode="numeric" placeholder="Net" className="h-11 rounded-lg bg-white" />
                      </div>
                      <Input name="sessionId" placeholder="Linked imported round" className="h-11 rounded-lg bg-white" />
                      <Input name="csvHash" placeholder="Import proof code (optional)" className="h-11 rounded-lg bg-white" />
                      <ScorecardProofUploader
                        screenshotFieldName="scorecardScreenshotPath"
                        extractedTotalFieldName="extractedScorecardTotal"
                        screenshotLabel="Scorecard image"
                        extractedTotalLabel="Extracted total"
                      />
                      <label className="flex items-center gap-2 rounded-lg bg-[#F5F6F4] px-3 py-2 text-sm">
                        <input type="checkbox" name="hasRapsodoDirect" className="size-4 accent-[#0B7A3B]" />
                        Direct Rapsodo import
                      </label>
                      <Button type="submit" className="rounded-full bg-[#0B7A3B] text-white">
                        <Send className="size-4" />
                        Submit
                      </Button>
                    </form>
                  </div>
                </div>
              </BottomSheet>
            ) : data.viewerEntered ? (
              <TournamentEntryModal
                tournamentId={data.tournament.id}
                tournamentTitle={data.tournament.title}
                courseName={data.course?.name ?? "Course TBD"}
                teeSetName={data.teeSet?.name ?? "Any tee"}
                roundCount={data.tournament.roundCount}
                triggerLabel="Accept terms"
              />
            ) : (
              <TournamentEntryModal
                tournamentId={data.tournament.id}
                tournamentTitle={data.tournament.title}
                courseName={data.course?.name ?? "Course TBD"}
                teeSetName={data.teeSet?.name ?? "Any tee"}
                roundCount={data.tournament.roundCount}
                triggerLabel="Enter"
              />
            )
          }
        />
        <section className="rounded-lg border border-[#E5E7EB] bg-white p-3">
          <p className="text-sm font-semibold text-[#0B7A3B]">{formatLabel(data.tournament.format)}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-normal">{data.tournament.title}</h2>
          <p className="mt-1 text-sm leading-5 text-[#6B7280]">
            {data.course?.name ?? "Course TBD"} · {data.teeSet?.name ?? "Any tee"} · {data.tournament.roundCount} rounds
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            {Array.from({ length: data.tournament.roundCount }, (_, index) => {
              const roundNumber = index + 1;
              const submitted = data.viewerSubmissions.some((submission) => submission.roundNumber === roundNumber);
              const needed = data.nextRoundNumber === roundNumber;

              return (
                <div key={roundNumber} className="rounded-lg bg-[#F5F6F4] px-3 py-2">
                  <p className="font-semibold">Round {roundNumber}</p>
                  <p className="text-xs text-[#6B7280]">{submitted ? "Submitted" : needed ? "Needed" : "Locked"}</p>
                </div>
              );
            })}
          </div>
        </section>
        <MobileTabBar
          activeKey={activeTab}
          tabs={[
            { key: "board", label: "Board", href: `/tournaments/${data.tournament.id}` },
            { key: "submit", label: "Submit", href: `/tournaments/${data.tournament.id}?tab=submit` },
            { key: "rules", label: "Rules", href: `/tournaments/${data.tournament.id}?tab=rules` },
            { key: "chat", label: "Chat", href: `/tournaments/${data.tournament.id}?tab=chat` },
          ]}
        />
        {activeTab === "rules" ? (
          <NativeListSection title="Rules">
            <Rule label="Format" value={formatLabel(data.tournament.format)} />
            <Rule label="Rounds" value={String(data.tournament.roundCount)} />
            <Rule label="Mulligans" value="Not allowed in any tournament round" />
            <Rule label="Proof" value="Direct Rapsodo and scorecard screenshot when required." />
          </NativeListSection>
        ) : activeTab === "chat" ? (
          <NativeListSection title="Chat">
            {data.comments.map(({ comment, profile }) => (
              <div key={comment.id} className="rounded-lg bg-[#F5F6F4] px-3 py-2 text-sm">
                <p className="font-semibold">{profile?.displayName ?? "Player"}</p>
                <p className="mt-1 text-[#6B7280]">{comment.body}</p>
              </div>
            ))}
            <form action={addTournamentCommentAction} className="grid gap-2">
              <input type="hidden" name="tournamentId" value={data.tournament.id} />
              <Input name="body" placeholder="Add a comment" className="h-11 rounded-lg bg-white" />
              <Button type="submit" variant="outline" className="rounded-full">Comment</Button>
            </form>
          </NativeListSection>
        ) : activeTab === "submit" ? (
          <NativeListSection title="Submit">
            {data.viewerEntered && viewerTermsCurrent ? (
              <MatchingRoundSubmitList
                rounds={data.matchingRounds}
                tournamentId={data.tournament.id}
                roundNumber={data.nextRoundNumber}
                courseName={data.course?.name ?? null}
                compact
              />
            ) : (
              <p className="rounded-lg border border-[#E5E7EB] p-3 text-sm text-[#6B7280]">
                {data.viewerEntered ? "Accept the current no-mulligans terms before submitting." : "Enter the tournament before submitting."}
              </p>
            )}
          </NativeListSection>
        ) : (
          <NativeListSection title="Podium">
            <CompactLeaderboard
              current={viewerStanding ? `You are #${viewerStanding.standing.rank} · ${viewerStanding.standing.grossTotal}` : "Enter to appear on the board"}
              items={podium.map(({ standing, profile }) => ({
                rank: standing.rank,
                name: profile?.displayName ?? "Player",
                value: standing.grossTotal,
                detail: `${standing.roundsCompleted}/${data.tournament.roundCount} rounds`,
              }))}
              viewAllHref={`/tournaments/${data.tournament.id}#standings`}
            />
          </NativeListSection>
        )}
      </MobileAppShell>

      <div className="hidden items-center justify-between gap-3 sm:flex">
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

      <div className="hidden sm:contents">
      <header className="premium-hero p-4 sm:p-5">
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
          <div className="rounded-lg border bg-[#F5F6F4] p-4">
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
                  <Button asChild className="mt-3 w-full rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
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
        <article className="premium-card p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Trophy className="size-4 text-amber-600" />
            Podium
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {podium.length > 0 ? (
              podium.map(({ standing, profile }) => (
                <div key={standing.id} className={standing.rank === 1 ? "rounded-lg border border-amber-200 bg-amber-50 p-4" : "rounded-lg border bg-[#F5F6F4] p-4"}>
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

        <article className="premium-card p-4">
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
        <article id="submit-round" className="premium-card scroll-mt-28 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Send className="size-4 text-emerald-600" />
            Submit round
          </p>
          {data.viewerEntered && viewerTermsCurrent ? (
            <div className="mt-4 grid gap-4">
              <MatchingRoundSubmitList
                rounds={data.matchingRounds}
                tournamentId={data.tournament.id}
                roundNumber={data.nextRoundNumber}
                courseName={data.course?.name ?? null}
              />
              <div className="grid gap-3 border-t border-[#E5E7EB] pt-4">
                <div>
                  <p className="text-sm font-semibold">Manual score</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Keep this for scorecards that have not been imported yet.
                  </p>
                </div>
                <form action={submitTournamentRoundAction} className="grid gap-3" data-tournament-submit-form>
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
                    Linked imported round
                    <Input name="sessionId" placeholder="Optional imported round reference" className="h-10 rounded-xl bg-white" />
                  </label>
                  <label className="grid gap-1 text-sm font-medium">
                    Import proof code
                    <Input name="csvHash" placeholder="Optional proof code from imported CSV" className="h-10 rounded-xl bg-white" />
                    <span className="text-xs leading-5 text-muted-foreground">
                      Used to detect duplicate uploads. Leave blank if you are entering a manual scorecard.
                    </span>
                  </label>
                  <ScorecardProofUploader
                    screenshotFieldName="scorecardScreenshotPath"
                    extractedTotalFieldName="extractedScorecardTotal"
                    screenshotLabel="Scorecard image"
                    extractedTotalLabel="Extracted total"
                  />
                  <div className="grid gap-2 rounded-lg bg-[#F5F6F4] p-3 text-sm">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="hasRapsodoDirect" className="size-4 accent-[#0B7A3B]" />
                      Direct Rapsodo import
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="manualEdit" className="size-4 accent-[#0B7A3B]" />
                      Manual edit flagged
                    </label>
                  </div>
                  <Button type="submit" className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
                    <Send className="size-4" />
                    Submit manual score
                  </Button>
                </form>
              </div>
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              {data.viewerEntered ? "Accept the current no-mulligans terms before submitting." : "Enter the tournament before submitting."}
            </p>
          )}
        </article>

        <main className="grid gap-4">
          <section id="standings" className="premium-card scroll-mt-28 p-4">
            <p className="text-sm font-semibold">Standings</p>
            <div className="mt-4 grid gap-2">
              {data.standings.map(({ standing, profile }) => (
                <div key={standing.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg bg-[#F5F6F4] px-3 py-2 text-sm">
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

          <section id="rules" className="premium-card scroll-mt-28 p-4">
            <p className="text-sm font-semibold">Rules</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Rule label="Format" value={formatLabel(data.tournament.format)} />
              <Rule label="Rounds" value={String(data.tournament.roundCount)} />
              <Rule label="Mulligans" value="Not allowed in any tournament round" />
              <Rule label="Gimmes" value="10 ft for 1-putt, 20 ft for 2-putt; outside that, hole out or use event scoring." />
              <Rule label="Cut" value={formatCutRule(data.tournament.cutRuleJson)} />
              <Rule label="Tiebreaker" value={formatTiebreakerRule(data.tournament.playoffRuleJson)} />
            </div>
          </section>

          <section id="chat" className="premium-card scroll-mt-28 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <MessageCircle className="size-4 text-sky-600" />
              Chat
            </p>
            <div className="mt-4 grid gap-2">
              {data.comments.map(({ comment, profile }) => (
                <div key={comment.id} className="rounded-lg bg-[#F5F6F4] px-3 py-2 text-sm">
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
      </div>
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

function MatchingRoundSubmitList({
  rounds,
  tournamentId,
  roundNumber,
  courseName,
  compact = false,
}: {
  rounds: MatchingTournamentRound[];
  tournamentId: string;
  roundNumber: number | null;
  courseName: string | null;
  compact?: boolean;
}) {
  const courseLabel = courseName ?? "this course";

  return (
    <div className="grid gap-3">
      <div>
        <p className="text-sm font-semibold">Saved rounds for {courseLabel}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Upload/import a round as usual. If the course matches this event, it appears here automatically.
        </p>
      </div>
      {rounds.length > 0 ? (
        <div className="grid gap-2">
          {rounds.map((round) => {
            const canSubmit = roundNumber !== null && round.grossScore !== null && !round.alreadySubmitted;
            const buttonLabel = round.alreadySubmitted
              ? "Already submitted"
              : roundNumber === null
                ? "All rounds submitted"
                : `Submit as round ${roundNumber}`;

            return (
              <div key={round.id} className="rounded-xl border border-[#E5E7EB] bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{round.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {roundDateFormatter.format(round.date)}
                      {round.teeSetName ? ` · ${round.teeSetName}` : ""}
                      {round.holeCount ? ` · ${round.holeCount} holes` : ""}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {round.grossScore ?? "--"}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="secondary">{round.proofLabel}</Badge>
                  {round.netScore !== null ? <Badge variant="outline">Net {round.netScore}</Badge> : null}
                  {round.alreadySubmitted ? <Badge variant="outline">Submitted</Badge> : null}
                </div>
                <form action={submitTournamentRoundAction} className={compact ? "mt-3" : "mt-4"} data-tournament-submit-form>
                  <input type="hidden" name="tournamentId" value={tournamentId} />
                  <input type="hidden" name="roundNumber" value={roundNumber ?? ""} />
                  <input type="hidden" name="sessionId" value={round.id} />
                  <input type="hidden" name="grossScore" value={round.grossScore ?? ""} />
                  {round.netScore !== null ? <input type="hidden" name="netScore" value={round.netScore} /> : null}
                  {round.stablefordPoints !== null ? <input type="hidden" name="stablefordPoints" value={round.stablefordPoints} /> : null}
                  {round.csvHash ? <input type="hidden" name="csvHash" value={round.csvHash} /> : null}
                  {round.grossScore !== null ? <input type="hidden" name="extractedScorecardTotal" value={round.grossScore} /> : null}
                  <input type="hidden" name="scorecardScreenshotPath" value={`saved-round:${round.id}`} />
                  {round.hasRapsodoDirect ? <input type="hidden" name="hasRapsodoDirect" value="on" /> : null}
                  <Button
                    type="submit"
                    disabled={!canSubmit}
                    className="w-full rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]"
                  >
                    <Send className="size-4" />
                    {buttonLabel}
                  </Button>
                </form>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-[#D1D5DB] bg-[#F9FAFB] p-3 text-sm leading-5 text-muted-foreground">
          No saved scored rounds for {courseLabel} yet. Once you upload or import a matching round, it will be ready to submit here.
        </p>
      )}
    </div>
  );
}

function formatCutRule(rule: unknown) {
  const data = asRuleRecord(rule);

  if (!data || data.enabled === false) {
    return "None";
  }

  const afterRound =
    typeof data.afterRound === "number" ? ` after round ${data.afterRound}` : "";
  const topAndTies =
    typeof data.topAndTies === "number"
      ? `top ${data.topAndTies} and ties`
      : "top players and ties";
  const label = data.optional === true ? "Optional cut" : "Cut";

  return `${label}${afterRound}: ${topAndTies}.`;
}

function formatTiebreakerRule(rule: unknown) {
  const data = asRuleRecord(rule);

  if (!data) {
    return "Earliest valid submission if scores are tied.";
  }

  if (data.type === "sudden_death") {
    const holes = Array.isArray(data.holes)
      ? data.holes.filter((hole): hole is number => typeof hole === "number")
      : [];
    const netTieBreakers = Array.isArray(data.netTieBreakers)
      ? data.netTieBreakers.map(formatRuleToken)
      : [];
    const playoffText =
      holes.length > 0
        ? `Sudden-death playoff starting on ${holes.map((hole) => `hole ${hole}`).join(", ")}.`
        : "Sudden-death playoff.";

    return netTieBreakers.length > 0
      ? `${playoffText} Net ties use ${listText(netTieBreakers)}.`
      : playoffText;
  }

  if (data.type === "countback") {
    const order = Array.isArray(data.order)
      ? data.order.map(formatRuleToken)
      : [];

    return order.length > 0
      ? `Countback: ${listText(order)}.`
      : "Countback if scores are tied.";
  }

  if (Array.isArray(data.tieBreakers)) {
    return `Tiebreakers: ${listText(data.tieBreakers.map(formatRuleToken))}.`;
  }

  return "Earliest valid submission if scores are tied.";
}

function asRuleRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return Object.keys(value).length > 0 ? (value as Record<string, unknown>) : null;
}

function formatRuleToken(value: unknown) {
  if (typeof value !== "string") {
    return String(value);
  }

  const labels: Record<string, string> = {
    back_nine: "back nine",
    countback: "countback",
    earliest_submission: "earliest valid submission",
    final_round: "final round",
    last_six: "last six",
    last_three: "last three",
    net_total: "net total",
    sudden_death: "sudden death",
  };

  return labels[value] ?? value.replaceAll("_", " ");
}

function listText(items: string[]) {
  if (items.length <= 1) {
    return items[0] ?? "";
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function Rule({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#F5F6F4] px-3 py-2 text-sm">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 break-words">{value}</p>
    </div>
  );
}

function parseTournamentDetailTab(value?: string) {
  if (value === "submit" || value === "rules" || value === "chat") {
    return value;
  }

  return "board";
}
