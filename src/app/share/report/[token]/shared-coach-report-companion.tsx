import type { ReactNode } from "react";

import { SharedCoachReportPasswordForm } from "@/app/share/report/[token]/shared-coach-report-password-form";
import {
  formatDateTime,
  formatLabel,
  numberMetric,
} from "@/app/share/report/[token]/shared-coach-report-format";
import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSSectionHeader,
  type IOSDisclosureItem,
} from "@/components/app/ios-mobile";
import { MobileStatusAction, MobileTopBar } from "@/components/mobile-sports";
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
    <main className="ios-public-auth min-h-dvh bg-background text-foreground">
      <div className="mx-auto grid w-full gap-4 px-4 py-3 sm:px-6">
        <section className="grid gap-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <MobileTopBar title="Coach report" />
          <MobileStatusAction
            label="Frozen coach evidence"
            value={title}
            detail={`Generated ${formatDateTime(report.generatedAt)}`}
            action={
              <IOSInlineStatus
                label={passwordProtected ? "Password protected" : "Private token"}
                tone="info"
              />
            }
          />

          <IOSSectionHeader title="Report privacy" />
          <IOSGroupedList label="Report privacy">
            <IOSListRow
              label="Selected evidence only"
              detail={report.disclosure.statement}
              status={
                <IOSInlineStatus
                  label={disableDownload ? "View only" : "Download permitted"}
                  tone="positive"
                />
              }
            />
            <IOSListRow
              label="Expiry"
              value={expiresAt ? formatDateTime(expiresAt) : "No expiry"}
            />
          </IOSGroupedList>

          <MobileCoachReportSections report={report} />

          <IOSSectionHeader title="Access boundary" />
          <IOSGroupedList label="Share access boundary">
            <IOSListRow
              label="This link grants access only to this frozen report."
              detail="It does not provide account membership or access to evidence the golfer omitted. The golfer can revoke the link at any time."
              status={<IOSInlineStatus label="Private share" tone="info" />}
            />
          </IOSGroupedList>
        </section>
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
    <main className="ios-public-auth grid min-h-dvh place-items-center bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] text-foreground">
      <section className="w-full max-w-md">
        <MobileTopBar title="Protected report" />
        <SharedCoachReportPasswordForm
          token={token}
          invalid={invalid}
          invalidAttempt={invalidAttempt}
          headingLevel="h2"
        />
      </section>
    </main>
  );
}

function MobileCoachReportSections({ report }: { report: CoachReportSnapshot }) {
  const { sections } = report;
  const disclosureItems: IOSDisclosureItem[] = [];

  if (sections.profileSummary) {
    disclosureItems.push({
      value: "profile-summary",
      title: "Profile summary",
      summary: sections.profileSummary.displayName,
      content: (
        <IOSGroupedList label="Profile summary">
          <IOSListRow label="Golfer" value={sections.profileSummary.displayName} />
          <IOSListRow
            label="Home course"
            value={sections.profileSummary.homeCourse ?? "Not shared"}
          />
          <IOSListRow
            label="Handicap band"
            value={sections.profileSummary.handicapBand ?? "Not shared"}
          />
          <IOSListRow
            label="Launch monitor"
            value={sections.profileSummary.primaryLaunchMonitor ?? "Not shared"}
          />
        </IOSGroupedList>
      ),
    });
  }

  if (sections.bagNumbers) {
    disclosureItems.push({
      value: "bag-numbers",
      title: "Bag numbers",
      summary: `${sections.bagNumbers.length} clubs`,
      content: (
        <MobileEvidenceList empty={sections.bagNumbers.length === 0} label="Bag numbers">
          {sections.bagNumbers.map((club) => (
            <IOSListRow
              key={club.club}
              label={club.club}
              value={numberMetric(club.stockCarryYd, " yd")}
              detail={`${club.playableRate === null ? "No playable rate" : `${Math.round(club.playableRate)}% playable`} · ${club.sampleSize} shots`}
              status={<IOSInlineStatus label={club.confidence} tone="neutral" />}
            />
          ))}
        </MobileEvidenceList>
      ),
    });
  }

  if (sections.recentSessions) {
    disclosureItems.push({
      value: "recent-sessions",
      title: "Recent sessions",
      summary: `${sections.recentSessions.length}`,
      content: (
        <MobileEvidenceList empty={sections.recentSessions.length === 0} label="Recent sessions">
          {sections.recentSessions.map((session) => (
            <IOSListRow
              key={session.id}
              label={session.label}
              value={`${session.shotCount} shots`}
              detail={`${formatDateTime(session.date)} · ${formatLabel(session.source)}`}
            />
          ))}
        </MobileEvidenceList>
      ),
    });
  }

  if (sections.bagGaps) {
    disclosureItems.push({
      value: "bag-gaps",
      title: "Bag gaps",
      summary: `${sections.bagGaps.length}`,
      content: (
        <MobileEvidenceList empty={sections.bagGaps.length === 0} label="Bag gaps">
          {sections.bagGaps.map((gap) => (
            <IOSListRow
              key={`${gap.longerClub}-${gap.shorterClub}`}
              label={`${gap.longerClub} to ${gap.shorterClub}`}
              value={`${gap.gapYd} yd`}
              detail={`${gap.sampleSize}+ shots per club`}
              status={<IOSInlineStatus label={gap.confidence} tone="neutral" />}
            />
          ))}
        </MobileEvidenceList>
      ),
    });
  }

  if (sections.practiceAdherence) {
    const adherence = sections.practiceAdherence;
    disclosureItems.push({
      value: "practice-adherence",
      title: "Practice adherence",
      summary: adherence.completionRate === null ? "No plans" : `${adherence.completionRate}%`,
      content: (
        <IOSGroupedList label="Practice adherence">
          <IOSListRow
            label={`Completed in ${adherence.lookbackDays} days`}
            value={`${adherence.completedSessions} / ${adherence.plannedSessions}`}
          />
          <IOSListRow label="Measured sessions" value={String(adherence.measuredSessions)} />
          <IOSListRow label="Four-week target" value={String(adherence.targetSessions)} />
        </IOSGroupedList>
      ),
    });
  }

  if (sections.savedComparisons) {
    disclosureItems.push({
      value: "saved-comparisons",
      title: "Saved comparisons",
      summary: `${sections.savedComparisons.length}`,
      content: (
        <MobileEvidenceList
          empty={sections.savedComparisons.length === 0}
          label="Saved comparisons"
        >
          {sections.savedComparisons.map((comparison) => (
            <IOSListRow
              key={comparison.id}
              label={comparison.name}
              value={comparison.verdict}
              detail={`${comparison.focusLabel} (${comparison.focusShots}) vs ${comparison.baselineLabel} (${comparison.baselineShots}). ${comparison.summary}`}
              status={
                <IOSInlineStatus
                  label={`Saved ${formatDateTime(comparison.capturedAt)} · association only`}
                  tone="neutral"
                />
              }
            />
          ))}
        </MobileEvidenceList>
      ),
    });
  }

  if (sections.coursePerformance) {
    disclosureItems.push({
      value: "course-performance",
      title: "Course performance",
      summary: `${sections.coursePerformance.length} rounds`,
      content: (
        <MobileEvidenceList
          empty={sections.coursePerformance.length === 0}
          label="Course performance"
        >
          {sections.coursePerformance.map((round) => (
            <IOSListRow
              key={`${round.date}-${round.course}`}
              label={round.course}
              value={round.grossScore === null ? "Incomplete" : `${round.grossScore} gross`}
              detail={`${formatDateTime(round.date)} · ${round.holesRecorded} scored holes`}
            />
          ))}
        </MobileEvidenceList>
      ),
    });
  }

  if (sections.personalBests) {
    disclosureItems.push({
      value: "personal-bests",
      title: "Personal bests",
      summary: `${sections.personalBests.length}`,
      content: (
        <MobileEvidenceList empty={sections.personalBests.length === 0} label="Personal bests">
          {sections.personalBests.map((best) => (
            <IOSListRow
              key={best.club}
              label={best.club}
              value={`${Math.round(best.carryYd * 10) / 10} yd`}
              detail={`${best.evidenceShots} clean supporting shots`}
            />
          ))}
        </MobileEvidenceList>
      ),
    });
  }

  if (sections.notes) {
    disclosureItems.push({
      value: "golfer-notes",
      title: "Golfer notes",
      summary: `${sections.notes.length}`,
      content: (
        <MobileEvidenceList empty={sections.notes.length === 0} label="Golfer notes">
          {sections.notes.map((note, index) => (
            <IOSListRow
              key={`${note.date}-${index}`}
              label={note.text}
              detail={`${formatLabel(note.source)} · ${formatDateTime(note.date)}`}
            />
          ))}
        </MobileEvidenceList>
      ),
    });
  }

  if (sections.rawEvidence) {
    disclosureItems.push({
      value: "raw-evidence",
      title: "Selected raw evidence",
      summary: `${sections.rawEvidence.length} shots`,
      content: (
        <MobileEvidenceList empty={sections.rawEvidence.length === 0} label="Raw evidence">
          {sections.rawEvidence.map((shot, index) => (
            <IOSListRow
              key={`${shot.sessionId}-${shot.shotNumber}-${index}`}
              label={`${formatLabel(shot.club)} · shot ${shot.shotNumber ?? "—"}`}
              value={numberMetric(shot.carryYd, " yd")}
              detail={`${formatDateTime(shot.sessionDate)} · offline ${numberMetric(shot.sideCarryYd, " yd")} · ball speed ${numberMetric(shot.ballSpeedMph, " mph")} · launch ${numberMetric(shot.launchAngleDeg, "°")}`}
              status={
                shot.quality ? (
                  <IOSInlineStatus label={formatLabel(shot.quality)} tone="neutral" />
                ) : undefined
              }
            />
          ))}
        </MobileEvidenceList>
      ),
    });
  }

  return (
    <div className="grid gap-4">
      {sections.goals ? (
        <>
          <IOSSectionHeader title="Current goals" />
          <IOSGroupedList label="Current goals">
            <IOSListRow label="Season outcome" detail={sections.goals.outcome} />
            <IOSListRow label="Current focus" detail={sections.goals.focus} />
            <IOSListRow label="Weekly rhythm" value={`${sections.goals.weeklySessions} sessions`} />
            <IOSListRow label="Success measure" detail={sections.goals.successMeasure} />
            {sections.seasonGoals?.map((goal) => (
              <IOSListRow
                key={goal.id}
                label={goal.title}
                value={`${goal.currentValue} / ${goal.targetValue} ${goal.unit}`}
                detail={`Next: ${goal.nextAction}`}
                status={<IOSInlineStatus label={goal.evidenceSource} tone="info" />}
              />
            ))}
          </IOSGroupedList>
        </>
      ) : null}

      {sections.keyTrends ? (
        <>
          <IOSSectionHeader title="Key trends" />
          <MobileEvidenceList empty={sections.keyTrends.length === 0} label="Key trends">
            {sections.keyTrends.map((trend) => (
              <IOSListRow
                key={`${trend.label}-${trend.value}`}
                label={trend.label}
                value={trend.value}
                detail={trend.detail}
                status={<IOSInlineStatus label={trend.confidence} tone="neutral" />}
              />
            ))}
          </MobileEvidenceList>
        </>
      ) : null}

      {disclosureItems.length > 0 ? (
        <>
          <IOSSectionHeader
            title="Supporting evidence"
            description="Open one section at a time for the selected detail."
          />
          <IOSDisclosureGroup items={disclosureItems} label="Supporting report evidence" />
        </>
      ) : null}
    </div>
  );
}

function MobileEvidenceList({
  children,
  empty,
  label,
}: {
  children: ReactNode;
  empty: boolean;
  label: string;
}) {
  return (
    <IOSGroupedList label={label}>
      {empty ? (
        <IOSListRow
          label="No qualifying evidence"
          detail="This frozen report did not include a supporting item for this section."
        />
      ) : (
        children
      )}
    </IOSGroupedList>
  );
}
