import type { ReactNode } from "react";
import { MobileGroupedList, MobileListRow } from "./mobile-primitives";
import { MobileSection } from "./mobile-screen";
import type { MobileTodayReview } from "@/lib/mobile-today-review";

const number = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
function reading(value: number | null, unit: string) {
  return value === null ? "Not measured" : `${number.format(value)} ${unit}`;
}
const verdicts = {
  better: "Improved",
  worse: "Needs attention",
  mixed: "Mixed results",
  new: "Building a baseline",
};

export function MobileTodayPracticeReview({
  review,
  pattern,
}: {
  review: MobileTodayReview;
  pattern: ReactNode;
}) {
  return (
    <div
      id="today-practice-review"
      className="grid min-w-0 scroll-mt-24 gap-6"
      data-today-practice-review
    >
      <MobileSection title="Today’s session review">
        <p className="text-sm text-muted-foreground">
          {review.dateLabel} · {review.summary}
        </p>
        <MobileGroupedList label="Today’s uploaded sessions">
          {review.sessions.map((session, index) => (
            <MobileListRow
              key={session.id}
              label={`Session ${index + 1} · ${session.shotCount} shots`}
              detail={session.clubs || session.label}
              href={session.href}
              ariaLabel={`Review session ${index + 1}: ${session.label}, ${session.shotCount} shots`}
            />
          ))}
        </MobileGroupedList>
      </MobileSection>
      <MobileSection title="Club-by-club review">
        <p className="text-sm text-muted-foreground">
          {review.trustedCount} trusted shots · {review.comparisonCount} comparable full shots
          {review.excludedCount ? ` · ${review.excludedCount} excluded from analysis` : ""}. Changes
          use up to 50 earlier trusted full shots for each club.
        </p>
        <div className="grid min-w-0 gap-3">
          {review.clubs.map((club) => {
            const comparison = club.comparison;
            return (
              <details
                key={club.type}
                className="min-w-0 rounded-2xl bg-card p-4"
                data-today-club-review
              >
                <summary className="min-h-11 cursor-pointer text-sm marker:text-primary">
                  <span className="font-semibold">{club.label}</span>
                  <span className="ml-2 text-muted-foreground">{club.shotCount} shots</span>
                  <span className="mt-1 block text-muted-foreground">
                    {comparison ? verdicts[comparison.verdict] : "No comparable full shots"}
                    {comparison?.today.carryAverageYd != null
                      ? ` · ${reading(comparison.today.carryAverageYd, "yd")} average carry`
                      : ""}
                  </span>
                </summary>
                {comparison ? (
                  <div className="mt-3 grid gap-3">
                    <p className="text-sm">{comparison.summary}</p>
                    <p className="text-xs text-muted-foreground">
                      {comparison.today.shotCount} comparable shots today ·{" "}
                      {comparison.previous.shotCount} earlier shots
                    </p>
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      {[
                        ["Average carry", reading(comparison.today.carryAverageYd, "yd")],
                        ["Average total", reading(comparison.today.totalAverageYd, "yd")],
                        ["Average offline", reading(comparison.today.offlineAverageYd, "yd")],
                        ["Carry spread", reading(comparison.today.carryStdDevYd, "yd")],
                        ["Straight shots", reading(comparison.today.straightRate, "%")],
                        ["Playable shots", reading(comparison.today.playableRate, "%")],
                        ["Ball speed", reading(comparison.today.ballSpeedAverageMph, "mph")],
                        [
                          "Smash factor",
                          comparison.today.smashAverage === null
                            ? "Not measured"
                            : comparison.today.smashAverage.toFixed(2),
                        ],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt className="text-xs text-muted-foreground">{label}</dt>
                          <dd className="mt-1 font-medium tabular-nums">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Open the session to review these shots. Chips, recovery shots and excluded
                    readings do not establish a full-shot baseline.
                  </p>
                )}
              </details>
            );
          })}
        </div>
      </MobileSection>
      <MobileSection title="Today’s shot patterns">{pattern}</MobileSection>
    </div>
  );
}
