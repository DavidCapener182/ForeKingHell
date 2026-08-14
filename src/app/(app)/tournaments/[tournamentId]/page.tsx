import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Cuboid,
  Eye,
  EyeOff,
  MessageCircle,
  Send,
  ShieldCheck,
  Trophy,
} from "lucide-react";

import { addTournamentCommentAction, submitTournamentRoundAction } from "@/app/tournaments/actions";
import { TournamentWithdrawDialog } from "@/app/tournaments/tournament-withdraw-dialog";
import { OperationStepper } from "@/components/app/operation-stepper";
import type {
  DesktopSavedViewSuggestion,
  DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
} from "@/components/app/ios-mobile";
import { DataTableFrame, PageShell, StatusPill } from "@/components/premium";
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
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { hasCurrentTournamentEntryTermsMetadata } from "@/lib/tournament-entry-terms";
import { formatLabel, getTournamentDetailData } from "@/lib/tournaments";
import { getRequestAppSurface } from "@/lib/app-surface-server";

export const dynamic = "force-dynamic";

type TournamentDetailPageProps = {
  params: Promise<{ tournamentId: string }>;
  searchParams?: Promise<{
    joined?: string;
    submission?: string;
    comment?: string;
    entryError?: string;
    tab?: string;
    hideTour?: string;
  }>;
};

type TournamentDetailData = NonNullable<Awaited<ReturnType<typeof getTournamentDetailData>>>;
type MatchingTournamentRound = TournamentDetailData["matchingRounds"][number];
type ProfileIdentity = { username: string; displayName: string } | null | undefined;

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});
const roundDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const tournamentStandingsColumns: DesktopWorkbenchColumn[] = [
  { id: "rank", label: "Rank", locked: true },
  { id: "player", label: "Player" },
  { id: "gross", label: "Gross" },
  { id: "net", label: "Net" },
  { id: "stableford", label: "Stableford" },
  { id: "rounds", label: "Rounds" },
  { id: "status", label: "Status" },
  { id: "updated", label: "Updated" },
  { id: "action", label: "Action", locked: true },
];

const tournamentStandingsSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Standings",
    href: "#standings",
    detail: "Ranked event table with proof-aware totals.",
  },
  {
    title: "Submit round",
    href: "#submit-round",
    detail: "Add the next round from a saved or manual scorecard.",
  },
  {
    title: "Rules",
    href: "#rules",
    detail: "Review proof, mulligan and tiebreaker rules.",
  },
];

export default async function TournamentDetailPage({
  params,
  searchParams,
}: TournamentDetailPageProps) {
  const [{ tournamentId }, query] = await Promise.all([params, searchParams]);
  const [data, surface] = await Promise.all([
    getTournamentDetailData(tournamentId),
    getRequestAppSurface(),
  ]);

  if (!data) {
    notFound();
  }

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
  const hiddenTourStandingCount = hideTourPlayers ? tourStandingCount : 0;
  const leaderboardToggleHref = hideTourPlayers
    ? `/tournaments/${data.tournament.id}?tab=board`
    : `/tournaments/${data.tournament.id}?tab=board&hideTour=1`;
  const podium = visibleStandings.slice(0, 3);
  const viewerStanding =
    data.standings.find((row) => row.standing.userId === data.viewerUserId) ?? null;
  const viewerTermsCurrent = data.viewerEntry
    ? hasCurrentTournamentEntryTermsMetadata(data.viewerEntry.metadataJson)
    : false;
  const activeTab = parseTournamentDetailTab(query?.tab);

  return (
    <PageShell>
      {surface === "companion" ? (
        <MobileAppShell>
          <MobileTopBar
            title={data.tournament.title}
            actions={
              <ProofBadge tier={data.tournament.directRapsodoRequired ? "gold" : "silver"} />
            }
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
                <BottomSheet
                  label={
                    <>
                      <Send className="size-4" /> Submit
                    </>
                  }
                  title="Submit tournament round"
                >
                  <div className="grid gap-4">
                    <MatchingRoundSubmitList
                      rounds={data.matchingRounds}
                      tournamentId={data.tournament.id}
                      roundNumber={data.nextRoundNumber}
                      courseName={data.course?.name ?? null}
                      compact
                    />
                    <div className="grid gap-2 border-t border-border pt-4">
                      <p className="text-sm font-semibold">Manual score</p>
                      <p className="text-xs leading-5 text-muted-foreground">
                        Use this only if the saved round has not appeared yet.
                      </p>
                      <form
                        action={submitTournamentRoundAction}
                        className="grid gap-3"
                        data-tournament-submit-form
                      >
                        <input type="hidden" name="tournamentId" value={data.tournament.id} />
                        <Input
                          name="roundNumber"
                          type="number"
                          min={1}
                          max={data.tournament.roundCount}
                          defaultValue={data.nextRoundNumber ?? data.tournament.roundCount}
                          className="h-11 rounded-lg bg-background"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            name="grossScore"
                            inputMode="numeric"
                            placeholder="Gross"
                            className="h-11 rounded-lg bg-background"
                            required
                          />
                          <Input
                            name="netScore"
                            inputMode="numeric"
                            placeholder="Net"
                            className="h-11 rounded-lg bg-background"
                          />
                        </div>
                        <Input
                          name="sessionId"
                          placeholder="Linked imported round"
                          className="h-11 rounded-lg bg-background"
                        />
                        <ScorecardProofUploader
                          proofScopeType="tournament"
                          proofScopeId={data.tournament.id}
                          screenshotFieldName="scorecardScreenshotPath"
                          extractedTotalFieldName="extractedScorecardTotal"
                          screenshotLabel="Scorecard image"
                          extractedTotalLabel="Extracted total"
                        />
                        <p className="rounded-lg bg-muted/55 px-3 py-2 text-xs leading-5 text-muted-foreground">
                          Manual scores remain pending until the server can match owned round
                          evidence. Only verified submissions enter standings.
                        </p>
                        <Button type="submit" className="rounded-full">
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
          <section className="rounded-lg border border-border bg-card p-3">
            <p className="text-sm font-semibold text-primary">
              {formatLabel(data.tournament.format)}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-normal">{data.tournament.title}</h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              {data.course?.name ?? "Course TBD"} · {data.teeSet?.name ?? "Any tee"} ·{" "}
              {data.tournament.roundCount} rounds
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              {Array.from({ length: data.tournament.roundCount }, (_, index) => {
                const roundNumber = index + 1;
                const submitted = data.viewerSubmissions.some(
                  (submission) => submission.roundNumber === roundNumber,
                );
                const needed = data.nextRoundNumber === roundNumber;

                return (
                  <div key={roundNumber} className="rounded-lg bg-muted/55 px-3 py-2">
                    <p className="font-semibold">Round {roundNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {submitted ? "Submitted" : needed ? "Needed" : "Locked"}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
          <MobileTabBar
            activeKey={activeTab}
            tabs={[
              {
                key: "board",
                label: "Board",
                href: `/tournaments/${data.tournament.id}?tab=board`,
              },
              {
                key: "submit",
                label: "Submit",
                href: `/tournaments/${data.tournament.id}?tab=submit`,
              },
              {
                key: "rules",
                label: "Rules",
                href: `/tournaments/${data.tournament.id}?tab=rules`,
              },
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
                <div key={comment.id} className="rounded-lg bg-muted/55 px-3 py-2 text-sm">
                  <ProfileNameLink profile={profile} className="font-semibold hover:underline" />
                  <p className="mt-1 text-muted-foreground">{comment.body}</p>
                </div>
              ))}
              <form action={addTournamentCommentAction} className="grid gap-2">
                <input type="hidden" name="tournamentId" value={data.tournament.id} />
                <Input
                  name="body"
                  placeholder="Add a comment"
                  className="h-11 rounded-lg bg-background"
                />
                <Button type="submit" variant="outline" className="rounded-full">
                  Comment
                </Button>
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
                <p className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
                  {data.viewerEntered
                    ? "Accept the current no-mulligans terms before submitting."
                    : "Enter the tournament before submitting."}
                </p>
              )}
            </NativeListSection>
          ) : (
            <NativeListSection title="Podium">
              {tourStandingCount > 0 ? (
                <div className="mb-3 flex justify-end">
                  <Button asChild variant="outline" size="sm" className="h-9 rounded-full">
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
                    ? `You are #${viewerStanding.standing.rank} · ${viewerStanding.standing.grossTotal}`
                    : "Enter to appear on the board"
                }
                items={podium.map(({ standing, profile }) => ({
                  rank: standing.rank,
                  name: profile?.displayName ?? "Player",
                  href: profileHref(profile),
                  value: standing.grossTotal,
                  detail: `${standing.roundsCompleted}/${data.tournament.roundCount} rounds`,
                }))}
              />
              <MobileTournamentStandings
                visibleStandings={visibleStandings}
                roundCount={data.tournament.roundCount}
                viewerUserId={data.viewerUserId}
              />
            </NativeListSection>
          )}
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
            <Badge variant={data.tournament.directRapsodoRequired ? "secondary" : "outline"}>
              {data.tournament.directRapsodoRequired ? "Gold verification" : "Mixed verification"}
            </Badge>
          </div>

          <header className="premium-hero p-4 sm:p-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
              <div>
                <StatusPill tone="amber">{formatLabel(data.tournament.format)}</StatusPill>
                <h1 className="mt-3 text-3xl font-semibold tracking-normal text-balance">
                  {data.tournament.title}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {data.course?.name ?? "Course TBD"} · {data.teeSet?.name ?? "Any tee"} ·{" "}
                  {data.tournament.roundCount} rounds
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {data.course?.id && data.viewerEntered && viewerTermsCurrent ? (
                    <Button asChild size="sm">
                      <Link
                        href={`/play/${data.course.id}?tournamentId=${data.tournament.id}&roundNumber=${data.nextRoundNumber ?? data.tournament.roundCount}`}
                        prefetch={false}
                      >
                        <Cuboid className="size-4" /> Play verified 3D round
                      </Link>
                    </Button>
                  ) : null}
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
                    <AlertDescription>
                      Accept the tournament entry terms before registering.
                    </AlertDescription>
                  </Alert>
                ) : null}
              </div>
              <Card size="sm">
                <CardHeader>
                  <CardTitle>Your entry</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.viewerEntered ? (
                    <div className="grid gap-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">
                          {viewerStanding ? `Rank #${viewerStanding.standing.rank}` : "Entered"}
                        </Badge>
                        <Badge variant={viewerTermsCurrent ? "secondary" : "outline"}>
                          {viewerTermsCurrent ? "Terms accepted" : "Terms update needed"}
                        </Badge>
                      </div>
                      <p className="text-2xl font-semibold tracking-normal">
                        Round {data.nextRoundNumber ?? data.tournament.roundCount}:{" "}
                        {data.nextRoundNumber ? "Needed" : "Complete"}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {data.viewerSubmissions.length}/{data.tournament.roundCount} rounds
                        submitted
                      </p>
                      <OperationStepper
                        compact
                        label="Tournament round progression"
                        steps={Array.from({ length: data.tournament.roundCount }, (_, index) => {
                          const roundNumber = index + 1;
                          const submitted = data.viewerSubmissions.some(
                            (submission) => submission.roundNumber === roundNumber,
                          );
                          return {
                            id: `round-${roundNumber}`,
                            label: `R${roundNumber}`,
                            status: submitted
                              ? ("complete" as const)
                              : data.nextRoundNumber === roundNumber
                                ? ("current" as const)
                                : ("upcoming" as const),
                          };
                        })}
                      />
                      {viewerTermsCurrent ? (
                        <Button asChild className="mt-3 w-full rounded-lg">
                          <a href="#submit-round">Submit round</a>
                        </Button>
                      ) : (
                        <div className="mt-3 grid gap-3">
                          <p className="rounded-xl border border-dashed bg-card p-3 text-sm text-muted-foreground">
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
                      {data.tournament.createdByUserId !== data.viewerUserId ? (
                        <TournamentWithdrawDialog
                          tournamentId={data.tournament.id}
                          tournamentTitle={data.tournament.title}
                        />
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-3">
                      <p className="mb-3 rounded-xl border border-dashed bg-card p-3 text-sm text-muted-foreground">
                        Open the entry terms, confirm the simulator setup rules, then accept to
                        register.
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
                </CardContent>
              </Card>
            </div>
          </header>

          <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Tournament views">
            <Anchor href="#overview" label="Overview" />
            <Anchor href="#submit-round" label="My rounds" />
            <Anchor href="#standings" label="Standings" />
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
                  <SheetTitle>Tournament rules</SheetTitle>
                  <SheetDescription>
                    Event scoring, proof, mulligan and tiebreaker requirements.
                  </SheetDescription>
                </SheetHeader>
                <div className="grid gap-2 px-4 pb-4">
                  <Rule label="Format" value={formatLabel(data.tournament.format)} />
                  <Rule label="Rounds" value={String(data.tournament.roundCount)} />
                  <Rule label="Mulligans" value="Not allowed in any tournament round" />
                  <Rule
                    label="Gimmes"
                    value="10 ft for 1-putt, 20 ft for 2-putt; outside that, hole out or use event scoring."
                  />
                  <Rule label="Cut" value={formatCutRule(data.tournament.cutRuleJson)} />
                  <Rule
                    label="Tiebreaker"
                    value={formatTiebreakerRule(data.tournament.playoffRuleJson)}
                  />
                </div>
              </SheetContent>
            </Sheet>
            <Anchor href="#chat" label="Chat" />
          </nav>

          <section
            id="overview"
            className="grid scroll-mt-28 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]"
          >
            <Card className="gap-0 py-0">
              <CardContent className="p-4">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Trophy className="size-4 text-[var(--status-warning-foreground)]" />
                  Podium
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {podium.length > 0 ? (
                    podium.map(({ standing, profile }) => (
                      <div
                        key={standing.id}
                        className={
                          standing.rank === 1
                            ? "rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] p-4"
                            : "rounded-lg border bg-muted/55 p-4"
                        }
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={standing.rank === 1 ? "default" : "outline"}>
                            #{standing.rank ?? "--"}
                          </Badge>
                          {isTourPlayerProfile(profile) ? (
                            <Badge variant="secondary">Tour</Badge>
                          ) : null}
                        </div>
                        <ProfileNameLink
                          profile={profile}
                          className="mt-3 block font-semibold tracking-normal hover:underline"
                        />
                        <p className="mt-1 text-2xl font-semibold tracking-normal">
                          {standing.grossTotal}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {standing.roundsCompleted} rounds
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground md:col-span-3">
                      No accepted submissions yet.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="gap-0 py-0">
              <CardContent className="p-4">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck className="size-4 text-primary" />
                  Proof model
                </p>
                <div className="mt-3 grid gap-2 text-sm">
                  <ProofRow label="Rapsodo direct" active={data.tournament.directRapsodoRequired} />
                  <ProofRow
                    label="Scorecard screenshot"
                    active={data.tournament.screenshotRequired}
                  />
                  <ProofRow label="Course/date/tee match" active />
                  <ProofRow label="Duplicate import check" active />
                  <ProofRow label="No mulligans" active />
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <section id="submit-round" className="scroll-mt-28">
              <Dialog>
                <DialogTrigger
                  type="button"
                  data-variant="default"
                  className={buttonVariants({ className: "w-full" })}
                >
                  <Send className="size-4" />
                  Submit tournament round
                </DialogTrigger>
                <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>Submit tournament round</DialogTitle>
                    <DialogDescription>
                      Choose a matching saved round or submit a scorecard with its proof.
                    </DialogDescription>
                  </DialogHeader>
                  {data.viewerEntered && viewerTermsCurrent ? (
                    <div className="grid gap-4">
                      <MatchingRoundSubmitList
                        rounds={data.matchingRounds}
                        tournamentId={data.tournament.id}
                        roundNumber={data.nextRoundNumber}
                        courseName={data.course?.name ?? null}
                      />
                      <div className="grid gap-3 border-t border-border pt-4">
                        <div>
                          <p className="text-sm font-semibold">Manual score</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            Keep this for scorecards that have not been imported yet.
                          </p>
                        </div>
                        <form
                          action={submitTournamentRoundAction}
                          className="grid gap-3"
                          data-tournament-submit-form
                        >
                          <input type="hidden" name="tournamentId" value={data.tournament.id} />
                          <label className="grid gap-1 text-sm font-medium">
                            Round
                            <Input
                              name="roundNumber"
                              type="number"
                              min={1}
                              max={data.tournament.roundCount}
                              defaultValue={data.nextRoundNumber ?? data.tournament.roundCount}
                              className="h-10 rounded-xl bg-background"
                            />
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="grid gap-1 text-sm font-medium">
                              Gross
                              <Input
                                name="grossScore"
                                inputMode="numeric"
                                className="h-10 rounded-xl bg-background"
                                required
                              />
                            </label>
                            <label className="grid gap-1 text-sm font-medium">
                              Net
                              <Input
                                name="netScore"
                                inputMode="numeric"
                                className="h-10 rounded-xl bg-background"
                              />
                            </label>
                          </div>
                          <label className="grid gap-1 text-sm font-medium">
                            Linked imported round
                            <Input
                              name="sessionId"
                              placeholder="Optional imported round reference"
                              className="h-10 rounded-xl bg-background"
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
                          <p className="rounded-lg bg-muted/55 p-3 text-xs leading-5 text-muted-foreground">
                            Manual scores remain pending until the server can match owned round
                            evidence. Only verified submissions enter standings.
                          </p>
                          <Button type="submit" className="rounded-lg">
                            <Send className="size-4" />
                            Submit manual score
                          </Button>
                        </form>
                      </div>
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                      {data.viewerEntered
                        ? "Accept the current no-mulligans terms before submitting."
                        : "Enter the tournament before submitting."}
                    </p>
                  )}
                </DialogContent>
              </Dialog>
            </section>

            <section className="grid gap-4">
              <Card
                id="standings"
                className="scroll-mt-28 gap-0 py-0"
                data-workbench-scope="tournament-standings"
              >
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Standings</p>
                      {hideTourPlayers && hiddenTourStandingCount > 0 ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {hiddenTourStandingCount} tour players hidden
                        </p>
                      ) : null}
                    </div>
                    {tourStandingCount > 0 ? (
                      <Button asChild variant="outline" size="sm" className="rounded-full">
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
                    tournamentId={data.tournament.id}
                  />
                </CardContent>
              </Card>

              <Card id="chat" className="scroll-mt-28 gap-0 py-0">
                <CardContent className="p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <MessageCircle className="size-4 text-[var(--status-information-foreground)]" />
                    Chat
                  </p>
                  <div className="mt-4 grid gap-2">
                    {data.comments.map(({ comment, profile }) => (
                      <div key={comment.id} className="rounded-lg bg-muted/55 px-3 py-2 text-sm">
                        <ProfileNameLink
                          profile={profile}
                          className="font-medium hover:underline"
                        />
                        <p className="text-muted-foreground">{comment.body}</p>
                      </div>
                    ))}
                  </div>
                  <form
                    action={addTournamentCommentAction}
                    className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"
                  >
                    <input type="hidden" name="tournamentId" value={data.tournament.id} />
                    <Input
                      name="body"
                      placeholder="Add a comment"
                      className="h-10 rounded-xl bg-background"
                    />
                    <Button type="submit" variant="outline">
                      <MessageCircle className="size-4" />
                      Comment
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </section>
          </section>
        </DesktopWorkbenchLayout>
      ) : null}
    </PageShell>
  );
}

type TournamentStandingRow = TournamentDetailData["standings"][number];

function MobileTournamentStandings({
  visibleStandings,
  roundCount,
  viewerUserId,
}: {
  visibleStandings: TournamentStandingRow[];
  roundCount: number;
  viewerUserId: string;
}) {
  return (
    <IOSDisclosureGroup
      label="Complete tournament standings"
      items={[
        {
          value: "complete-standings",
          title: "Complete standings",
          summary: `${visibleStandings.length} ${visibleStandings.length === 1 ? "player" : "players"}`,
          description: "Gross, net, rounds and proof state",
          contentClassName: "px-0 pb-0 pt-0",
          content: (
            <IOSGroupedList label="All visible tournament standings" className="border-0">
              {visibleStandings.length > 0 ? (
                visibleStandings.map(({ standing, profile }) => {
                  const isViewer = standing.userId === viewerUserId;
                  const isTourPlayer = isTourPlayerProfile(profile);

                  return (
                    <IOSListRow
                      key={standing.id}
                      label={`#${standing.rank ?? "--"} · ${profile?.displayName ?? "Player"}`}
                      value={standing.grossTotal}
                      detail={`${standing.roundsCompleted}/${roundCount} rounds · Net ${standing.netTotal ?? "--"} · ${standing.status.replaceAll("_", " ")}`}
                      href={profileHref(profile)}
                      status={
                        isViewer ? (
                          <IOSInlineStatus label="You" tone="positive" />
                        ) : isTourPlayer ? (
                          <IOSInlineStatus label="Tour player" tone="info" />
                        ) : undefined
                      }
                    />
                  );
                })
              ) : (
                <IOSListRow
                  label="No standings yet"
                  detail="Accepted round submissions will appear here."
                />
              )}
            </IOSGroupedList>
          ),
        },
      ]}
    />
  );
}

async function TournamentStandingsTable({
  rows,
  roundCount,
  tournamentId,
}: {
  rows: TournamentStandingRow[];
  roundCount: number;
  tournamentId: string;
}) {
  const { DesktopTableWorkbenchControls } = await import("@/components/app/desktop-workbench");

  return (
    <div className="mt-4 grid gap-3">
      <DesktopTableWorkbenchControls
        viewKey={`tournament-standings-${tournamentId}`}
        scope="tournament-standings"
        currentViewLabel="Tournament standings"
        resultLabel={`${rows.length} players`}
        columns={tournamentStandingsColumns}
        suggestedViews={tournamentStandingsSuggestedViews}
        exportTableId="tournament-standings"
        exportFileName="forekinghell-tournament-standings.csv"
      />
      <DataTableFrame mainTable mainTableLabel="Tournament standings table" stickyFirstColumn>
        <Table
          data-workbench-export-table="tournament-standings"
          aria-describedby="tournament-standings-summary"
        >
          <TableCaption id="tournament-standings-summary" className="sr-only">
            Tournament standings table showing rank, player, gross total, net total, stableford
            total, rounds completed, status, last updated and profile action.
          </TableCaption>
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-muted">
            <TableRow>
              <TableHead
                data-column="rank"
                className="sticky left-0 z-20 bg-muted shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
              >
                Rank
              </TableHead>
              <TableHead data-column="player">Player</TableHead>
              <TableHead data-column="gross">Gross</TableHead>
              <TableHead data-column="net">Net</TableHead>
              <TableHead data-column="stableford">Stableford</TableHead>
              <TableHead data-column="rounds">Rounds</TableHead>
              <TableHead data-column="status">Status</TableHead>
              <TableHead data-column="updated">Updated</TableHead>
              <TableHead data-column="action" className="text-right">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map(({ standing, profile }) => (
                <TableRow key={standing.id} tabIndex={0} className="focus-aaa outline-none">
                  <TableCell
                    data-column="rank"
                    className="sticky left-0 z-10 bg-card font-medium shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
                  >
                    #{standing.rank ?? "--"}
                  </TableCell>
                  <TableCell data-column="player">
                    <div className="flex min-w-56 items-center gap-2">
                      <ProfileNameLink
                        profile={profile}
                        className="font-medium text-primary hover:underline"
                      />
                      {isTourPlayerProfile(profile) ? (
                        <Badge variant="secondary" className="shrink-0">
                          Tour
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell data-column="gross" className="font-semibold">
                    {standing.grossTotal}
                  </TableCell>
                  <TableCell data-column="net">{standing.netTotal ?? "--"}</TableCell>
                  <TableCell data-column="stableford">{standing.stablefordTotal ?? "--"}</TableCell>
                  <TableCell data-column="rounds">
                    {standing.roundsCompleted}/{roundCount}
                  </TableCell>
                  <TableCell data-column="status">{standing.status.replace(/_/g, " ")}</TableCell>
                  <TableCell data-column="updated">
                    {dateFormatter.format(standing.calculatedAt)}
                  </TableCell>
                  <TableCell data-column="action" className="text-right">
                    {profileHref(profile) ? (
                      <Button asChild variant="outline" size="sm">
                        <Link href={profileHref(profile) ?? "#"} prefetch={false}>
                          Open profile
                        </Link>
                      </Button>
                    ) : (
                      <span className="text-sm text-muted-foreground">No profile</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                  No standings yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DataTableFrame>
    </div>
  );
}

function isTourPlayerProfile(profile: TournamentDetailData["standings"][number]["profile"]) {
  return (
    profile?.visibilitySettingsJson?.profileKind === "tour-player" ||
    profile?.visibilitySettingsJson?.tourPlayer === true
  );
}

function profileHref(profile: ProfileIdentity) {
  return profile?.username ? `/profile/${profile.username}` : undefined;
}

function ProfileNameLink({
  profile,
  className,
  fallback = "Player",
}: {
  profile: ProfileIdentity;
  className?: string;
  fallback?: string;
}) {
  const label = profile?.displayName ?? fallback;
  const href = profileHref(profile);

  if (!href) {
    return <span className={className}>{label}</span>;
  }

  return (
    <Link href={href} prefetch={false} className={className}>
      {label}
    </Link>
  );
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

function ProofRow({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-card px-3 py-2 ring-1 ring-border">
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
          Upload/import a round as usual. If the course matches this event, it appears here
          automatically.
        </p>
      </div>
      {rounds.length > 0 ? (
        <div className="grid gap-2">
          {rounds.map((round) => {
            const canSubmit =
              roundNumber !== null && round.grossScore !== null && !round.alreadySubmitted;
            const buttonLabel = round.alreadySubmitted
              ? "Already submitted"
              : roundNumber === null
                ? "All rounds submitted"
                : `Submit as round ${roundNumber}`;

            return (
              <div key={round.id} className="rounded-xl border border-border bg-card p-3">
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
                  {round.netScore !== null ? (
                    <Badge variant="outline">Net {round.netScore}</Badge>
                  ) : null}
                  {round.alreadySubmitted ? <Badge variant="outline">Submitted</Badge> : null}
                </div>
                <form
                  action={submitTournamentRoundAction}
                  className={compact ? "mt-3" : "mt-4"}
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
                  <Button type="submit" disabled={!canSubmit} className="w-full rounded-lg">
                    <Send className="size-4" />
                    {buttonLabel}
                  </Button>
                </form>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed bg-muted/35 p-3 text-sm leading-5 text-muted-foreground">
          No saved scored rounds for {courseLabel} yet. Once you upload or import a matching round,
          it will be ready to submit here.
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

  const afterRound = typeof data.afterRound === "number" ? ` after round ${data.afterRound}` : "";
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
    const order = Array.isArray(data.order) ? data.order.map(formatRuleToken) : [];

    return order.length > 0 ? `Countback: ${listText(order)}.` : "Countback if scores are tied.";
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
    <div className="rounded-lg bg-muted/55 px-3 py-2 text-sm">
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
