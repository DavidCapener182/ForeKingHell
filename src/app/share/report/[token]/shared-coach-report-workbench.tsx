import type { ReactNode } from "react";
import { CalendarDays, CheckCircle2, FileLock2, LockKeyhole, ShieldCheck } from "lucide-react";

import {
  formatDateTime,
  formatLabel,
  numberMetric,
  signedMetric,
} from "@/app/share/report/[token]/shared-coach-report-format";
import { SharedCoachReportPasswordForm } from "@/app/share/report/[token]/shared-coach-report-password-form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CoachReportSnapshot } from "@/lib/coach-report";

export function SharedCoachReportView({
  report,
  title,
  expiresAt,
  passwordProtected,
  disableDownload,
}: {
  report: CoachReportSnapshot;
  title: string;
  expiresAt: Date | null;
  passwordProtected: boolean;
  disableDownload: boolean;
}) {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto grid w-full max-w-5xl gap-6 px-6 py-12">
        <header className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">
                Frozen coach evidence
              </p>
              <h1 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">{title}</h1>
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
            {expiresAt ? <span>Expires {formatDateTime(expiresAt)}</span> : null}
            <span>{disableDownload ? "View-only · download disabled" : "Download permitted"}</span>
            <span>{passwordProtected ? "Password protected" : "Private token"}</span>
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

export function SharedCoachReportPasswordGate({
  token,
  invalid,
  invalidAttempt,
}: {
  token: string;
  invalid: boolean;
  invalidAttempt: string | null;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-background p-4 text-foreground">
      <section className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-sm">
        <LockKeyhole className="size-8 text-primary" aria-hidden />
        <SharedCoachReportPasswordForm
          token={token}
          invalid={invalid}
          invalidAttempt={invalidAttempt}
          headingLevel="h1"
        />
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
            <Table className="min-w-[42rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Club</TableHead>
                  <TableHead>Stock carry</TableHead>
                  <TableHead>Playable</TableHead>
                  <TableHead>Evidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sections.bagNumbers.map((club) => (
                  <TableRow key={club.club}>
                    <TableCell className="font-semibold">{club.club}</TableCell>
                    <TableCell>{numberMetric(club.stockCarryYd, " yd")}</TableCell>
                    <TableCell>
                      {club.playableRate === null ? "—" : `${Math.round(club.playableRate)}%`}
                    </TableCell>
                    <TableCell>
                      {club.confidence} · {club.sampleSize} shots
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
            <Table className="min-w-[38rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Longer club</TableHead>
                  <TableHead>Shorter club</TableHead>
                  <TableHead>Gap</TableHead>
                  <TableHead>Evidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sections.bagGaps.map((gap) => (
                  <TableRow key={`${gap.longerClub}-${gap.shorterClub}`}>
                    <TableCell className="font-semibold">{gap.longerClub}</TableCell>
                    <TableCell>{gap.shorterClub}</TableCell>
                    <TableCell>{gap.gapYd} yd</TableCell>
                    <TableCell>
                      {gap.confidence} · {gap.sampleSize}+ shots per club
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
            <Table className="min-w-[52rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Club</TableHead>
                  <TableHead>Shot</TableHead>
                  <TableHead>Carry</TableHead>
                  <TableHead>Offline</TableHead>
                  <TableHead>Ball speed</TableHead>
                  <TableHead>Launch</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sections.rawEvidence.map((shot, index) => (
                  <TableRow key={`${shot.sessionId}-${shot.shotNumber}-${index}`}>
                    <TableCell>{formatDateTime(shot.sessionDate)}</TableCell>
                    <TableCell className="font-semibold">{formatLabel(shot.club)}</TableCell>
                    <TableCell>{shot.shotNumber ?? "—"}</TableCell>
                    <TableCell>{numberMetric(shot.carryYd, "yd")}</TableCell>
                    <TableCell>{numberMetric(shot.sideCarryYd, "yd")}</TableCell>
                    <TableCell>{numberMetric(shot.ballSpeedMph, "mph")}</TableCell>
                    <TableCell>{numberMetric(shot.launchAngleDeg, "°")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {sections.rawEvidence.length === 0 ? <EmptyEvidence /> : null}
          </div>
        </ReportSection>
      ) : null}
    </div>
  );
}

function ReportSection({ title, children }: { title: string; children: ReactNode }) {
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
