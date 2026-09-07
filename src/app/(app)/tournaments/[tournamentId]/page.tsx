import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Cuboid, ShieldCheck, Trophy } from "lucide-react";
import { TournamentSubmissionForm } from "@/app/tournaments/tournament-submission-form";
import { TournamentWithdrawDialog } from "@/app/tournaments/tournament-withdraw-dialog";
import { TournamentDetailSections } from "@/app/tournaments/tournament-detail-sections";
import { TournamentRoundProgress } from "@/app/tournaments/tournament-round-progress";
import { DataTableFrame, PageShell } from "@/components/premium";
import { TournamentEntryModal } from "@/components/tournament-entry-modal";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";

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
import { hasCurrentTournamentEntryTermsMetadata } from "@/lib/tournament-entry-terms";
import { formatLabel, getTournamentDetailData } from "@/lib/tournaments";
import boardStyles from "@/app/course-records/course-record-board.module.css";
import type { OperationStep } from "@/components/app/operation-stepper";
export const dynamic = "force-dynamic";
type TournamentDetailData = NonNullable<Awaited<ReturnType<typeof getTournamentDetailData>>>;
type TournamentStandingRow = TournamentDetailData["standings"][number];
type MatchingTournamentRound = TournamentDetailData["matchingRounds"][number];
type ProfileIdentity = { username: string; displayName: string } | null | undefined;
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
export default async function TournamentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ tournamentId: string }>;
  searchParams?: Promise<{
    tab?: string;
    joined?: string;
    submission?: string;
    entryError?: string;
    hideTour?: string;
  }>;
}) {
  const [{ tournamentId }, query] = await Promise.all([params, searchParams]);
  const data = await getTournamentDetailData(tournamentId);
  if (!data) notFound();
  const viewerTermsCurrent = data.viewerEntry
    ? hasCurrentTournamentEntryTermsMetadata(data.viewerEntry.metadataJson)
    : false;
  const visibleStandings =
    query?.hideTour === "1"
      ? data.standings.filter(({ profile }) => !isTourPlayerProfile(profile))
      : data.standings;
  const viewerStanding = data.standings.find((row) => row.standing.userId === data.viewerUserId);
  const latestSubmission = data.viewerSubmissions[0] ?? null;
  const active =
    query?.tab === "rounds"
      ? "submit"
      : ["board", "rules", "submit"].includes(query?.tab ?? "")
        ? query!.tab!
        : "board";
  const canSubmit =
    data.viewerEntered &&
    viewerTermsCurrent &&
    !!data.nextRoundNumber &&
    tournamentStatus(data.tournament) !== "Completed";
  const receipt = query?.submission
    ? data.viewerSubmissions.find((item) => item.id === query.submission)
    : null;
  const filterQuery = new URLSearchParams({ tab: "board" });
  if (query?.hideTour !== "1") filterQuery.set("hideTour", "1");
  return (
    <PageShell>
      <div className="grid min-w-0 gap-5">
        <header className="grid gap-3 rounded-xl border bg-card p-4 sm:p-5">
          <Link
            href="/tournaments"
            className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground"
          >
            <ArrowLeft className="size-4" />
            Tournaments
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-2">
                <EventStatus tournament={data.tournament} />
                <Badge variant="outline">{formatLabel(data.tournament.format)}</Badge>
                <Badge variant="outline">
                  {data.viewerEntered ? "Entered" : "No active entry"}
                </Badge>
              </div>
              <h1 className="mt-2 break-words text-2xl font-semibold sm:text-3xl">
                {data.tournament.title}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {data.course?.name ?? "Course TBD"} · {data.teeSet?.name ?? "Any tee"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatEventWindow(data.tournament.startsAt, data.tournament.endsAt)} ·{" "}
                {data.entries.length} entries · {data.tournament.roundCount} round
                {data.tournament.roundCount === 1 ? "" : "s"}
              </p>
            </div>
            <div className="w-full sm:w-auto">
              <TournamentPrimaryAction data={data} viewerTermsCurrent={viewerTermsCurrent} />
            </div>
          </div>
          {data.tournament.description ? (
            <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {data.tournament.description}
            </p>
          ) : null}
        </header>
        {query?.entryError ? (
          <p role="alert" className="rounded-xl border border-destructive p-4">
            Entry was not confirmed. Review and accept the current tournament terms before entering.
          </p>
        ) : null}
        {query?.submission ? (
          <p role="status" className="rounded-xl border p-4">
            {receipt
              ? `Round ${receipt.roundNumber} saved: ${formatLabel(receipt.verificationStatus)}. Submission is not a guarantee of acceptance into the standings.`
              : "That submission receipt is unavailable. Your saved submission history is shown below."}
          </p>
        ) : null}
        <section aria-labelledby="round-progress-title" className="rounded-xl border bg-card p-4">
          <h2 id="round-progress-title" className="text-lg font-semibold">
            Round progress
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{nextRoundDetail(data)}</p>
          <TournamentRoundProgress steps={buildProgressSteps(data)} />
        </section>
        <section
          id="your-result"
          className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2"
        >
          <div>
            <h2 className="font-semibold">Your current result</h2>
            <p className="mt-2">
              {viewerStanding
                ? `#${viewerStanding.standing.rank ?? "–"} · ${viewerStanding.standing.grossTotal} gross · Net ${viewerStanding.standing.netTotal ?? "–"} · ${viewerStanding.standing.roundsCompleted}/${data.tournament.roundCount} round{data.tournament.roundCount === 1 ? "" : "s"}`
                : data.viewerEntered
                  ? "Awaiting an accepted score"
                  : "No active entry"}
            </p>
          </div>
          <div>
            <h2 className="font-semibold">{submissionStatusHeading(data, latestSubmission)}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {submissionStatusDetail(data, latestSubmission)}
            </p>
          </div>
        </section>
        <TournamentDetailSections
          key={data.tournament.id}
          active={active}
          items={[
            {
              id: "board",
              label: "Leaderboard",
              content: (
                <section className="min-w-0 rounded-xl border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">Event standings</h2>
                    <Button asChild variant="outline">
                      <Link href={`/tournaments/${data.tournament.id}?${filterQuery}`}>
                        {query?.hideTour === "1" ? "Show tour players" : "Hide tour players"}
                      </Link>
                    </Button>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {visibleStandings.length} ranked players. Accepted scores only; positions and
                    ties follow the event scoring rules.
                  </p>
                  <TournamentStandingsTable
                    rows={visibleStandings}
                    roundCount={data.tournament.roundCount}
                    viewerUserId={data.viewerUserId}
                  />
                </section>
              ),
            },
            {
              id: "submit",
              label: "Rounds & submissions",
              content: (
                <section className="grid gap-4">
                  <h2 className="text-lg font-semibold">Your tournament rounds</h2>
                  {canSubmit ? (
                    <div className="grid gap-5 lg:grid-cols-2">
                      <MatchingRoundSubmitList
                        rounds={data.matchingRounds}
                        tournamentId={data.tournament.id}
                        roundNumber={data.nextRoundNumber}
                        courseName={data.course?.name ?? null}
                      />
                      <ManualRoundSubmitForm data={data} />
                    </div>
                  ) : (
                    <p className="rounded-xl border p-4">
                      {tournamentStatus(data.tournament) === "Completed"
                        ? "The event is closed. Review your saved submissions below."
                        : !data.viewerEntered || !viewerTermsCurrent
                          ? "Enter and accept the current terms before submitting a round."
                          : "Every required round has been submitted."}
                    </p>
                  )}
                  {data.course?.id && canSubmit ? (
                    <Button asChild variant="outline">
                      <Link
                        href={`/play/${data.course.id}?tournamentId=${data.tournament.id}&roundNumber=${data.nextRoundNumber}`}
                      >
                        {" "}
                        <Cuboid className="size-4" />
                        Play verified 3D round
                      </Link>
                    </Button>
                  ) : null}
                  <h3 className="font-semibold">Saved submissions</h3>
                  {data.viewerSubmissions.length ? (
                    data.viewerSubmissions.map((item) => (
                      <article key={item.id} className="rounded-xl border bg-card p-4">
                        <h4 className="font-semibold">Round {item.roundNumber}</h4>
                        <p className="mt-2 text-sm">
                          Gross {item.grossScore ?? "–"} · Net {item.netScore ?? "–"} ·{" "}
                          {formatLabel(item.verificationStatus)}
                        </p>
                      </article>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No rounds submitted yet.</p>
                  )}
                </section>
              ),
            },
            {
              id: "rules",
              label: "Rules & entry",
              content: (
                <section className="grid gap-4 rounded-xl border bg-card p-4">
                  <h2 className="text-lg font-semibold">Rules & entry</h2>
                  <TournamentRulesContent data={data} />
                  <TournamentRulesSheet data={data} />
                  {data.viewerEntered && data.tournament.createdByUserId !== data.viewerUserId ? (
                    <TournamentWithdrawDialog
                      tournamentId={data.tournament.id}
                      tournamentTitle={data.tournament.title}
                    />
                  ) : null}
                </section>
              ),
            },
          ]}
        />
      </div>
    </PageShell>
  );
}
function TournamentPrimaryAction({
  data,
  viewerTermsCurrent,
  mobile = false,
}: {
  data: TournamentDetailData;
  viewerTermsCurrent: boolean;
  mobile?: boolean;
}) {
  if (tournamentStatus(data.tournament) === "Completed") {
    return (
      <Button asChild variant="outline" className={mobile ? "rounded-full" : "w-full"}>
        <a href="#your-result">
          <Trophy className="size-4" /> {data.viewerEntered ? "Open result" : "View result"}
        </a>
      </Button>
    );
  }

  if (!data.viewerEntered || !viewerTermsCurrent) {
    return (
      <TournamentEntryModal
        tournamentId={data.tournament.id}
        tournamentTitle={data.tournament.title}
        courseName={data.course?.name ?? "Course TBD"}
        teeSetName={data.teeSet?.name ?? "Any tee"}
        roundCount={data.tournament.roundCount}
        triggerLabel={data.viewerEntered ? "Accept terms" : "Enter tournament"}
      />
    );
  }

  if (!data.nextRoundNumber) {
    return (
      <Button asChild className={mobile ? "rounded-full" : "w-full"}>
        <a href="#your-result">
          <Trophy className="size-4" /> Open result
        </a>
      </Button>
    );
  }

  return (
    <Button asChild>
      <Link href={`/tournaments/${data.tournament.id}?tab=submit`}>
        Review & submit round {data.nextRoundNumber}
      </Link>
    </Button>
  );
}

function ManualRoundSubmitForm({ data }: { data: TournamentDetailData }) {
  return (
    <div className="grid content-start gap-3 rounded-xl border bg-muted/35 p-4">
      <div>
        <p className="text-sm font-semibold">Manual scorecard</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Use this when the matching saved round has not appeared yet.
        </p>
      </div>
      <TournamentSubmissionForm
        key={data.nextRoundNumber ?? "complete"}
        manual
        tournamentId={data.tournament.id}
        roundNumber={data.nextRoundNumber ?? data.tournament.roundCount}
        roundCount={data.tournament.roundCount}
      />
    </div>
  );
}

function TournamentRulesSheet({ data }: { data: TournamentDetailData }) {
  return (
    <Sheet>
      <SheetTrigger
        type="button"
        data-variant="outline"
        className={buttonVariants({ variant: "outline", className: "w-full" })}
      >
        <ShieldCheck className="size-4" /> Rules
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{data.tournament.title} rules</SheetTitle>
          <SheetDescription>
            Scoring, proof, mulligan and tiebreaker requirements for this event.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-2 px-4 pb-6">
          <TournamentRulesContent data={data} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TournamentStandingsTable({
  rows,
  roundCount,
  viewerUserId,
}: {
  rows: TournamentStandingRow[];
  roundCount: number;
  viewerUserId: string;
}) {
  return (
    <div className="mt-4">
      <div className={boardStyles.mobile}>
        {rows.length ? (
          rows.map(({ standing, profile }) => (
            <article
              key={standing.id}
              className={`rounded-xl border p-4 ${standing.userId === viewerUserId ? "border-primary bg-primary/5" : ""}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">#{standing.rank ?? "–"}</span>
                <ProfileNameLink profile={profile} className="break-words font-semibold" />
                {standing.userId === viewerUserId ? <Badge>You</Badge> : null}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt>Gross</dt>
                  <dd className="font-semibold">{standing.grossTotal}</dd>
                </div>
                <div>
                  <dt>Rounds completed</dt>
                  <dd>
                    {standing.roundsCompleted}/{roundCount}
                  </dd>
                </div>
                <div>
                  <dt>Net</dt>
                  <dd>{standing.netTotal ?? "–"}</dd>
                </div>
                <div>
                  <dt>Points</dt>
                  <dd>{standing.stablefordTotal ?? "–"}</dd>
                </div>
              </dl>
              <p className="mt-3 text-sm">
                {formatLabel(standing.status)}
                {isTourPlayerProfile(profile) ? " · Tour player" : ""}
              </p>
            </article>
          ))
        ) : (
          <p className="rounded-xl border border-dashed p-4">No accepted scores yet.</p>
        )}
      </div>
      <div className={boardStyles.desktop}>
        <DataTableFrame mainTable mainTableLabel="Tournament leaderboard" stickyFirstColumn>
          <Table aria-describedby="tournament-leaderboard-summary">
            <TableCaption id="tournament-leaderboard-summary" className="sr-only">
              Tournament leaderboard showing position, player, rounds completed, gross, net,
              stableford and result status.
            </TableCaption>
            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-muted">
              <TableRow>
                <TableHead className="sticky left-0 z-20 w-20 bg-muted">Pos</TableHead>
                <TableHead className="min-w-56">Player</TableHead>
                <TableHead className="text-center">Thru</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="text-right">Points</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length > 0 ? (
                rows.map(({ standing, profile }) => {
                  const isViewer = standing.userId === viewerUserId;
                  return (
                    <TableRow key={standing.id} className={isViewer ? "bg-primary/8" : undefined}>
                      <TableCell className="sticky left-0 z-10 bg-card text-lg font-semibold tabular-nums">
                        {standing.rank ?? "–"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ProfileNameLink
                            profile={profile}
                            className="font-semibold hover:text-primary"
                          />
                          {isViewer ? <Badge variant="secondary">You</Badge> : null}
                          {isTourPlayerProfile(profile) ? (
                            <Badge variant="outline">Tour</Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {standing.roundsCompleted}/{roundCount}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {standing.grossTotal}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {standing.netTotal ?? "–"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {standing.stablefordTotal ?? "–"}
                      </TableCell>
                      <TableCell className="capitalize">
                        {standing.status.replaceAll("_", " ")}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No accepted scores yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DataTableFrame>
      </div>
    </div>
  );
}

function MatchingRoundSubmitList({
  rounds,
  tournamentId,
  roundNumber,
  courseName,
}: {
  rounds: MatchingTournamentRound[];
  tournamentId: string;
  roundNumber: number | null;
  courseName: string | null;
}) {
  const courseLabel = courseName ?? "this course";
  return (
    <div className="grid content-start gap-3">
      <div>
        <p className="text-sm font-semibold">Saved rounds for {courseLabel}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Matching uploaded or imported rounds are ready to submit here.
        </p>
      </div>
      {rounds.length > 0 ? (
        rounds.map((round) => {
          const canSubmit =
            roundNumber !== null && round.grossScore !== null && !round.alreadySubmitted;
          return (
            <div key={round.id} className="rounded-xl border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{round.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {dateFormatter.format(round.date)}
                    {round.teeSetName ? ` · ${round.teeSetName}` : ""}
                    {round.holeCount ? ` · ${round.holeCount} holes` : ""}
                  </p>
                </div>
                <Badge variant="outline">{round.grossScore ?? "–"}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="secondary">{round.proofLabel}</Badge>
                {round.netScore !== null ? (
                  <Badge variant="outline">Net {round.netScore}</Badge>
                ) : null}
                {round.alreadySubmitted ? <Badge variant="outline">Submitted</Badge> : null}
              </div>
              <TournamentSubmissionForm
                key={`${round.id}-${roundNumber}`}
                tournamentId={tournamentId}
                roundNumber={roundNumber ?? 1}
                disabled={!canSubmit}
              >
                <input type="hidden" name="sessionId" value={round.id} />
                <input type="hidden" name="grossScore" value={round.grossScore ?? ""} />
                {round.netScore !== null ? (
                  <input type="hidden" name="netScore" value={round.netScore} />
                ) : null}
                {round.stablefordPoints !== null ? (
                  <input type="hidden" name="stablefordPoints" value={round.stablefordPoints} />
                ) : null}
                {round.csvHash ? (
                  <input type="hidden" name="csvHash" value={round.csvHash} />
                ) : null}
                {round.grossScore !== null ? (
                  <input type="hidden" name="extractedScorecardTotal" value={round.grossScore} />
                ) : null}
                <input
                  type="hidden"
                  name="scorecardScreenshotPath"
                  value={`saved-round:${round.id}`}
                />
                {round.hasRapsodoDirect ? (
                  <input type="hidden" name="hasRapsodoDirect" value="on" />
                ) : null}
              </TournamentSubmissionForm>
            </div>
          );
        })
      ) : (
        <p className="rounded-xl border border-dashed bg-muted/35 p-3 text-sm leading-5 text-muted-foreground">
          No saved scored rounds for {courseLabel} yet. Import a matching round or use the manual
          scorecard form.
        </p>
      )}
    </div>
  );
}

function EventStatus({ tournament }: { tournament: TournamentDetailData["tournament"] }) {
  const status = tournamentStatus(tournament);
  return <Badge variant={status === "Active" ? "secondary" : "outline"}>{status}</Badge>;
}

function buildProgressSteps(data: TournamentDetailData): OperationStep[] {
  const eventCompleted = tournamentStatus(data.tournament) === "Completed";
  return Array.from({ length: data.tournament.roundCount }, (_, index) => {
    const roundNumber = index + 1;
    const submission = data.viewerSubmissions.find(
      (submission) => submission.roundNumber === roundNumber,
    );
    return {
      id: `round-${roundNumber}`,
      label: `Round ${roundNumber}`,
      description: submission
        ? `Submitted · ${formatLabel(submission.verificationStatus)}`
        : eventCompleted
          ? "Not submitted"
          : data.nextRoundNumber === roundNumber
            ? "Next to play"
            : "Upcoming",
      status: submission
        ? ("complete" as const)
        : eventCompleted
          ? ("upcoming" as const)
          : data.nextRoundNumber === roundNumber
            ? ("current" as const)
            : ("upcoming" as const),
    };
  });
}

function nextRoundDetail(data: TournamentDetailData) {
  if (tournamentStatus(data.tournament) === "Completed") {
    return data.viewerSubmissions.length === data.tournament.roundCount
      ? "Every required round has a saved submission."
      : `The event is closed with ${data.viewerSubmissions.length}/${data.tournament.roundCount} round{data.tournament.roundCount === 1 ? "" : "s"} submitted.`;
  }
  if (!data.viewerEntered) return "Enter the tournament before a round can be submitted.";
  if (!data.nextRoundNumber) return "Every required round has been submitted.";
  return `${data.tournament.roundCount - data.viewerSubmissions.length} round${data.tournament.roundCount - data.viewerSubmissions.length === 1 ? "" : "s"} left in this event.`;
}

function submissionStatusHeading(
  data: TournamentDetailData,
  latestSubmission: TournamentDetailData["viewerSubmissions"][number] | null,
) {
  if (tournamentStatus(data.tournament) === "Completed") {
    return data.viewerEntered ? "Event closed" : "No entry recorded";
  }
  if (!data.viewerEntered) return "Tournament entry required";
  if (!latestSubmission) return "Ready for your first round";
  return `Round ${latestSubmission.roundNumber} · ${formatLabel(latestSubmission.verificationStatus)}`;
}

function submissionStatusDetail(
  data: TournamentDetailData,
  latestSubmission: TournamentDetailData["viewerSubmissions"][number] | null,
) {
  if (tournamentStatus(data.tournament) === "Completed") {
    return data.viewerEntered
      ? "Submissions are closed. Your stored rounds and result remain available."
      : "This event is complete and no entry was recorded for you.";
  }
  if (!data.viewerEntered) return "Review and accept the event terms before submitting a score.";
  if (!latestSubmission) return "No round submissions are stored for this event yet.";
  return `${latestSubmission.grossScore} gross · ${formatLabel(latestSubmission.proofStatus)} proof · submitted ${dateFormatter.format(latestSubmission.submittedAt)}`;
}

function tournamentStatus(tournament: TournamentDetailData["tournament"]) {
  const now = Date.now();
  const status = tournament.status.toLowerCase();
  if (
    status === "completed" ||
    status === "closed" ||
    status === "finished" ||
    Boolean(tournament.endsAt && tournament.endsAt.getTime() < now)
  )
    return "Completed";
  if (
    status === "scheduled" ||
    status === "upcoming" ||
    Boolean(tournament.startsAt && tournament.startsAt.getTime() > now)
  )
    return "Upcoming";
  return "Active";
}

function formatEventWindow(startsAt: Date | null, endsAt: Date | null) {
  const start = startsAt ? dateFormatter.format(startsAt) : "Open";
  const end = endsAt ? dateFormatter.format(endsAt) : "No closing date";
  return startsAt && endsAt && start === end ? start : `${start} – ${end}`;
}

function isTourPlayerProfile(profile: TournamentStandingRow["profile"]) {
  return (
    profile?.visibilitySettingsJson?.profileKind === "tour-player" ||
    profile?.visibilitySettingsJson?.tourPlayer === true
  );
}

function profileHref(profile: ProfileIdentity) {
  return profile?.username ? `/profile/${profile.username}` : undefined;
}

function ProfileNameLink({ profile, className }: { profile: ProfileIdentity; className?: string }) {
  const label = profile?.displayName ?? "Player";
  const href = profileHref(profile);
  return href ? (
    <Link href={href} prefetch={false} className={className}>
      {label}
    </Link>
  ) : (
    <span className={className}>{label}</span>
  );
}

function formatCutRule(rule: unknown) {
  const data = asRuleRecord(rule);
  if (!data || data.enabled === false) return "None";
  const afterRound = typeof data.afterRound === "number" ? ` after round ${data.afterRound}` : "";
  const topAndTies =
    typeof data.topAndTies === "number"
      ? `top ${data.topAndTies} and ties`
      : "top players and ties";
  return `${data.optional === true ? "Optional cut" : "Cut"}${afterRound}: ${topAndTies}.`;
}

function formatTiebreakerRule(rule: unknown) {
  const data = asRuleRecord(rule);
  if (!data) return "Earliest valid submission if scores are tied.";
  if (data.type === "sudden_death") {
    const holes = Array.isArray(data.holes)
      ? data.holes.filter((hole): hole is number => typeof hole === "number")
      : [];
    return holes.length > 0
      ? `Sudden-death playoff starting on ${holes.map((hole) => `hole ${hole}`).join(", ")}.`
      : "Sudden-death playoff.";
  }
  if (data.type === "countback") {
    const order = Array.isArray(data.order) ? data.order.map(formatRuleToken) : [];
    return order.length > 0 ? `Countback: ${listText(order)}.` : "Countback if scores are tied.";
  }
  if (Array.isArray(data.tieBreakers))
    return `Tiebreakers: ${listText(data.tieBreakers.map(formatRuleToken))}.`;
  return "Earliest valid submission if scores are tied.";
}

function asRuleRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return Object.keys(value).length > 0 ? (value as Record<string, unknown>) : null;
}

function formatRuleToken(value: unknown) {
  if (typeof value !== "string") return String(value);
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
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function Rule({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/55 px-3 py-2 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 break-words">{value}</p>
    </div>
  );
}

function TournamentRulesContent({ data }: { data: TournamentDetailData }) {
  return (
    <div className="grid gap-2">
      {" "}
      <Rule label="Format" value={formatLabel(data.tournament.format)} />
      <Rule label="Rounds" value={String(data.tournament.roundCount)} />
      <Rule label="Mulligans" value="Not allowed in any tournament round" />
      <Rule
        label="Gimmes"
        value="10 ft for 1-putt, 20 ft for 2-putt; outside that, hole out or use event scoring."
      />
      <Rule label="Cut" value={formatCutRule(data.tournament.cutRuleJson)} />
      <Rule label="Tiebreaker" value={formatTiebreakerRule(data.tournament.playoffRuleJson)} />
      <Rule
        label="Proof"
        value={
          data.tournament.directRapsodoRequired
            ? "Direct Rapsodo evidence is required."
            : data.tournament.screenshotRequired
              ? "A scorecard screenshot is required."
              : "Owned round evidence is checked before a score enters the leaderboard."
        }
      />
    </div>
  );
}
