import Link from "next/link";
import { notFound } from "next/navigation";
import { ChallengeInviteReview } from "@/app/challenges/challenge-invite-review";
import { ChallengeJoinDialog } from "@/app/challenges/challenge-join-dialog";
import { ChallengeLeaveDialog } from "@/app/challenges/challenge-leave-dialog";
import { ChallengeDetailSections } from "@/app/challenges/challenge-detail-sections";
import { ChallengeCommentComposer } from "@/app/challenges/challenge-comment-composer";
import { DataTableFrame, PageHeader, PageShell, StatusPill } from "@/components/premium";
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
import type {
  DesktopWorkbenchColumn,
  DesktopSavedViewSuggestion,
} from "@/components/app/desktop-workbench";
import { getChallengeDetailData } from "@/lib/challenges";
import boardStyles from "@/app/course-records/course-record-board.module.css";
export const dynamic = "force-dynamic";
type ChallengeDetail = NonNullable<Awaited<ReturnType<typeof getChallengeDetailData>>>;
type ChallengeResultRow = ChallengeDetail["results"][number];
const challengeDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});
const challengeLeaderboardColumns: DesktopWorkbenchColumn[] = [
  { id: "rank", label: "Rank", locked: true },
  { id: "player", label: "Player" },
  { id: "score", label: "Score" },
  { id: "verification", label: "Verification" },
  { id: "calculated", label: "Calculated" },
  { id: "action", label: "Action", locked: true },
];
function challengeLeaderboardSuggestedViews(id: string): DesktopSavedViewSuggestion[] {
  return [
    { title: "Board", href: `/challenges/${id}?tab=board`, detail: "Qualifying standings" },
    {
      title: "Attempts",
      href: `/challenges/${id}?tab=attempts`,
      detail: "Imported result provenance",
    },
  ];
}
export default async function ChallengePage({
  params,
  searchParams,
}: {
  params: Promise<{ challengeId: string }>;
  searchParams?: Promise<{ tab?: string; invite?: string }>;
}) {
  const [{ challengeId }, query] = await Promise.all([params, searchParams]);
  const data = await getChallengeDetailData(challengeId);
  if (!data) notFound();
  const c = data.challenge;
  const viewer = data.results.find((row) => row.result.userId === data.viewerUserId);
  const closed = c.status !== "open" || Boolean(c.endsAt && c.endsAt <= new Date());
  const active =
    query?.tab === "shots"
      ? "attempts"
      : ["board", "command", "rules", "attempts", "chat"].includes(query?.tab ?? "")
        ? query!.tab!
        : "board";
  const personal = (
    <section className="grid gap-3 rounded-xl border bg-card p-4">
      <h2 className="text-lg font-semibold">Your imported result</h2>
      <p className="text-2xl font-semibold">
        {viewer?.result.scoreLabel ?? "No qualifying result"}
      </p>
      <p>
        {viewer
          ? `Rank #${viewer.result.rank} · ${viewer.verificationLabel}`
          : "Joining alone does not create a scored result."}
      </p>
      <p>
        {c.viewerEvidenceCount} / {c.evidenceTargetCount} qualifying shots · {c.evidenceRequirement}
      </p>
      <p className="text-sm">
        Window: {challengeDateTimeFormatter.format(c.startsAt)} —{" "}
        {c.endsAt ? challengeDateTimeFormatter.format(c.endsAt) : "Open ended"} (UTC)
      </p>
      <div className="flex flex-wrap gap-2">
        {!c.viewerJoined ? (
          <ChallengeJoinDialog challengeId={c.id} challengeTitle={c.title} disabled={closed} />
        ) : null}
        {c.viewerJoined && c.creatorUserId !== data.viewerUserId ? (
          <ChallengeLeaveDialog challengeId={c.id} challengeTitle={c.title} />
        ) : null}
        {!closed ? (
          <Button asChild className="min-h-11">
            <Link href={`/import?challengeId=${c.id}`}>Import qualifying evidence</Link>
          </Button>
        ) : (
          <p className="text-sm">
            This challenge is {c.status === "open" ? "ended" : c.status}; joining is closed.
          </p>
        )}
      </div>
    </section>
  );
  const board = (
    <section className="grid gap-4">
      <h2 className="text-lg font-semibold">
        Standings · {closed ? "recorded results" : "provisional"}
      </h2>
      <p className="text-sm">
        {c.scoringDirection === "asc" ? "Lower" : "Higher"} qualifying result wins. Positions and
        ties use the existing scoring rules. Results are recalculated from eligible evidence when
        viewed.
      </p>
      <div className={boardStyles.desktop}>
        <ChallengeLeaderboardTable data={data} verificationMode="Qualifying imported results" />
      </div>
      <div className={boardStyles.mobile}>
        {data.results.length ? (
          data.results.map(({ result, profile, verificationLabel }) => (
            <article
              key={result.id}
              className={`mb-3 grid gap-2 rounded-xl border p-3 ${result.userId === data.viewerUserId ? "border-primary bg-primary/5" : ""}`}
            >
              <p className="break-words font-semibold">
                #{result.rank} · {profile.displayName}
                {result.userId === data.viewerUserId ? " · You" : ""}
              </p>
              <p className="text-xl font-semibold">{result.scoreLabel}</p>
              <details>
                <summary className="min-h-11 cursor-pointer content-center">
                  Result, proof and date
                </summary>
                <p>{verificationLabel}</p>
                <p>Calculated {challengeDateTimeFormatter.format(result.calculatedAt)} UTC</p>
                <Button asChild variant="outline" className="mt-2 min-h-11">
                  <Link href={`/profile/${profile.username}`}>Open profile</Link>
                </Button>
              </details>
            </article>
          ))
        ) : (
          <p>No qualifying imported results yet.</p>
        )}
      </div>
    </section>
  );
  const attempts = (
    <section className="grid gap-3">
      <h2 className="text-lg font-semibold">Qualifying attempt ledger</h2>
      <p className="text-sm">
        These are calculated qualifying results, not a complete history of rejected imports.
        Excluded, modelled, out-of-window and nonmatching shots do not rank. Open Rules for the
        exact eligibility criteria.
      </p>
      {data.attempts.length ? (
        data.attempts
          .slice()
          .sort((a, b) => a.attempt.attemptedAt.getTime() - b.attempt.attemptedAt.getTime())
          .map(({ attempt, profile }) => (
            <details key={attempt.id} className="rounded-xl border bg-card p-4">
              <summary className="min-h-11 cursor-pointer content-center break-words font-semibold">
                {profile.displayName} · {attemptScoreLabel(attempt)}
              </summary>
              <dl className="mt-3 grid gap-2 text-sm">
                <Fact label="Metric" value={attempt.metricLabel} />
                <Fact label="Source" value={attempt.sourceType.replaceAll("_", " ")} />
                <Fact
                  label="Attempted (UTC)"
                  value={challengeDateTimeFormatter.format(attempt.attemptedAt)}
                />
                <Fact label="Verification" value={attempt.verificationLabel} />
                <Fact
                  label="Qualifying evidence"
                  value={attemptMetadataLabel(attempt.metadataJson)}
                />
              </dl>
              <Button asChild variant="outline" className="mt-3 min-h-11">
                <Link href={`/profile/${profile.username}`}>Open player profile</Link>
              </Button>
              {attempt.userId === data.viewerUserId && attempt.sourceId ? (
                <Button asChild variant="outline" className="mt-3 min-h-11">
                  <Link href={`/sessions/${attempt.sourceId}`}>
                    Open latest qualifying source session
                  </Link>
                </Button>
              ) : null}
            </details>
          ))
      ) : (
        <p className="rounded-xl border p-4">
          No qualifying attempts yet. Review the rules and import eligible evidence.
        </p>
      )}
    </section>
  );
  return (
    <PageShell>
      <PageHeader
        title={c.title}
        description={`${c.templateName} · ${c.status} · ${c.visibility} · ${c.scoringDirection === "asc" ? "Lower" : "Higher"} result wins`}
        actions={
          <Button asChild variant="outline">
            <Link href="/challenges">Back to Challenges</Link>
          </Button>
        }
      />
      <p className="text-sm">{c.description ?? c.rulesSummary}</p>
      {personal}
      <ChallengeDetailSections
        active={active}
        items={[
          { id: "board", label: "Board", content: board },
          {
            id: "command",
            label: "Command board",
            content: (
              <section className="grid gap-4">
                <h2 className="text-lg font-semibold">Challenge command board</h2>
                <p>
                  {data.results.length} ranked players · {data.attempts.length} qualifying results ·{" "}
                  {c.participantCount} joined players
                </p>
                <p className="text-sm">
                  Your result above and the standings come from the same qualifying imports.
                </p>
                {c.creatorUserId === data.viewerUserId ? (
                  <ChallengeInviteReview
                    challengeId={c.id}
                    title={c.title}
                    visibility={c.visibility}
                    friends={data.friendOptions}
                    disabled={closed}
                  />
                ) : (
                  <p className="text-sm">Only the challenge creator can invite friends.</p>
                )}
                <p className="text-sm">{c.coachNote}</p>
              </section>
            ),
          },
          {
            id: "rules",
            label: "Rules",
            content: (
              <section className="grid gap-3 rounded-xl border bg-card p-4">
                <h2 className="text-lg font-semibold">Challenge rules</h2>
                <p>{c.rulesSummary}</p>
                <ol className="list-decimal space-y-3 pl-5">
                  {c.rulesBullets.map((rule, i) => (
                    <li key={i}>{rule}</li>
                  ))}
                </ol>
                <p>
                  Visibility: {c.visibility}. {c.scoringDirection === "asc" ? "Lower" : "Higher"}{" "}
                  qualifying result wins.
                </p>
              </section>
            ),
          },
          { id: "attempts", label: "Attempts", content: attempts },
          {
            id: "chat",
            label: `Chat (${data.comments.length})`,
            content: (
              <section className="grid gap-4">
                <h2 className="text-lg font-semibold">Challenge comments</h2>
                {data.comments.length ? (
                  data.comments.map((comment) => (
                    <article key={comment.id} className="rounded-xl border bg-card p-4">
                      <Link
                        className="font-semibold text-primary"
                        href={`/profile/${comment.profile.username}`}
                      >
                        {comment.profile.displayName}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {challengeDateTimeFormatter.format(comment.createdAt)} UTC
                      </p>
                      <p className="mt-2 whitespace-pre-wrap break-words">{comment.body}</p>
                    </article>
                  ))
                ) : (
                  <p>No comments yet.</p>
                )}
                <ChallengeCommentComposer challengeId={c.id} />
              </section>
            ),
          },
        ]}
      />
    </PageShell>
  );
}
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}

async function ChallengeLeaderboardTable({
  data,
  verificationMode,
}: {
  data: ChallengeDetail;
  verificationMode: string;
}) {
  const { DesktopTableWorkbenchControls } = await import("@/components/app/desktop-workbench");
  const suggestedViews = challengeLeaderboardSuggestedViews(data.challenge.id);

  return (
    <section className="grid gap-3" data-workbench-scope="challenge-leaderboard">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Full leaderboard</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Template scoring direction, best imported result per player and verification state.
          </p>
        </div>
        <StatusPill tone={data.results.length > 0 ? "green" : "slate"}>
          {verificationMode}
        </StatusPill>
      </div>

      <DesktopTableWorkbenchControls
        viewKey={`challenge-leaderboard-${data.challenge.id}`}
        scope="challenge-leaderboard"
        currentViewLabel={`${data.challenge.title} leaderboard`}
        resultLabel={`${data.results.length} ranked players`}
        columns={challengeLeaderboardColumns}
        suggestedViews={suggestedViews}
        exportTableId="challenge-leaderboard"
        exportFileName={`forekinghell-challenge-${data.challenge.id}-leaderboard.csv`}
      />

      <DataTableFrame mainTable mainTableLabel="Challenge leaderboard table" stickyFirstColumn>
        <Table
          data-workbench-export-table="challenge-leaderboard"
          aria-describedby="challenge-leaderboard-summary"
        >
          <TableCaption id="challenge-leaderboard-summary" className="sr-only">
            Challenge leaderboard table showing rank, player, score, verification, calculation time
            and action.
          </TableCaption>
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-muted">
            <TableRow>
              <TableHead
                data-column="rank"
                className="sticky left-0 z-20 min-w-24 bg-muted shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
              >
                Rank
              </TableHead>
              <TableHead data-column="player">Player</TableHead>
              <TableHead data-column="score" className="text-right">
                Score
              </TableHead>
              <TableHead data-column="verification">Verification</TableHead>
              <TableHead data-column="calculated">Calculated</TableHead>
              <TableHead data-column="action" className="text-right">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.results.length > 0 ? (
              data.results.map((row) => (
                <ChallengeLeaderboardRow
                  key={row.result.id}
                  row={row}
                  own={row.result.userId === data.viewerUserId}
                />
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  No qualifying imported shots yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DataTableFrame>
    </section>
  );
}

function ChallengeLeaderboardRow({ row, own }: { row: ChallengeResultRow; own: boolean }) {
  return (
    <TableRow
      tabIndex={0}
      className={own ? "focus-aaa bg-primary/5 outline-none" : "focus-aaa outline-none"}
    >
      <TableCell
        data-column="rank"
        className="sticky left-0 z-10 min-w-24 bg-card shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
      >
        <Badge variant={row.result.rank === 1 ? "default" : "outline"}>
          {row.result.rank ? `#${row.result.rank}` : "--"}
        </Badge>
      </TableCell>
      <TableCell data-column="player">
        <Link
          href={`/profile/${row.profile.username}`}
          prefetch={false}
          className="font-semibold text-primary hover:underline"
        >
          {row.profile.displayName}
          {own ? " · You" : ""}
        </Link>
        <p className="mt-1 text-xs text-muted-foreground">@{row.profile.username}</p>
      </TableCell>
      <TableCell data-column="score" className="text-right font-semibold">
        {row.result.scoreLabel}
      </TableCell>
      <TableCell data-column="verification">{row.verificationLabel}</TableCell>
      <TableCell data-column="calculated">
        {challengeDateTimeFormatter.format(row.result.calculatedAt)}
      </TableCell>
      <TableCell data-column="action" className="text-right">
        <Button asChild variant="outline" size="sm" className="min-h-11">
          <Link href={`/profile/${row.profile.username}`} prefetch={false}>
            Open profile
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}

function scoreDisplay(value: number) {
  return value.toFixed(1);
}

function attemptScoreLabel(attempt: { metricLabel: string; metricValue: number }) {
  switch (attempt.metricLabel) {
    case "Total distance":
      return `${scoreDisplay(attempt.metricValue)} yd`;
    case "Offline miss":
      return `${scoreDisplay(attempt.metricValue)} yd offline`;
    case "Average error":
    case "Distance to pin":
      return `${scoreDisplay(attempt.metricValue)} yd error`;
    case "Carry spread":
      return `${scoreDisplay(attempt.metricValue)} yd spread`;
    case "Practice days":
      return `${Math.round(attempt.metricValue)} days`;
    default:
      return scoreDisplay(attempt.metricValue);
  }
}

function attemptMetadataLabel(metadata: Record<string, unknown>) {
  const shotCount = typeof metadata.shotCount === "number" ? metadata.shotCount : null;
  const sessionCount = typeof metadata.sessionCount === "number" ? metadata.sessionCount : null;

  if (shotCount && sessionCount) {
    return `${shotCount} imported shots · ${sessionCount} session${sessionCount === 1 ? "" : "s"}`;
  }

  if (shotCount) {
    return `${shotCount} imported shots`;
  }

  return "Imported shots";
}
