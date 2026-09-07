import Link from "next/link";
import { StrategyModeNavigation } from "./strategy-navigation";
import { getPostRoundReviewData } from "@/lib/post-round-review-data";
import { buildRoundLearningReview } from "@/lib/round-learning-review";
import { MobileAppShell, MobileTopBar } from "@/components/mobile-sports";
import { PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PostRoundResults } from "./post-round-results";
import { PostRoundReviewForm } from "./post-round-review-form";

export async function PostRoundCompanion({ roundId, saved }: { roundId?: string; saved?: string }) {
  const data = await getPostRoundReviewData(roundId);
  const round = data.selectedRound;
  if (!round)
    return (
      <PageShell>
        <MobileAppShell className="gap-5 pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
          <MobileTopBar title="Round review" />
          <StrategyModeNavigation mode="post" />
          <p>
            {roundId
              ? "This completed round is unavailable."
              : "Finish a round to review its decisions."}
          </p>
          <Button asChild>
            <Link href="/rounds">Choose a round</Link>
          </Button>
        </MobileAppShell>
      </PageShell>
    );
  const learning = buildRoundLearningReview({ holes: round.scorecard ?? [] });
  return (
    <PageShell>
      <MobileAppShell className="gap-5 pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
        <MobileTopBar title="Review round decisions" />
        <StrategyModeNavigation
          mode="post"
          courseId={round.courseId ?? undefined}
          teeSetId={round.teeSetId ?? undefined}
        />
        <section className="grid gap-2 rounded-2xl border bg-card p-4" data-post-round-companion>
          <p className="font-semibold">{round.courseName ?? "Recorded round"}</p>
          <p className="text-sm text-muted-foreground">{data.scoreLabel}</p>
          <p className="border-t pt-3 text-sm">{learning.nextPractice}.</p>
          <Link
            className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4"
            href={`/rounds/${round.id}`}
          >
            View scorecard
          </Link>
        </section>
        <form action="/courses/strategy" className="grid min-w-0 gap-2">
          <input type="hidden" name="mode" value="post" />
          <label className="grid min-w-0 gap-2 text-sm font-semibold">
            Round to review
            <select
              name="roundId"
              defaultValue={round.id}
              className="min-h-12 w-full min-w-0 rounded-lg border bg-background px-3 text-base font-normal"
            >
              {data.rounds.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.courseName ?? "Recorded round"} ·{" "}
                  {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(item.date)}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="outline" className="min-h-11">
            Load round
          </Button>
        </form>
        <PostRoundResults review={data.review} roundId={round.id} compact />
        <div>
          <h2 className="text-xl font-semibold">What should you remember?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Keep decisions and observations with this round. Notes add context; they do not prove a
            swing fault.
          </p>
        </div>
        {saved === "1" ? (
          <p role="status" className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
            Review notes saved to this round.
          </p>
        ) : null}
        <PostRoundReviewForm key={round.id}>
          <input type="hidden" name="sessionId" value={round.id} />
          <input type="hidden" name="courseId" value={round.courseId ?? ""} />
          <input type="hidden" name="teeSetId" value={round.teeSetId ?? ""} />
          {(
            [
              [
                "feltDifferent",
                "What worked or felt different?",
                "A decision, strike or feeling worth keeping…",
              ],
              [
                "troubleClub",
                "Which club or decision needs a review?",
                "Club, hole and what happened…",
              ],
              [
                "contextChange",
                "Did the conditions or equipment change?",
                "Wind, ground, ball or club changes…",
              ],
              [
                "shotsToReview",
                "What would you practise next?",
                "A specific situation, or leave blank if unsure…",
              ],
            ] as const
          ).map(([name, label, placeholder]) => (
            <label key={name} className="grid gap-2 text-sm font-semibold">
              {label}
              <Textarea
                name={name}
                defaultValue={data.answers[name]}
                placeholder={placeholder}
                style={{ minHeight: 96 }}
                maxLength={600}
                rows={3}
                className="min-h-24 text-base font-normal"
              />
            </label>
          ))}
          <Button type="submit" className="min-h-12">
            Save review notes
          </Button>
        </PostRoundReviewForm>
      </MobileAppShell>
    </PageShell>
  );
}
