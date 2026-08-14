import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Cuboid,
  Eye,
  EyeOff,
  Send,
  ShieldCheck,
  Trophy,
} from "lucide-react";

import { submitTournamentRoundAction } from "@/app/tournaments/actions";
import { TournamentWithdrawDialog } from "@/app/tournaments/tournament-withdraw-dialog";
import { OperationStepper, type OperationStep } from "@/components/app/operation-stepper";
import { DataTableFrame, PageShell, StatusPill } from "@/components/premium";
import {
  CompactLeaderboard,
  MobileAppShell,
  MobileStatusAction,
  MobileTopBar,
  NativeListSection,
  ProofBadge,
} from "@/components/mobile-sports";
import { ScorecardProofUploader } from "@/components/scorecard-proof-uploader";
import { TournamentEntryModal } from "@/components/tournament-entry-modal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { PageArtwork } from "@/components/visuals/page-artwork";
import { getRequestAppSurface } from "@/lib/app-surface-server";
import { hasCurrentTournamentEntryTermsMetadata } from "@/lib/tournament-entry-terms";
import { formatLabel, getTournamentDetailData } from "@/lib/tournaments";

export const dynamic = "force-dynamic";

type TournamentDetailPageProps = {
  params: Promise<{ tournamentId: string }>;
  searchParams?: Promise<{
    joined?: string;
    submission?: string;
    entryError?: string;
    hideTour?: string;
  }>;
};

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
}: TournamentDetailPageProps) {
  const [{ tournamentId }, query] = await Promise.all([params, searchParams]);
  const [data, surface] = await Promise.all([
    getTournamentDetailData(tournamentId),
    getRequestAppSurface(),
  ]);

  if (!data) notFound();

  const workbench =
    surface === "workbench" ? await import("@/components/app/desktop-workbench") : null;
  const DesktopWorkbenchLayout = workbench?.DesktopWorkbenchLayout;
  const hideTourPlayers = query?.hideTour === "1";
  const tourStandingCount = data.standings.filter(({ profile }) =>
    isTourPlayerProfile(profile),
  ).length;
  const visibleStandings = hideTourPlayers
    ? data.standings.filter(({ profile }) => !isTourPlayerProfile(profile))
    : data.standings;
  const viewerStanding =
    data.standings.find((row) => row.standing.userId === data.viewerUserId) ?? null;
  const viewerTermsCurrent = data.viewerEntry
    ? hasCurrentTournamentEntryTermsMetadata(data.viewerEntry.metadataJson)
    : false;
  const progressSteps = buildProgressSteps(data);
  const latestSubmission = data.viewerSubmissions[0] ?? null;
  const leaderboardToggleHref = hideTourPlayers
    ? `/tournaments/${data.tournament.id}`
    : `/tournaments/${data.tournament.id}?hideTour=1`;

  return (
    <PageShell>
      {surface === "companion" ? (
        <MobileAppShell>
          <MobileTopBar
            title="Tournament"
            actions={
              <ProofBadge tier={data.tournament.directRapsodoRequired ? "gold" : "silver"} />
            }
          />

          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <PageArtwork
              variant="tourCover"
              alt=""
              cropKey={data.tournament.id}
              className="block h-36 w-full min-h-0 aspect-auto rounded-none"
              sizes="calc(100vw - 2rem)"
              priority
            />
            <div className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <EventStatus tournament={data.tournament} />
                <Badge variant="outline">{formatLabel(data.tournament.format)}</Badge>
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-balance">
                {data.tournament.title}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {data.course?.name ?? "Course TBD"} · {data.teeSet?.name ?? "Any tee"}
              </p>
              <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarDays className="size-3.5" />
                {formatEventWindow(data.tournament.startsAt, data.tournament.endsAt)}
              </p>
            </div>
          </section>

          <MobileStatusAction
            label="Your position"
            value={viewerStanding ? `#${viewerStanding.standing.rank ?? "--"}` : "Not ranked"}
            detail={mobileResultDetail(data, viewerStanding)}
            action={
              <TournamentPrimaryAction data={data} viewerTermsCurrent={viewerTermsCurrent} mobile />
            }
          />

          <NativeListSection title="Next round">
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">
                    {tournamentStatus(data.tournament) === "Completed"
                      ? "Event complete"
                      : data.nextRoundNumber
                        ? `Round ${data.nextRoundNumber}`
                        : "Rounds complete"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {nextRoundDetail(data)}
                  </p>
                </div>
                <Badge variant={data.nextRoundNumber ? "secondary" : "outline"}>
                  {data.viewerSubmissions.length}/{data.tournament.roundCount}
                </Badge>
              </div>
              <OperationStepper
                compact
                label="Tournament round progression"
                steps={progressSteps}
                className="mt-3 border-0 bg-muted/45"
              />
            </div>
          </NativeListSection>

          <NativeListSection title="Leaderboard preview">
            {tourStandingCount > 0 ? (
              <div className="mb-2 flex justify-end">
                <Button asChild variant="outline" size="sm" className="rounded-full">
                  <Link href={leaderboardToggleHref} prefetch={false}>
                    {hideTourPlayers ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                    {hideTourPlayers ? "Show tour" : "Hide tour"}
                  </Link>
                </Button>
              </div>
            ) : null}
            <CompactLeaderboard
              current={
                viewerStanding
                  ? `You are #${viewerStanding.standing.rank ?? "--"} · ${viewerStanding.standing.grossTotal}`
                  : "Submit an accepted round to join the board"
              }
              items={visibleStandings.slice(0, 5).map(({ standing, profile }) => ({
                rank: standing.rank,
                name: profile?.displayName ?? "Player",
                href: profileHref(profile),
                value: standing.grossTotal,
                detail: `${standing.roundsCompleted}/${data.tournament.roundCount} rounds`,
              }))}
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <LeaderboardSheet rows={visibleStandings} data={data} />
              <TournamentRulesSheet data={data} />
            </div>
          </NativeListSection>
        </MobileAppShell>
      ) : null}

      {surface === "workbench" && DesktopWorkbenchLayout ? (
        <DesktopWorkbenchLayout scope="tournament-detail">
          <div className="flex items-center justify-between gap-3">
            <Button asChild variant="ghost" className="px-0">
              <Link href="/tournaments" prefetch={false}>
                <ArrowLeft className="size-4" />
                Tournaments
              </Link>
            </Button>
            <EventStatus tournament={data.tournament} />
          </div>

          <header className="premium-hero overflow-hidden p-0">
            <div className="grid min-h-[320px] lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
              <div className="flex flex-col justify-between p-6 sm:p-8 lg:p-10">
                <div>
                  <StatusPill tone="amber">{formatLabel(data.tournament.format)}</StatusPill>
                  <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                    {data.tournament.title}
                  </h1>
                  <p className="mt-3 text-base text-muted-foreground">
                    {data.course?.name ?? "Course TBD"} · {data.teeSet?.name ?? "Any tee"}
                  </p>
                </div>
                <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-border pt-5 sm:grid-cols-4">
                  <HeaderFact
                    label="Dates"
                    value={formatEventWindow(data.tournament.startsAt, data.tournament.endsAt)}
                  />
                  <HeaderFact label="Format" value={formatLabel(data.tournament.format)} />
                  <HeaderFact
                    label="Rounds"
                    value={`${data.tournament.roundCount} round${data.tournament.roundCount === 1 ? "" : "s"}`}
                  />
                  <HeaderFact label="Entries" value={String(data.entries.length)} />
                </dl>
              </div>
              <PageArtwork
                variant="tourCover"
                alt=""
                cropKey={data.tournament.id}
                className="block h-full min-h-72 rounded-none border-t border-border lg:border-t-0 lg:border-l"
                sizes="(min-width: 1024px) 38vw, 100vw"
                priority
              />
            </div>
          </header>

          {query?.entryError === "terms" ? (
            <Alert variant="destructive">
              <AlertTitle>Terms must be accepted</AlertTitle>
              <AlertDescription>
                Accept the tournament entry terms before registering.
              </AlertDescription>
            </Alert>
          ) : query?.submission ? (
            <Alert>
              <CheckCircle2 className="size-4" />
              <AlertTitle>Round submitted</AlertTitle>
              <AlertDescription>Your submission status is shown below.</AlertDescription>
            </Alert>
          ) : null}

          <section aria-labelledby="round-progress-title" className="rounded-xl border bg-card p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  Round progress
                </p>
                <h2 id="round-progress-title" className="mt-1 text-xl font-semibold">
                  {tournamentStatus(data.tournament) === "Completed"
                    ? "Final round record"
                    : data.nextRoundNumber
                      ? `Round ${data.nextRoundNumber} is next`
                      : "All rounds complete"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{nextRoundDetail(data)}</p>
              </div>
              <Badge variant="outline" className="tabular-nums">
                {data.viewerSubmissions.length}/{data.tournament.roundCount} submitted
              </Badge>
            </div>
            <OperationStepper
              label="Tournament round progression"
              steps={progressSteps}
              className="mt-4 border-0 bg-muted/45 p-4"
            />
          </section>

          <section id="leaderboard" aria-labelledby="leaderboard-title" className="scroll-mt-28">
            <Card className="gap-0 py-0">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                      Leaderboard
                    </p>
                    <h2 id="leaderboard-title" className="mt-1 text-xl font-semibold">
                      Event standings
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {visibleStandings.length} ranked{" "}
                      {visibleStandings.length === 1 ? "player" : "players"}
                      {hideTourPlayers ? ` · ${tourStandingCount} tour players hidden` : ""}
                    </p>
                  </div>
                  {tourStandingCount > 0 ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href={leaderboardToggleHref} prefetch={false}>
                        {hideTourPlayers ? (
                          <Eye className="size-4" />
                        ) : (
                          <EyeOff className="size-4" />
                        )}
                        {hideTourPlayers ? "Show tour players" : "Hide tour players"}
                      </Link>
                    </Button>
                  ) : null}
                </div>
                <TournamentStandingsTable
                  rows={visibleStandings}
                  roundCount={data.tournament.roundCount}
                  viewerUserId={data.viewerUserId}
                />
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card id="your-result" className="scroll-mt-28 gap-0 py-0">
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  Your current result
                </p>
                {viewerStanding ? (
                  <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-4">
                    <div className="row-span-2 flex size-24 items-center justify-center rounded-full border-4 border-primary/20 bg-primary/8">
                      <span className="text-3xl font-semibold tabular-nums">
                        #{viewerStanding.standing.rank ?? "--"}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Gross total</p>
                      <p className="mt-1 text-3xl font-semibold tabular-nums">
                        {viewerStanding.standing.grossTotal}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">
                        Net {viewerStanding.standing.netTotal ?? "--"}
                      </Badge>
                      <Badge variant="outline">
                        {viewerStanding.standing.roundsCompleted}/{data.tournament.roundCount}{" "}
                        rounds
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed bg-muted/35 p-4">
                    <p className="font-semibold">
                      {data.viewerEntered ? "Awaiting an accepted score" : "You have not entered"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {data.viewerEntered
                        ? "Your position appears after a submitted round is accepted into the standings."
                        : "Enter the event to submit rounds and take a position on the leaderboard."}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="gap-0 py-0">
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  Submission status
                </p>
                <div className="mt-4 rounded-xl bg-muted/45 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {submissionStatusHeading(data, latestSubmission)}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {submissionStatusDetail(data, latestSubmission)}
                      </p>
                    </div>
                    <Badge variant={latestSubmission ? "secondary" : "outline"}>
                      {tournamentStatus(data.tournament) === "Completed"
                        ? "Closed"
                        : latestSubmission
                          ? formatLabel(latestSubmission.verificationStatus)
                          : data.viewerEntered
                            ? "Ready"
                            : "Entry needed"}
                    </Badge>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <TournamentPrimaryAction data={data} viewerTermsCurrent={viewerTermsCurrent} />
                  <TournamentRulesSheet data={data} />
                </div>
                {data.course?.id &&
                data.viewerEntered &&
                viewerTermsCurrent &&
                data.nextRoundNumber ? (
                  <Button asChild variant="outline" className="mt-2 w-full">
                    <Link
                      href={`/play/${data.course.id}?tournamentId=${data.tournament.id}&roundNumber=${data.nextRoundNumber}`}
                      prefetch={false}
                    >
                      <Cuboid className="size-4" /> Play verified 3D round
                    </Link>
                  </Button>
                ) : null}
                {data.viewerEntered && data.tournament.createdByUserId !== data.viewerUserId ? (
                  <div className="mt-2">
                    <TournamentWithdrawDialog
                      tournamentId={data.tournament.id}
                      tournamentTitle={data.tournament.title}
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </section>
        </DesktopWorkbenchLayout>
      ) : null}
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

  return <TournamentSubmitDialog data={data} mobile={mobile} />;
}

function TournamentSubmitDialog({
  data,
  mobile = false,
}: {
  data: TournamentDetailData;
  mobile?: boolean;
}) {
  return (
    <Dialog>
      <DialogTrigger
        type="button"
        data-variant="default"
        className={buttonVariants({ className: mobile ? "rounded-full" : "w-full" })}
      >
        <Send className="size-4" />
        Submit round
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Submit round {data.nextRoundNumber}</DialogTitle>
          <DialogDescription>
            Choose a matching saved round or submit a scorecard with its proof.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 lg:grid-cols-2">
          <MatchingRoundSubmitList
            rounds={data.matchingRounds}
            tournamentId={data.tournament.id}
            roundNumber={data.nextRoundNumber}
            courseName={data.course?.name ?? null}
          />
          <ManualRoundSubmitForm data={data} />
        </div>
      </DialogContent>
    </Dialog>
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
      <form action={submitTournamentRoundAction} className="grid gap-3" data-tournament-submit-form>
        <input type="hidden" name="tournamentId" value={data.tournament.id} />
        <label className="grid gap-1 text-sm font-medium">
          Round
          <Input
            name="roundNumber"
            type="number"
            min={1}
            max={data.tournament.roundCount}
            defaultValue={data.nextRoundNumber ?? data.tournament.roundCount}
            className="bg-background"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-sm font-medium">
            Gross
            <Input name="grossScore" inputMode="numeric" className="bg-background" required />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Net
            <Input name="netScore" inputMode="numeric" className="bg-background" />
          </label>
        </div>
        <label className="grid gap-1 text-sm font-medium">
          Linked imported round
          <Input
            name="sessionId"
            placeholder="Optional round reference"
            className="bg-background"
          />
        </label>
        <ScorecardProofUploader
          proofScopeType="tournament"
          proofScopeId={data.tournament.id}
          screenshotFieldName="scorecardScreenshotPath"
          extractedTotalFieldName="extractedScorecardTotal"
          screenshotLabel="Scorecard image"
          extractedTotalLabel="Extracted total"
        />
        <p className="rounded-lg bg-card p-3 text-xs leading-5 text-muted-foreground">
          Manual scores remain pending until the server matches owned round evidence. Only verified
          submissions enter the leaderboard.
        </p>
        <Button type="submit">
          <Send className="size-4" /> Submit manual score
        </Button>
      </form>
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
      </SheetContent>
    </Sheet>
  );
}

function LeaderboardSheet({
  rows,
  data,
}: {
  rows: TournamentStandingRow[];
  data: TournamentDetailData;
}) {
  return (
    <Sheet>
      <SheetTrigger
        type="button"
        data-variant="outline"
        className={buttonVariants({ variant: "outline", className: "w-full" })}
      >
        <Trophy className="size-4" /> Full board
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[82vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Full leaderboard</SheetTitle>
          <SheetDescription>{data.tournament.title}</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <TournamentStandingsTable
            rows={rows}
            roundCount={data.tournament.roundCount}
            viewerUserId={data.viewerUserId}
          />
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
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  No accepted scores yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DataTableFrame>
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
              <form
                action={submitTournamentRoundAction}
                className="mt-3"
                data-tournament-submit-form
              >
                <input type="hidden" name="tournamentId" value={tournamentId} />
                <input type="hidden" name="roundNumber" value={roundNumber ?? ""} />
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
                <Button type="submit" disabled={!canSubmit} className="w-full">
                  <Send className="size-4" />
                  {round.alreadySubmitted
                    ? "Already submitted"
                    : roundNumber
                      ? `Submit as round ${roundNumber}`
                      : "All rounds submitted"}
                </Button>
              </form>
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

function HeaderFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold">{value}</dd>
    </div>
  );
}

function buildProgressSteps(data: TournamentDetailData): OperationStep[] {
  const eventCompleted = tournamentStatus(data.tournament) === "Completed";
  return Array.from({ length: data.tournament.roundCount }, (_, index) => {
    const roundNumber = index + 1;
    const submitted = data.viewerSubmissions.some(
      (submission) => submission.roundNumber === roundNumber,
    );
    return {
      id: `round-${roundNumber}`,
      label: `Round ${roundNumber}`,
      description: submitted
        ? "Submitted"
        : eventCompleted
          ? "Not submitted"
          : data.nextRoundNumber === roundNumber
            ? "Next to play"
            : "Upcoming",
      status: submitted
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
      ? "Every required round was submitted before the event closed."
      : `The event is closed with ${data.viewerSubmissions.length}/${data.tournament.roundCount} rounds submitted.`;
  }
  if (!data.viewerEntered) return "Enter the tournament before a round can be submitted.";
  if (!data.nextRoundNumber) return "Every required round has been submitted.";
  return `${data.tournament.roundCount - data.viewerSubmissions.length} round${data.tournament.roundCount - data.viewerSubmissions.length === 1 ? "" : "s"} left in this event.`;
}

function mobileResultDetail(
  data: TournamentDetailData,
  viewerStanding: TournamentStandingRow | null,
) {
  if (viewerStanding) {
    return `${viewerStanding.standing.grossTotal} gross · ${viewerStanding.standing.roundsCompleted}/${data.tournament.roundCount} rounds`;
  }
  return data.viewerEntered
    ? "Submit an accepted round to take a position"
    : "Enter to join the leaderboard";
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
