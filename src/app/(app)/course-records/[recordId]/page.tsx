import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Medal, Send, ShieldCheck, Trophy } from "lucide-react";

import { submitCourseRecordAttemptAction } from "@/app/course-records/actions";
import {
  DesktopWorkbenchLayout,
  DesktopTableWorkbenchControls,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { DataTableFrame, PageShell, StatusPill } from "@/components/premium";
import { ScorecardProofUploader } from "@/components/scorecard-proof-uploader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCourseRecordDetailData, verificationTierLabel } from "@/lib/course-records";
import { RecordSubmitButton } from "@/app/course-records/[recordId]/record-submit-button";

export const dynamic = "force-dynamic";

type CourseRecordDetailProps = {
  params: Promise<{ recordId: string }>;
  searchParams?: Promise<{ attempt?: string; sessionId?: string }>;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });
type RecordProfile = { username: string; displayName: string } | null | undefined;

const recordDetailLeaderboardColumns: DesktopWorkbenchColumn[] = [
  { id: "rank", label: "Rank", locked: true },
  { id: "player", label: "Player" },
  { id: "score", label: "Score" },
  { id: "proof", label: "Proof" },
  { id: "status", label: "Status" },
  { id: "date", label: "Date" },
  { id: "action", label: "Action", locked: true },
];

const recordDetailSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Verified board",
    href: "#verified-board-table",
    detail: "Ranked accepted entries for this record.",
  },
  {
    title: "Submit attempt",
    href: "#submit-record",
    detail: "Upload scorecard proof against a saved round.",
  },
  {
    title: "Recent attempts",
    href: "#recent-attempts",
    detail: "Review pending, mismatch and manual-only submissions.",
  },
];

export default async function CourseRecordDetailPage({
  params,
  searchParams,
}: CourseRecordDetailProps) {
  const [{ recordId }, query] = await Promise.all([params, searchParams]);
  const data = await getCourseRecordDetailData(recordId);

  if (!data) {
    notFound();
  }

  const leader = data.results.find((row) => row.result.rank === 1) ?? null;
  const selectedRound =
    data.recentSessions.find((session) => session.id === query?.sessionId) ??
    data.recentSessions[0] ??
    null;
  return (
    <PageShell>
      <DesktopWorkbenchLayout scope="course-record-detail">
        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="ghost" className="px-0">
            <Link href={`/courses/${data.course.id}/records`} prefetch={false}>
              <ArrowLeft className="size-4" />
              {data.course.name}
            </Link>
          </Button>
          <Badge variant="outline">{data.teeSet?.name ?? "Any tee"}</Badge>
        </div>

        <header className="premium-hero p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <StatusPill tone="amber">Honours board</StatusPill>
              <h1 className="mt-3 text-3xl font-semibold tracking-normal text-balance">
                {data.category.name}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {data.course.name} · {data.record.period === "month" ? "This month" : "All-time"} ·{" "}
                {data.record.scope}
              </p>
            </div>
            <Button asChild>
              <a href="#submit-record">
                <Send className="size-4" />
                Submit attempt
              </a>
            </Button>
          </div>
          {query?.attempt ? <AttemptSubmittedNotice className="mt-4" /> : null}
        </header>

        <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
          <Card className="gap-0 py-0">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Medal className="size-4 text-[var(--status-warning-foreground)]" />
                    Current champion
                  </p>
                  {leader?.profile ? (
                    <>
                      <ProfileNameLink
                        profile={leader.profile}
                        className="mt-3 block text-3xl font-semibold tracking-normal hover:underline"
                      />
                      <p className="mt-1 text-4xl font-semibold tracking-normal">
                        {leader.result.scoreLabel}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {verificationTierLabel(leader.result.verificationTier)} ·{" "}
                        {dateFormatter.format(leader.result.calculatedAt)}
                      </p>
                    </>
                  ) : (
                    <p className="mt-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                      No champion yet. A verified submission takes the board.
                    </p>
                  )}
                </div>
                <Badge
                  variant={
                    leader?.result.verificationStatus === "verified" ? "secondary" : "outline"
                  }
                >
                  {leader ? leader.result.verificationStatus.replace(/_/g, " ") : "open"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="p-4 pb-0">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="size-4 text-primary" />
                Your best
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {data.viewerResult ? (
                <div className="mt-3 rounded-lg bg-muted/45 p-4">
                  <Badge variant="secondary">Rank #{data.viewerResult.result.rank}</Badge>
                  <p className="mt-3 text-2xl font-semibold tracking-normal">
                    {data.viewerResult.result.scoreLabel}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {verificationTierLabel(data.viewerResult.result.verificationTier)}
                  </p>
                </div>
              ) : (
                <p className="mt-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  Submit a verified Rapsodo round and scorecard screenshot to appear here.
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card id="submit-record" className="gap-0 py-0">
            <CardHeader className="p-4 pb-0">
              <CardTitle className="text-sm font-semibold">Submit attempt</CardTitle>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                The score is derived from a saved round. You cannot type a champion score here;
                screenshot OCR must match the round total before it reaches the verified board.
              </p>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {selectedRound ? (
                <form
                  action={submitCourseRecordAttemptAction}
                  className="mt-4 grid gap-3"
                  data-course-record-attempt-form
                >
                  <input type="hidden" name="recordId" value={data.record.id} />
                  <label className="grid gap-1 text-sm font-medium">
                    Saved round
                    <Select name="sessionId" defaultValue={selectedRound.id} required>
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {data.recentSessions.map((session) => (
                          <SelectItem key={session.id} value={session.id}>
                            {session.metricLabel} · {dateFormatter.format(session.date)} ·{" "}
                            {session.proofLabel}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <div className="rounded-lg border border-border bg-muted/45 p-3 text-sm">
                    <p className="font-semibold">Locked from selected round</p>
                    <p className="mt-1 text-2xl font-semibold tracking-normal">
                      {selectedRound.metricLabel}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {selectedRound.holeCount} holes · {selectedRound.teeSetName ?? "Any tee"} ·{" "}
                      {selectedRound.proofLabel}
                    </p>
                  </div>
                  <ScorecardProofUploader
                    proofScopeType="course_record"
                    proofScopeId={data.record.id}
                    screenshotFieldName="screenshotPath"
                    extractedTotalFieldName="extractedScorecardTotal"
                  />
                  <RecordSubmitButton />
                </form>
              ) : (
                <p className="mt-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  No saved rounds for this record yet. Import or log a round for this course first.
                </p>
              )}
            </CardContent>
          </Card>

          <section className="grid gap-4">
            <Card id="verified-board-table" className="gap-0 py-0">
              <CardHeader className="p-4 pb-0">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Trophy className="size-4 text-[var(--status-warning-foreground)]" />
                  Verified board
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <CourseRecordLeaderboardTable recordId={data.record.id} rows={data.results} />
              </CardContent>
            </Card>

            <Card className="gap-0 py-0">
              <Collapsible id="recent-attempts">
                <CollapsibleTrigger className="w-full cursor-pointer px-4 py-3 text-left text-sm font-semibold">
                  Recent attempts
                </CollapsibleTrigger>
                <CollapsibleContent className="grid gap-2 border-t p-4">
                  {data.attempts.map(({ attempt, profile }) => (
                    <div key={attempt.id} className="rounded-lg bg-muted/45 px-3 py-2 text-sm">
                      <p className="font-medium">
                        <ProfileNameLink profile={profile} className="hover:underline" /> ·{" "}
                        {attempt.metricValue}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {attempt.verificationStatus.replace(/_/g, " ")} ·{" "}
                        {dateFormatter.format(attempt.submittedAt)}
                      </p>
                    </div>
                  ))}
                  {data.attempts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No attempts yet.</p>
                  ) : null}
                </CollapsibleContent>
              </Collapsible>
            </Card>
          </section>
        </section>
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

type CourseRecordLeaderboardRow = NonNullable<
  Awaited<ReturnType<typeof getCourseRecordDetailData>>
>["results"][number];

function CourseRecordLeaderboardTable({
  recordId,
  rows,
}: {
  recordId: string;
  rows: CourseRecordLeaderboardRow[];
}) {
  return (
    <div className="mt-4 grid gap-3">
      <DesktopTableWorkbenchControls
        viewKey={`course-record-detail-${recordId}`}
        scope="course-record-detail"
        currentViewLabel="Verified record board"
        resultLabel={`${rows.length} accepted entries`}
        columns={recordDetailLeaderboardColumns}
        suggestedViews={recordDetailSuggestedViews}
        exportTableId="course-record-leaderboard"
        exportFileName="forekinghell-course-record-leaderboard.csv"
      />
      <DataTableFrame mainTable mainTableLabel="Course record leaderboard table" stickyFirstColumn>
        <Table
          data-workbench-scope="course-record-detail"
          data-workbench-export-table="course-record-leaderboard"
          aria-describedby="course-record-leaderboard-summary"
        >
          <TableCaption id="course-record-leaderboard-summary" className="sr-only">
            Course record leaderboard table showing rank, player, score, proof tier, verification
            status, calculation date and profile action.
          </TableCaption>
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card">
            <TableRow>
              <TableHead
                data-column="rank"
                className="sticky left-0 z-20 bg-card shadow-[1px_0_0_hsl(var(--border))]"
              >
                Rank
              </TableHead>
              <TableHead data-column="player">Player</TableHead>
              <TableHead data-column="score">Score</TableHead>
              <TableHead data-column="proof">Proof</TableHead>
              <TableHead data-column="status">Status</TableHead>
              <TableHead data-column="date">Date</TableHead>
              <TableHead data-column="action" className="text-right">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map(({ result, profile }) => (
                <TableRow key={result.id} tabIndex={0} className="focus-aaa outline-none">
                  <TableCell
                    data-column="rank"
                    className="sticky left-0 z-10 bg-card font-medium shadow-[1px_0_0_hsl(var(--border))]"
                  >
                    #{result.rank ?? "--"}
                  </TableCell>
                  <TableCell data-column="player">
                    <ProfileNameLink
                      profile={profile}
                      className="font-medium text-primary hover:underline"
                    />
                  </TableCell>
                  <TableCell data-column="score" className="font-semibold">
                    {result.scoreLabel}
                  </TableCell>
                  <TableCell data-column="proof">
                    <Badge
                      variant={result.verificationStatus === "verified" ? "secondary" : "outline"}
                    >
                      {verificationTierLabel(result.verificationTier)}
                    </Badge>
                  </TableCell>
                  <TableCell data-column="status">
                    {result.verificationStatus.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell data-column="date">
                    {dateFormatter.format(result.calculatedAt)}
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
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  No accepted entries yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DataTableFrame>
    </div>
  );
}

function AttemptSubmittedNotice({ className = "" }: { className?: string }) {
  return (
    <div
      role="status"
      className={`rounded-lg border border-[var(--status-success-border)] bg-[var(--status-success-surface)] px-4 py-3 text-sm text-[var(--status-success-foreground)] ${className}`}
    >
      <p className="font-semibold">Attempt submitted</p>
      <p className="mt-1 text-xs text-[var(--status-success-foreground)]/85">
        Your score was received and the board status has refreshed.
      </p>
    </div>
  );
}

function profileHref(profile: RecordProfile) {
  return profile?.username ? `/profile/${profile.username}` : undefined;
}

function ProfileNameLink({
  profile,
  className,
  fallback = "Player",
}: {
  profile: RecordProfile;
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
