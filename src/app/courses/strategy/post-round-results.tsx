import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { buildPostRoundReview } from "@/lib/post-round-review";

type Review = ReturnType<typeof buildPostRoundReview>;

/** Both surfaces use the same readings; notes and scorecard results remain separate. */
export function PostRoundResults({
  review,
  roundId,
  compact = false,
}: {
  review: Review;
  roundId: string;
  compact?: boolean;
}) {
  const suggestedClub = review.practiceRecommendation.clubType;
  const practiceQuery = new URLSearchParams({ sourceSessionId: roundId });
  if (suggestedClub) practiceQuery.set("club", suggestedClub);
  const readings = [
    ["Best lateral control", review.strongest],
    ["Largest lateral miss", review.mostCostly],
    ["Change from earlier shots", review.biggestDifference],
    ["Next evidence check", review.practiceRecommendation],
  ] as const;

  const readingGrid = (
    <dl className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {readings.map(([label, result]) => (
        <div key={label} className="min-w-0 rounded-2xl border bg-card p-4">
          <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
          <dd className="mt-3 text-xl font-semibold tracking-tight">{result.value}</dd>
          <dd className="mt-3">
            <span className="inline-flex rounded-full border px-2 py-1 text-xs font-medium">
              {result.status}
            </span>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{result.detail}</p>
          </dd>
        </div>
      ))}
    </dl>
  );

  return (
    <section className="grid min-w-0 gap-4" aria-labelledby="post-round-results-title">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Shot evidence
        </p>
        <h2 id="post-round-results-title" className="mt-2 text-2xl font-semibold tracking-tight">
          {review.sampleSize
            ? "What the measured shots show"
            : "Your scorecard tells part of the story"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {review.evidence} Lateral miss alone does not measure strokes lost or identify a swing
          fault.
        </p>
      </div>
      {review.sampleSize ? (
        compact ? (
          <div className="grid gap-3">
            <div className="rounded-2xl border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">Suggested next check</p>
              <p className="mt-2 text-lg font-semibold">{review.practiceRecommendation.value}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {review.practiceRecommendation.detail}
              </p>
            </div>
            <details className="rounded-2xl border bg-card">
              <summary className="min-h-11 cursor-pointer rounded-2xl p-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                View club readings and comparison
              </summary>
              <div className="px-3 pb-3">{readingGrid}</div>
            </details>
          </div>
        ) : (
          readingGrid
        )
      ) : (
        <div className="rounded-2xl border bg-card p-4">
          <p className="font-semibold">No club has three eligible directional readings yet</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Your recorded scores and review notes are still useful. Keep those observations with
            this round; measured club comparisons will appear when enough eligible shot evidence is
            attached to this round.
          </p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {suggestedClub ? (
          <Button asChild className="min-h-11">
            <Link href={`/practice?${practiceQuery}`} prefetch={false}>
              Plan this club’s practice
            </Link>
          </Button>
        ) : null}
        <Button asChild variant={suggestedClub ? "outline" : "default"} className="min-h-11">
          <Link href={`/rounds/${roundId}`} prefetch={false}>
            Review scorecard and shots
          </Link>
        </Button>
        {review.sampleSize ? (
          <Button asChild variant="outline" className="min-h-11">
            <Link href={`/analyse/compare?sessionId=${roundId}`} prefetch={false}>
              Compare shot evidence
            </Link>
          </Button>
        ) : null}
      </div>
    </section>
  );
}
