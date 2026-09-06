import type { ReactNode } from "react";
import { mobileComparisonSummary, mobileReviewHighlights } from "@/lib/mobile-review-copy";
import Link from "next/link";
import { MobilePageTabs } from "./mobile-controls";
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
  const highlights = mobileReviewHighlights(review.clubs);
  return (
    <div
      id="today-practice-review"
      className="grid min-w-0 scroll-mt-24 gap-6"
      data-today-practice-review
    >
      <MobilePageTabs
        className="companion-review-tabs"
        initialValue="overview"
        mode="local"
        ariaLabel="Today's practice review sections"
        tabs={[
          {
            value: "overview",
            label: "Overview",
            content: (
              <div className="grid gap-5">
                <div
                  className="grid grid-cols-3 divide-x divide-border rounded-2xl bg-card py-4 text-center"
                  aria-label="Practice totals"
                >
                  {[
                    [review.shotCount, "shots"],
                    [review.clubs.length, "clubs"],
                    [review.sessions.length, "sessions"],
                  ].map(([value, label]) => (
                    <div key={label}>
                      <strong className="block text-3xl font-semibold tracking-tight tabular-nums">
                        {value}
                      </strong>
                      <span className="text-xs text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>
                <MobileSection title="What your shots say">
                  <div className="grid gap-2">
                    {highlights.map((club) => (
                      <div key={club.type} className="rounded-2xl bg-card px-4 py-3">
                        <p className="text-sm font-semibold">
                          {club.label} · {verdicts[club.comparison!.verdict]}
                        </p>
                        <p className="mt-1 text-sm leading-5 text-muted-foreground">
                          {mobileComparisonSummary(club.comparison!)}
                        </p>
                      </div>
                    ))}
                    {!highlights.length ? (
                      <p className="text-sm text-muted-foreground">
                        More comparable shots are needed before choosing a headline. Open Clubs to
                        review every measured result.
                      </p>
                    ) : null}
                  </div>
                </MobileSection>
                <MobileSection title="Shot patterns">{pattern}</MobileSection>
                <Link
                  href="/progress"
                  className="flex min-h-12 items-center justify-between rounded-2xl bg-card px-4 text-sm font-semibold text-primary"
                >
                  See your progress over time <span aria-hidden>→</span>
                </Link>
              </div>
            ),
          },
          {
            value: "clubs",
            label: "Clubs",
            content: (
              <MobileSection title="Club-by-club review">
                <p className="text-sm text-muted-foreground">
                  {review.trustedCount} trusted shots · {review.comparisonCount} comparable full
                  shots
                  {review.excludedCount ? ` · ${review.excludedCount} excluded from analysis` : ""}.
                  Changes use up to 50 earlier trusted full shots for each club.
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
                            <p className="text-sm">{mobileComparisonSummary(comparison)}</p>
                            <p className="text-xs text-muted-foreground">
                              {comparison.today.shotCount} comparable shots today ·{" "}
                              {comparison.previous.shotCount} earlier shots
                            </p>
                            <dl className="grid grid-cols-2 gap-3 text-sm">
                              {[
                                ["Average carry", reading(comparison.today.carryAverageYd, "yd")],
                                ["Average total", reading(comparison.today.totalAverageYd, "yd")],
                                [
                                  "Average offline",
                                  reading(comparison.today.offlineAverageYd, "yd"),
                                ],
                                ["Carry spread", reading(comparison.today.carryStdDevYd, "yd")],
                                ["Straight shots", reading(comparison.today.straightRate, "%")],
                                ["Playable shots", reading(comparison.today.playableRate, "%")],
                                [
                                  "Ball speed",
                                  reading(comparison.today.ballSpeedAverageMph, "mph"),
                                ],
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
                            Open the session to review these shots. Chips, recovery shots and
                            excluded readings do not establish a full-shot baseline.
                          </p>
                        )}
                      </details>
                    );
                  })}
                </div>
              </MobileSection>
            ),
          },
          {
            value: "sessions",
            label: "Sessions",
            content: (
              <MobileSection title="Your uploads">
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
            ),
          },
        ]}
      />
    </div>
  );
}
