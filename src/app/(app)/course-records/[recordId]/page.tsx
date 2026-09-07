import Link from "next/link";
import { notFound } from "next/navigation";

import { RecordAttemptForm } from "@/app/course-records/[recordId]/record-attempt-form";
import boardStyles from "@/app/course-records/course-record-board.module.css";
import {
  DesktopTableWorkbenchControls,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { DataTableFrame, PageHeader, PageShell } from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export const dynamic = "force-dynamic";

type CourseRecordDetailProps = {
  params: Promise<{ recordId: string }>;
  searchParams?: Promise<{ attempt?: string; sessionId?: string }>;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
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
  const savedAttempt = data.attempts.find(
    (row) => row.attempt.id === query?.attempt && row.attempt.userId === data.viewerUserId,
  )?.attempt;
  const period = [
    data.record.period.replaceAll("_", " "),
    data.record.periodStart ? `start ${dateFormatter.format(data.record.periodStart)}` : null,
    data.record.periodEnd ? `end ${dateFormatter.format(data.record.periodEnd)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <PageShell>
      <PageHeader
        title={data.category.name}
        description={`${data.course.name} · ${data.record.scope} · ${period}`}
        actions={
          <Button asChild variant="outline">
            <Link href={`/courses/${data.course.id}/records`}>Course boards</Link>
          </Button>
        }
      />
      <p className="text-sm text-muted-foreground">
        {data.category.description} · {data.teeSet?.name ?? "Any eligible tee"} · Required proof:{" "}
        {data.record.verificationRequired}
      </p>
      {savedAttempt ? (
        <div role="status" className="rounded-xl border bg-card p-4">
          <h2 className="font-semibold">
            Attempt saved · {savedAttempt.verificationStatus.replaceAll("_", " ")}
          </h2>
          <p className="mt-1 text-sm">
            {savedAttempt.metricValue} {savedAttempt.metricLabel} · Proof:{" "}
            {savedAttempt.proofStatus.replaceAll("_", " ")}.{" "}
            {savedAttempt.verificationStatus === "verified"
              ? "This attempt passed verification."
              : "This is not yet a verified record. Review the status below and supply any required evidence."}
          </p>
          <a
            className="mt-2 inline-flex min-h-11 items-center font-medium text-primary"
            href="#recent-attempts"
          >
            View attempt status
          </a>
        </div>
      ) : query?.attempt ? (
        <p role="status" className="rounded-xl border p-3 text-sm">
          That submitted attempt is not available in your recent results for this board. No new save
          is confirmed by this link.
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Rankings follow the current record rules. Bronze review can include a manually saved
        scorecard; it does not mean its image proof has been verified. Check each attempt’s proof
        status below.
      </p>
      <section className="grid gap-3 sm:grid-cols-2" aria-label="Verified record summary">
        <div className="rounded-xl border bg-card p-4">
          <h2 className="font-semibold">Ranked leader</h2>
          {leader?.profile ? (
            <>
              <ProfileNameLink
                profile={leader.profile}
                className="mt-2 block break-words font-semibold text-primary"
              />
              <p className="mt-2 text-2xl font-semibold">{leader.result.scoreLabel}</p>
              <p className="text-sm">
                {verificationTierLabel(leader.result.verificationTier)} ·{" "}
                {dateFormatter.format(leader.result.calculatedAt)}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm">No verified leader yet.</p>
          )}
        </div>
        <div className="rounded-xl border bg-card p-4">
          <h2 className="font-semibold">Your ranked best</h2>
          {data.viewerResult ? (
            <>
              <p className="mt-2 text-2xl font-semibold">{data.viewerResult.result.scoreLabel}</p>
              <p>
                Rank {data.viewerResult.result.rank ?? "not ranked"} ·{" "}
                {verificationTierLabel(data.viewerResult.result.verificationTier)}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm">No verified result for this category yet.</p>
          )}
        </div>
      </section>
      <section id="submit-record" className="grid gap-2 rounded-xl border bg-card p-4">
        <h2 className="text-lg font-semibold">Submit attempt</h2>
        <p className="text-sm text-muted-foreground">
          The saved round determines this category’s result. Review its score and evidence before
          submitting. Showing up to 20 recent saved sessions with a calculable result; the server
          checks eligibility.
        </p>
        {selectedRound ? (
          <RecordAttemptForm
            recordId={data.record.id}
            selectedSessionId={selectedRound.id}
            rounds={data.recentSessions.map((round) => ({
              id: round.id,
              metricLabel: round.metricLabel,
              dateLabel: dateFormatter.format(round.date),
              holeCount: round.holeCount,
              teeSetName: round.teeSetName,
              proofLabel: round.proofLabel,
            }))}
          />
        ) : (
          <div>
            <p className="text-sm">No saved round has a calculable result for this category yet.</p>
            <Button asChild variant="outline" className="mt-3 min-h-11">
              <Link
                href={`/rounds/new?courseId=${data.course.id}${data.teeSet ? `&teeSetId=${data.teeSet.id}` : ""}`}
              >
                Log a round for this course
              </Link>
            </Button>
          </div>
        )}
      </section>
      <section id="verified-board-table" className="grid gap-3">
        <h2 className="text-lg font-semibold">Ranked board</h2>
        <div className={boardStyles.desktop}>
          <CourseRecordLeaderboardTable recordId={data.record.id} rows={data.results} />
        </div>
        <div className={boardStyles.mobile}>
          {data.results.map(({ result, profile }) => (
            <article key={result.id} className="rounded-xl border bg-card p-4">
              <h3 className="font-semibold">
                #{result.rank ?? "not ranked"} ·{" "}
                <ProfileNameLink profile={profile} className="text-primary" />
              </h3>
              <p className="mt-2 text-xl font-semibold">{result.scoreLabel}</p>
              <details>
                <summary className="min-h-11 cursor-pointer content-center font-medium">
                  Proof, status and date
                </summary>
                <p>{verificationTierLabel(result.verificationTier)}</p>
                <p>{result.verificationStatus.replaceAll("_", " ")}</p>
                <p>{dateFormatter.format(result.calculatedAt)}</p>
                {profileHref(profile) ? (
                  <Link
                    className="inline-flex min-h-11 items-center text-primary"
                    href={profileHref(profile)!}
                  >
                    Open profile
                  </Link>
                ) : null}
              </details>
            </article>
          ))}
          {!data.results.length ? (
            <p className="rounded-xl border border-dashed p-4 text-sm">No accepted entries yet.</p>
          ) : null}
        </div>
      </section>
      <details id="recent-attempts" className="rounded-xl border bg-card p-4" open={!!savedAttempt}>
        <summary className="min-h-11 cursor-pointer content-center text-lg font-semibold">
          Recent attempts · {data.attempts.length}
        </summary>
        <p className="py-2 text-sm text-muted-foreground">
          Latest 20 attempts available to this board. Pending and rejected evidence is separate from
          the verified leaderboard.
        </p>
        <div className="grid gap-3">
          {data.attempts.map(({ attempt, profile }) => (
            <article
              id={`attempt-${attempt.id}`}
              key={attempt.id}
              className="rounded-xl border p-3"
            >
              <p className="font-semibold">
                <ProfileNameLink profile={profile} className="text-primary" /> ·{" "}
                {attempt.metricValue} {attempt.metricLabel}
              </p>
              <p className="text-sm">
                {attempt.verificationStatus.replaceAll("_", " ")} ·{" "}
                {dateFormatter.format(attempt.submittedAt)}
              </p>
              <p className="text-sm">
                Proof: {attempt.proofStatus.replaceAll("_", " ")} · Source:{" "}
                {attempt.sourceKind.replaceAll("_", " ")}
              </p>
              {attempt.userId === data.viewerUserId && attempt.sessionId ? (
                <Link
                  className="inline-flex min-h-11 items-center font-medium text-primary"
                  href={`/rounds/${attempt.sessionId}`}
                >
                  Review saved round
                </Link>
              ) : null}
            </article>
          ))}
          {!data.attempts.length ? <p>No attempts yet.</p> : null}
        </div>
      </details>
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
