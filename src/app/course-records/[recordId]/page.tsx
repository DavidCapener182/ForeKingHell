import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Medal, Send, ShieldCheck, Trophy } from "lucide-react";

import { submitCourseRecordAttemptAction } from "@/app/course-records/actions";
import { PageShell, StatusPill } from "@/components/premium";
import { ScorecardProofUploader } from "@/components/scorecard-proof-uploader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCourseRecordDetailData, verificationTierLabel } from "@/lib/course-records";

export const dynamic = "force-dynamic";

type CourseRecordDetailProps = {
  params: Promise<{ recordId: string }>;
  searchParams?: Promise<{ attempt?: string; sessionId?: string }>;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });

export default async function CourseRecordDetailPage({ params, searchParams }: CourseRecordDetailProps) {
  const [{ recordId }, query] = await Promise.all([params, searchParams]);
  const data = await getCourseRecordDetailData(recordId);

  if (!data) {
    notFound();
  }

  const leader = data.results.find((row) => row.result.rank === 1) ?? null;
  const selectedRound = data.recentSessions.find((session) => session.id === query?.sessionId) ?? data.recentSessions[0] ?? null;

  return (
    <PageShell size="6xl">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" className="px-0">
          <Link href={`/courses/${data.course.id}/records`} prefetch={false}>
            <ArrowLeft className="size-4" />
            {data.course.name}
          </Link>
        </Button>
        <Badge variant="outline">{data.teeSet?.name ?? "Any tee"}</Badge>
      </div>

      <header className="rounded-xl border bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <StatusPill tone="amber">Honours board</StatusPill>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal text-balance">{data.category.name}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {data.course.name} · {data.record.period === "month" ? "This month" : "All-time"} · {data.record.scope}
            </p>
          </div>
          <Button asChild className="rounded-xl bg-[#111827] text-white">
            <a href="#submit-record">
              <Send className="size-4" />
              Submit attempt
            </a>
          </Button>
        </div>
        {query?.attempt ? (
          <Badge variant="secondary" className="mt-4">Attempt submitted</Badge>
        ) : null}
      </header>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <article className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Medal className="size-4 text-amber-600" />
                Current champion
              </p>
              {leader?.profile ? (
                <>
                  <p className="mt-3 text-3xl font-semibold tracking-normal">{leader.profile.displayName}</p>
                  <p className="mt-1 text-4xl font-semibold tracking-normal">{leader.result.scoreLabel}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {verificationTierLabel(leader.result.verificationTier)} · {dateFormatter.format(leader.result.calculatedAt)}
                  </p>
                </>
              ) : (
                <p className="mt-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  No champion yet. A verified submission takes the board.
                </p>
              )}
            </div>
            <Badge variant={leader?.result.verificationStatus === "verified" ? "secondary" : "outline"}>
              {leader ? leader.result.verificationStatus.replace(/_/g, " ") : "open"}
            </Badge>
          </div>
        </article>

        <article className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="size-4 text-emerald-600" />
            Your best
          </p>
          {data.viewerResult ? (
            <div className="mt-3 rounded-xl bg-slate-50 p-4">
              <Badge variant="secondary">Rank #{data.viewerResult.result.rank}</Badge>
              <p className="mt-3 text-2xl font-semibold tracking-normal">{data.viewerResult.result.scoreLabel}</p>
              <p className="mt-1 text-sm text-muted-foreground">{verificationTierLabel(data.viewerResult.result.verificationTier)}</p>
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              Submit a verified Rapsodo round and scorecard screenshot to appear here.
            </p>
          )}
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <article id="submit-record" className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold">Submit attempt</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            The score is derived from a saved round. You cannot type a champion score here; screenshot OCR must match the round total before it reaches the verified board.
          </p>
          {selectedRound ? (
            <form action={submitCourseRecordAttemptAction} className="mt-4 grid gap-3" data-course-record-attempt-form>
              <input type="hidden" name="recordId" value={data.record.id} />
              <label className="grid gap-1 text-sm font-medium">
                Saved round
                <select
                  name="sessionId"
                  defaultValue={selectedRound.id}
                  className="h-10 rounded-xl border bg-white px-3 text-sm"
                  required
                >
                  {data.recentSessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.metricLabel} · {dateFormatter.format(session.date)} · {session.proofLabel}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-xl border bg-slate-50 p-3 text-sm">
                <p className="font-semibold">Locked from selected round</p>
                <p className="mt-1 text-2xl font-semibold tracking-normal">{selectedRound.metricLabel}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedRound.holeCount} holes · {selectedRound.teeSetName ?? "Any tee"} · {selectedRound.proofLabel}
                </p>
              </div>
              <ScorecardProofUploader
                screenshotFieldName="screenshotPath"
                extractedTotalFieldName="extractedScorecardTotal"
              />
              <Button type="submit" className="rounded-xl bg-[#111827] text-white">
                <Send className="size-4" />
                Submit evidence
              </Button>
            </form>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              No saved rounds for this record yet. Import or log a round for this course first.
            </p>
          )}
        </article>

        <main className="grid gap-4">
          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Trophy className="size-4 text-amber-600" />
              Verified board
            </p>
            <div className="mt-4 grid gap-2">
              {data.results.slice(0, 8).map(({ result, profile }) => (
                <div key={result.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                  <Badge variant={result.rank === 1 ? "default" : "outline"}>#{result.rank ?? "--"}</Badge>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{profile?.displayName ?? "Player"}</p>
                    <p className="text-xs text-muted-foreground">{verificationTierLabel(result.verificationTier)}</p>
                  </div>
                  <p className="font-semibold">{result.scoreLabel}</p>
                </div>
              ))}
              {data.results.length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No accepted entries yet.</p>
              ) : null}
            </div>
          </section>

          <details className="rounded-xl border bg-white shadow-sm">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
              Recent attempts
            </summary>
            <div className="grid gap-2 border-t p-4">
              {data.attempts.map(({ attempt, profile }) => (
                <div key={attempt.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                  <p className="font-medium">{profile?.displayName ?? "Player"} · {attempt.metricValue}</p>
                  <p className="text-xs text-muted-foreground">
                    {attempt.verificationStatus.replace(/_/g, " ")} · {dateFormatter.format(attempt.submittedAt)}
                  </p>
                </div>
              ))}
              {data.attempts.length === 0 ? <p className="text-sm text-muted-foreground">No attempts yet.</p> : null}
            </div>
          </details>
        </main>
      </section>
    </PageShell>
  );
}
