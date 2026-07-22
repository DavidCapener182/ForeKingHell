import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { CalendarDays, CheckCircle2, FileLock2, LockKeyhole, ShieldCheck } from "lucide-react";

import { unlockCoachReportAction } from "@/app/share/report/[token]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDb } from "@/db/client";
import { contentExports, shareLinks } from "@/db/schema";
import { isCoachReportSnapshot, type CoachReportSnapshot } from "@/lib/coach-report";
import {
  parseCoachReportAccessConfig,
  reportAccessCookieName,
  reportAccessGrant,
} from "@/lib/coach-report-access";
import { hashShareToken } from "@/lib/share-links";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shared coach report",
  robots: { index: false, follow: false },
};

export default async function SharedCoachReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  if (token.length < 20 || token.length > 256) notFound();

  const now = new Date();
  const [row] = await getDb()
    .select({
      exportId: contentExports.id,
      title: shareLinks.title,
      expiresAt: shareLinks.expiresAt,
      snapshot: contentExports.snapshotJson,
      renderConfig: contentExports.renderConfigJson,
      tokenHash: shareLinks.tokenHash,
    })
    .from(shareLinks)
    .innerJoin(
      contentExports,
      and(
        eq(contentExports.id, shareLinks.resourceId),
        eq(contentExports.userId, shareLinks.userId),
        eq(contentExports.sourceType, "coach_report"),
        eq(contentExports.status, "ready"),
      ),
    )
    .where(
      and(
        eq(shareLinks.tokenHash, hashShareToken(token)),
        eq(shareLinks.resourceType, "coach_report"),
        isNull(shareLinks.revokedAt),
        or(isNull(shareLinks.expiresAt), gt(shareLinks.expiresAt, now)),
      ),
    )
    .limit(1);

  if (!row || !isCoachReportSnapshot(row.snapshot)) notFound();
  const report = row.snapshot;
  const access = parseCoachReportAccessConfig(row.renderConfig);
  if (access.passwordHash) {
    const store = await cookies();
    const granted = store.get(reportAccessCookieName(row.exportId))?.value;
    if (granted !== reportAccessGrant(row.tokenHash, access.passwordHash)) {
      return <PasswordGate token={token} invalid={query?.error === "password"} />;
    }
  }
  const viewedAt = new Date().toISOString();
  await getDb()
    .update(contentExports)
    .set({
      renderConfigJson: {
        ...row.renderConfig,
        accessHistory: [...access.accessHistory, viewedAt].slice(-50),
      },
      updatedAt: new Date(),
    })
    .where(eq(contentExports.id, row.exportId));

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 sm:px-6 lg:py-12">
        <header className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">
                Frozen coach evidence
              </p>
              <h1 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
                {row.title ?? report.title}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                {report.disclosure.statement}
              </p>
            </div>
            <FileLock2 className="size-8 shrink-0 text-primary" aria-hidden />
          </div>
          <div className="mt-5 flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="size-4" aria-hidden />
              Generated {formatDateTime(report.generatedAt)}
            </span>
            {row.expiresAt ? <span>Expires {formatDateTime(row.expiresAt)}</span> : null}
            <span>
              {access.disableDownload ? "View-only · download disabled" : "Download permitted"}
            </span>
            <span>{access.passwordHash ? "Password protected" : "Private token"}</span>
          </div>
        </header>

        <ReportSections report={report} />

        <footer className="rounded-2xl border border-border bg-card p-5 text-sm leading-6 text-muted-foreground">
          <p className="flex items-start gap-2 font-semibold text-foreground">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            This link grants access only to this frozen report.
          </p>
          <p className="mt-2">
            It does not provide account membership or access to any section the golfer omitted. The
            golfer can revoke the link at any time.
          </p>
        </footer>
      </div>
    </main>
  );
}

function PasswordGate({ token, invalid }: { token: string; invalid: boolean }) {
  const action = unlockCoachReportAction.bind(null, token);
  return (
    <main className="grid min-h-dvh place-items-center bg-background p-4 text-foreground">
      <section className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-sm">
        <LockKeyhole className="size-8 text-primary" aria-hidden />
        <p className="mt-5 text-sm font-semibold uppercase tracking-[0.14em] text-primary">
          Protected performance report
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Enter the report password</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The golfer protected this frozen report. The share token alone does not unlock it.
        </p>
        <form action={action} className="mt-5 grid gap-3">
          <label className="grid gap-2 text-sm font-semibold">
            Password
            <Input
              name="password"
              type="password"
              minLength={8}
              maxLength={128}
              autoFocus
              required
            />
          </label>
          {invalid ? (
            <p role="alert" className="text-sm font-semibold text-destructive">
              That password did not match.
            </p>
          ) : null}
          <Button type="submit" className="min-h-11">
            Open report
          </Button>
        </form>
      </section>
    </main>
  );
}

function ReportSections({ report }: { report: CoachReportSnapshot }) {
  const { sections } = report;
  return (
    <div className="grid gap-5">
      {sections.profileSummary ? (
        <ReportSection title="Profile summary">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ReportMetric label="Golfer" value={sections.profileSummary.displayName} />
            <ReportMetric
              label="Home course"
              value={sections.profileSummary.homeCourse ?? "Not shared"}
            />
            <ReportMetric
              label="Handicap band"
              value={sections.profileSummary.handicapBand ?? "Not shared"}
            />
            <ReportMetric
              label="Launch monitor"
              value={sections.profileSummary.primaryLaunchMonitor ?? "Not shared"}
            />
          </dl>
        </ReportSection>
      ) : null}

      {sections.goals ? (
        <ReportSection title="Current goals">
          <dl className="grid gap-3 sm:grid-cols-2">
            <ReportMetric label="Season outcome" value={sections.goals.outcome} />
            <ReportMetric label="Current focus" value={sections.goals.focus} />
            <ReportMetric
              label="Weekly rhythm"
              value={`${sections.goals.weeklySessions} measured sessions`}
            />
            <ReportMetric label="Success measure" value={sections.goals.successMeasure} />
          </dl>
          {sections.seasonGoals?.length ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {sections.seasonGoals.map((goal) => (
                <article
                  key={goal.id}
                  className="rounded-xl border border-border bg-background p-4"
                >
                  <p className="font-semibold">{goal.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {goal.currentValue} {goal.unit} now · {goal.targetValue} {goal.unit} target
                    {goal.targetDate ? ` · due ${formatDateTime(goal.targetDate)}` : ""}
                  </p>
                  <p className="mt-2 text-sm leading-6">Next: {goal.nextAction}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Evidence: {goal.evidenceSource}
                  </p>
                </article>
              ))}
            </div>
          ) : null}
        </ReportSection>
      ) : null}

      {sections.bagNumbers ? (
        <ReportSection title="Bag numbers">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Club</th>
                  <th className="px-3 py-2">Stock carry</th>
                  <th className="px-3 py-2">Playable</th>
                  <th className="px-3 py-2">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {sections.bagNumbers.map((club) => (
                  <tr key={club.club} className="border-t border-border">
                    <td className="px-3 py-3 font-semibold">{club.club}</td>
                    <td className="px-3 py-3">{numberMetric(club.stockCarryYd, " yd")}</td>
                    <td className="px-3 py-3">
                      {club.playableRate === null ? "—" : `${Math.round(club.playableRate)}%`}
                    </td>
                    <td className="px-3 py-3">
                      {club.confidence} · {club.sampleSize} shots
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sections.bagNumbers.length === 0 ? <EmptyEvidence /> : null}
          </div>
        </ReportSection>
      ) : null}

      {sections.recentSessions ? (
        <ReportSection title="Recent sessions">
          <div className="grid gap-2">
            {sections.recentSessions.length > 0 ? (
              sections.recentSessions.map((session) => (
                <div
                  key={session.id}
                  className="grid gap-1 rounded-xl bg-secondary/45 p-3 sm:grid-cols-[1fr_auto]"
                >
                  <div>
                    <p className="font-semibold">{session.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(session.date)} · {formatLabel(session.source)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold">{session.shotCount} measured shots</p>
                </div>
              ))
            ) : (
              <EmptyEvidence />
            )}
          </div>
        </ReportSection>
      ) : null}

      {sections.keyTrends ? (
        <ReportSection title="Key trends">
          <div className="grid gap-3 sm:grid-cols-2">
            {sections.keyTrends.length > 0 ? (
              sections.keyTrends.map((trend) => (
                <div
                  key={`${trend.label}-${trend.value}`}
                  className="rounded-xl bg-secondary/45 p-4"
                >
                  <p className="text-sm text-muted-foreground">{trend.label}</p>
                  <p className="mt-1 text-xl font-semibold">{trend.value}</p>
                  <p className="mt-2 text-sm leading-5 text-muted-foreground">{trend.detail}</p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-primary">
                    {trend.confidence}
                  </p>
                </div>
              ))
            ) : (
              <EmptyEvidence />
            )}
          </div>
        </ReportSection>
      ) : null}

      {sections.bagGaps ? (
        <ReportSection title="Bag gaps">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[38rem] text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Longer club</th>
                  <th className="px-3 py-2">Shorter club</th>
                  <th className="px-3 py-2">Gap</th>
                  <th className="px-3 py-2">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {sections.bagGaps.map((gap) => (
                  <tr
                    key={`${gap.longerClub}-${gap.shorterClub}`}
                    className="border-t border-border"
                  >
                    <td className="px-3 py-3 font-semibold">{gap.longerClub}</td>
                    <td className="px-3 py-3">{gap.shorterClub}</td>
                    <td className="px-3 py-3">{gap.gapYd} yd</td>
                    <td className="px-3 py-3">
                      {gap.confidence} · {gap.sampleSize}+ shots per club
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sections.bagGaps.length === 0 ? <EmptyEvidence /> : null}
          </div>
        </ReportSection>
      ) : null}

      {sections.practiceAdherence ? (
        <ReportSection title="Practice adherence">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ReportMetric
              label={`Completed in ${sections.practiceAdherence.lookbackDays} days`}
              value={`${sections.practiceAdherence.completedSessions} / ${sections.practiceAdherence.plannedSessions}`}
            />
            <ReportMetric
              label="Completion rate"
              value={
                sections.practiceAdherence.completionRate === null
                  ? "No plans"
                  : `${sections.practiceAdherence.completionRate}%`
              }
            />
            <ReportMetric
              label="Measured sessions"
              value={String(sections.practiceAdherence.measuredSessions)}
            />
            <ReportMetric
              label="Four-week target"
              value={String(sections.practiceAdherence.targetSessions)}
            />
          </dl>
        </ReportSection>
      ) : null}

      {sections.savedComparisons ? (
        <ReportSection title="Saved session comparisons">
          <div className="grid gap-3">
            {sections.savedComparisons.length ? (
              sections.savedComparisons.map((comparison) => (
                <article key={comparison.id} className="rounded-xl bg-secondary/45 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{comparison.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {comparison.focusLabel} ({comparison.focusShots} shots) vs{" "}
                        {comparison.baselineLabel} ({comparison.baselineShots} shots)
                      </p>
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                      {comparison.verdict}
                    </p>
                  </div>
                  <p className="mt-3 text-sm leading-6">{comparison.summary}</p>
                  {comparison.notes ? (
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Test note: {comparison.notes}
                    </p>
                  ) : null}
                  <dl className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(comparison.delta).map(([metric, value]) => (
                      <div
                        key={metric}
                        className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
                      >
                        <dt className="text-muted-foreground">{formatLabel(metric)}</dt>
                        <dd className="mt-1 font-semibold">
                          {value === null ? "—" : signedMetric(value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Saved {formatDateTime(comparison.capturedAt)} · association only unless test
                    conditions were held constant.
                  </p>
                </article>
              ))
            ) : (
              <EmptyEvidence />
            )}
          </div>
        </ReportSection>
      ) : null}

      {sections.coursePerformance ? (
        <ReportSection title="Course performance">
          <div className="grid gap-2">
            {sections.coursePerformance.length ? (
              sections.coursePerformance.map((round) => (
                <div
                  key={`${round.date}-${round.course}`}
                  className="grid gap-1 rounded-xl bg-secondary/45 p-3 sm:grid-cols-[1fr_auto]"
                >
                  <div>
                    <p className="font-semibold">{round.course}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(round.date)} · {round.holesRecorded} scored holes
                    </p>
                  </div>
                  <p className="font-semibold">
                    {round.grossScore === null
                      ? "Incomplete scorecard"
                      : `${round.grossScore} gross`}
                  </p>
                </div>
              ))
            ) : (
              <EmptyEvidence />
            )}
          </div>
        </ReportSection>
      ) : null}

      {sections.personalBests ? (
        <ReportSection title="Personal bests">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sections.personalBests.length ? (
              sections.personalBests.map((best) => (
                <div key={best.club} className="rounded-xl bg-secondary/45 p-4">
                  <p className="text-sm text-muted-foreground">{best.club} measured carry</p>
                  <p className="mt-1 text-2xl font-semibold">
                    {Math.round(best.carryYd * 10) / 10} yd
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {best.evidenceShots} clean shots in the supporting history
                  </p>
                </div>
              ))
            ) : (
              <EmptyEvidence />
            )}
          </div>
        </ReportSection>
      ) : null}

      {sections.notes ? (
        <ReportSection title="Golfer notes">
          <div className="grid gap-3">
            {sections.notes.length > 0 ? (
              sections.notes.map((note, index) => (
                <blockquote
                  key={`${note.date}-${index}`}
                  className="rounded-xl bg-secondary/45 p-4"
                >
                  <p className="leading-6">{note.text}</p>
                  <footer className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {formatLabel(note.source)} · {formatDateTime(note.date)}
                  </footer>
                </blockquote>
              ))
            ) : (
              <EmptyEvidence />
            )}
          </div>
        </ReportSection>
      ) : null}

      {sections.rawEvidence ? (
        <ReportSection title="Selected raw evidence">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Club</th>
                  <th className="px-3 py-2">Shot</th>
                  <th className="px-3 py-2">Carry</th>
                  <th className="px-3 py-2">Offline</th>
                  <th className="px-3 py-2">Ball speed</th>
                  <th className="px-3 py-2">Launch</th>
                </tr>
              </thead>
              <tbody>
                {sections.rawEvidence.map((shot, index) => (
                  <tr
                    key={`${shot.sessionId}-${shot.shotNumber}-${index}`}
                    className="border-t border-border"
                  >
                    <td className="px-3 py-3">{formatDateTime(shot.sessionDate)}</td>
                    <td className="px-3 py-3 font-semibold">{formatLabel(shot.club)}</td>
                    <td className="px-3 py-3">{shot.shotNumber ?? "—"}</td>
                    <td className="px-3 py-3">{numberMetric(shot.carryYd, "yd")}</td>
                    <td className="px-3 py-3">{numberMetric(shot.sideCarryYd, "yd")}</td>
                    <td className="px-3 py-3">{numberMetric(shot.ballSpeedMph, "mph")}</td>
                    <td className="px-3 py-3">{numberMetric(shot.launchAngleDeg, "°")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sections.rawEvidence.length === 0 ? <EmptyEvidence /> : null}
          </div>
        </ReportSection>
      ) : null}
    </div>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <h2 className="mb-4 flex items-center gap-2 font-display text-2xl font-semibold">
        <CheckCircle2 className="size-5 text-primary" aria-hidden />
        {title}
      </h2>
      {children}
    </section>
  );
}

function ReportMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/45 p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}

function EmptyEvidence() {
  return (
    <p className="py-3 text-sm text-muted-foreground">No qualifying evidence was available.</p>
  );
}

function formatDateTime(value: string | Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function numberMetric(value: number | null, unit: string) {
  return value === null ? "—" : `${Math.round(value * 10) / 10}${unit}`;
}

function signedMetric(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}`;
}
