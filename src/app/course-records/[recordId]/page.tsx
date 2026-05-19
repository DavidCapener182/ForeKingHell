import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Medal, Send, ShieldCheck, Trophy } from "lucide-react";

import { submitCourseRecordAttemptAction } from "@/app/course-records/actions";
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
import { PageShell, StatusPill } from "@/components/premium";
import { ScorecardProofUploader } from "@/components/scorecard-proof-uploader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCourseRecordDetailData, verificationTierLabel } from "@/lib/course-records";
import { RecordSubmitButton } from "./record-submit-button";

export const dynamic = "force-dynamic";

type CourseRecordDetailProps = {
  params: Promise<{ recordId: string }>;
  searchParams?: Promise<{ attempt?: string; sessionId?: string; tab?: string }>;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });
type RecordProfile = { username: string; displayName: string } | null | undefined;

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
  const activeTab = parseRecordDetailTab(query?.tab);

  return (
    <PageShell size="6xl">
      <MobileAppShell>
        <MobileTopBar
          title={data.category.name}
          leading={
            <Button asChild variant="ghost" size="icon" className="size-10 rounded-full">
              <Link
                href={`/courses/${data.course.id}/records`}
                prefetch={false}
                aria-label={data.course.name}
              >
                <ArrowLeft className="size-5" />
              </Link>
            </Button>
          }
          actions={<ProofBadge tier={leader?.result.verificationTier ?? "silver"} />}
        />
        <MobileStatusAction
          label={`${data.course.name} · ${data.teeSet?.name ?? "Any tee"}`}
          value={<ProfileNameLink profile={leader?.profile} fallback="Open board" />}
          detail={
            leader
              ? `${leader.result.scoreLabel} · ${verificationTierLabel(leader.result.verificationTier)}`
              : "No champion yet. A verified submission takes the board."
          }
          action={
            <BottomSheet
              label={
                <>
                  <Send className="size-4" /> Submit
                </>
              }
              title="Submit record attempt"
            >
              {selectedRound ? (
                <form
                  action={submitCourseRecordAttemptAction}
                  className="grid gap-3"
                  data-course-record-attempt-form
                >
                  <input type="hidden" name="recordId" value={data.record.id} />
                  <label className="grid gap-1 text-sm font-medium">
                    Saved round
                    <select
                      name="sessionId"
                      defaultValue={selectedRound.id}
                      className="h-11 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm"
                      required
                    >
                      {data.recentSessions.map((session) => (
                        <option key={session.id} value={session.id}>
                          {session.metricLabel} · {dateFormatter.format(session.date)} ·{" "}
                          {session.proofLabel}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="rounded-lg bg-[#F5F6F4] p-3 text-sm">
                    <p className="font-semibold">Locked from selected round</p>
                    <p className="mt-1 text-2xl font-semibold tracking-normal">
                      {selectedRound.metricLabel}
                    </p>
                    <p className="mt-1 text-xs text-[#6B7280]">
                      {selectedRound.holeCount} holes · {selectedRound.teeSetName ?? "Any tee"} ·{" "}
                      {selectedRound.proofLabel}
                    </p>
                  </div>
                  <ScorecardProofUploader
                    screenshotFieldName="screenshotPath"
                    extractedTotalFieldName="extractedScorecardTotal"
                  />
                  <RecordSubmitButton className="rounded-full bg-[#0B7A3B] text-white" />
                </form>
              ) : (
                <p className="rounded-lg border border-dashed border-[#E5E7EB] p-4 text-sm text-[#6B7280]">
                  No saved rounds for this record yet. Import or log a round for this course first.
                </p>
              )}
            </BottomSheet>
          }
        />
        {query?.attempt ? <AttemptSubmittedNotice /> : null}
        <section className="grid grid-cols-2 gap-3">
          <article className="rounded-lg border border-[#E5E7EB] bg-white p-3">
            <p className="text-sm font-semibold text-[#6B7280]">Champion</p>
            <p className="mt-2 text-2xl font-semibold tracking-normal">
              {leader?.result.scoreLabel ?? "--"}
            </p>
            <ProfileNameLink
              profile={leader?.profile}
              fallback="Open"
              className="mt-1 block truncate text-sm text-[#6B7280] hover:underline"
            />
          </article>
          <article className="rounded-lg border border-[#E5E7EB] bg-white p-3">
            <p className="text-sm font-semibold text-[#6B7280]">Your best</p>
            <p className="mt-2 text-2xl font-semibold tracking-normal">
              {data.viewerResult?.result.scoreLabel ?? "--"}
            </p>
            <p className="mt-1 truncate text-sm text-[#6B7280]">
              {data.viewerResult ? `Rank #${data.viewerResult.result.rank}` : "No attempt"}
            </p>
          </article>
        </section>
        <MobileTabBar
          activeKey={activeTab}
          tabs={[
            { key: "board", label: "Board", href: `/course-records/${data.record.id}` },
            {
              key: "attempts",
              label: "Attempts",
              href: `/course-records/${data.record.id}?tab=attempts`,
            },
            { key: "rules", label: "Rules", href: `/course-records/${data.record.id}?tab=rules` },
            { key: "chat", label: "Chat", href: `/course-records/${data.record.id}?tab=chat` },
          ]}
        />
        {activeTab === "attempts" ? (
          <NativeListSection title="Recent attempts">
            {data.attempts.map(({ attempt, profile }) => (
              <div key={attempt.id} className="rounded-lg border border-[#E5E7EB] p-3 text-sm">
                <p className="font-semibold">
                  <ProfileNameLink profile={profile} className="hover:underline" /> ·{" "}
                  {attempt.metricValue}
                </p>
                <p className="mt-1 text-[#6B7280]">
                  {attempt.verificationStatus.replace(/_/g, " ")} ·{" "}
                  {dateFormatter.format(attempt.submittedAt)}
                </p>
              </div>
            ))}
            {data.attempts.length === 0 ? (
              <p className="text-sm text-[#6B7280]">No attempts yet.</p>
            ) : null}
          </NativeListSection>
        ) : activeTab === "rules" ? (
          <NativeListSection title="Record rules">
            <div className="grid gap-2 rounded-lg border border-[#E5E7EB] bg-white p-3 text-sm text-[#6B7280]">
              <p>
                Scores come from saved rounds. Screenshot OCR must match the round total before
                verified boards update.
              </p>
              <p>
                Gold: direct Rapsodo plus scorecard. Silver: CSV hash plus scorecard. Manual entries
                cannot hold verified champion status.
              </p>
            </div>
          </NativeListSection>
        ) : activeTab === "chat" ? (
          <NativeListSection title="Chat">
            <p className="rounded-lg border border-dashed border-[#E5E7EB] p-4 text-sm text-[#6B7280]">
              Record chat will sit here when comments are enabled for this board.
            </p>
          </NativeListSection>
        ) : (
          <NativeListSection title="Verified board">
            <CompactLeaderboard
              current={
                data.viewerResult
                  ? `You are #${data.viewerResult.result.rank} · ${data.viewerResult.result.scoreLabel}`
                  : "Submit an attempt to enter the board"
              }
              items={data.results.slice(0, 5).map(({ result, profile }) => ({
                rank: result.rank,
                name: profile?.displayName ?? "Player",
                href: profileHref(profile),
                value: result.scoreLabel,
                detail: verificationTierLabel(result.verificationTier),
              }))}
            />
          </NativeListSection>
        )}
      </MobileAppShell>

      <div className="hidden items-center justify-between gap-3 sm:flex">
        <Button asChild variant="ghost" className="px-0">
          <Link href={`/courses/${data.course.id}/records`} prefetch={false}>
            <ArrowLeft className="size-4" />
            {data.course.name}
          </Link>
        </Button>
        <Badge variant="outline">{data.teeSet?.name ?? "Any tee"}</Badge>
      </div>

      <div className="hidden sm:contents">
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
            <Button asChild className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
              <a href="#submit-record">
                <Send className="size-4" />
                Submit attempt
              </a>
            </Button>
          </div>
          {query?.attempt ? <AttemptSubmittedNotice className="mt-4" /> : null}
        </header>

        <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
          <article className="premium-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Medal className="size-4 text-amber-600" />
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
                variant={leader?.result.verificationStatus === "verified" ? "secondary" : "outline"}
              >
                {leader ? leader.result.verificationStatus.replace(/_/g, " ") : "open"}
              </Badge>
            </div>
          </article>

          <article className="premium-card p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="size-4 text-emerald-600" />
              Your best
            </p>
            {data.viewerResult ? (
              <div className="mt-3 rounded-lg bg-[#F5F6F4] p-4">
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
          </article>
        </section>

        <section className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <article id="submit-record" className="premium-card p-4">
            <p className="text-sm font-semibold">Submit attempt</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              The score is derived from a saved round. You cannot type a champion score here;
              screenshot OCR must match the round total before it reaches the verified board.
            </p>
            {selectedRound ? (
              <form
                action={submitCourseRecordAttemptAction}
                className="mt-4 grid gap-3"
                data-course-record-attempt-form
              >
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
                        {session.metricLabel} · {dateFormatter.format(session.date)} ·{" "}
                        {session.proofLabel}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="rounded-lg border bg-[#F5F6F4] p-3 text-sm">
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
                  screenshotFieldName="screenshotPath"
                  extractedTotalFieldName="extractedScorecardTotal"
                />
                <RecordSubmitButton className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]" />
              </form>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                No saved rounds for this record yet. Import or log a round for this course first.
              </p>
            )}
          </article>

          <main className="grid gap-4">
            <section className="premium-card p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Trophy className="size-4 text-amber-600" />
                Verified board
              </p>
              <div className="mt-4 grid gap-2">
                {data.results.slice(0, 8).map(({ result, profile }) => (
                  <div
                    key={result.id}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg bg-[#F5F6F4] px-3 py-2 text-sm"
                  >
                    <Badge variant={result.rank === 1 ? "default" : "outline"}>
                      #{result.rank ?? "--"}
                    </Badge>
                    <div className="min-w-0">
                      <ProfileNameLink
                        profile={profile}
                        className="block truncate font-medium hover:underline"
                      />
                      <p className="text-xs text-muted-foreground">
                        {verificationTierLabel(result.verificationTier)}
                      </p>
                    </div>
                    <p className="font-semibold">{result.scoreLabel}</p>
                  </div>
                ))}
                {data.results.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    No accepted entries yet.
                  </p>
                ) : null}
              </div>
            </section>

            <details className="premium-card">
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                Recent attempts
              </summary>
              <div className="grid gap-2 border-t p-4">
                {data.attempts.map(({ attempt, profile }) => (
                  <div key={attempt.id} className="rounded-lg bg-[#F5F6F4] px-3 py-2 text-sm">
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
              </div>
            </details>
          </main>
        </section>
      </div>
    </PageShell>
  );
}

function AttemptSubmittedNotice({ className = "" }: { className?: string }) {
  return (
    <div
      role="status"
      className={`rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-[#0B7A3B] ${className}`}
    >
      <p className="font-semibold">Attempt submitted</p>
      <p className="mt-1 text-xs text-emerald-800">
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

function parseRecordDetailTab(value?: string) {
  if (value === "attempts" || value === "rules" || value === "chat") {
    return value;
  }

  return "board";
}
